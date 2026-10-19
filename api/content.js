const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

function hasDB() {
  return Boolean(process.env.DATABASE_URL);
}

function getSql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTable(sql) {
  await sql`CREATE TABLE IF NOT EXISTS sanvi_content (
    id INT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;
}

function readDefaultContent() {
  const filePath = path.join(process.cwd(), 'content.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// GET  -> current live content (Neon Postgres if connected, else the bundled content.json)
// POST -> { password, content } — password checked against ADMIN_PASSWORD env var
//         (falls back to "SanviEducation" if that env var isn't set).
//         Requires a Neon Postgres database (via Vercel Marketplace) to actually
//         persist across all visitors; without it, the save is rejected with a
//         clear message instead of silently no-op'ing.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      if (hasDB()) {
        const sql = getSql();
        await ensureTable(sql);
        const rows = await sql`SELECT data FROM sanvi_content WHERE id = 1`;
        if (rows.length) return res.status(200).json(rows[0].data);
      }
      return res.status(200).json(readDefaultContent());
    } catch (err) {
      try {
        return res.status(200).json(readDefaultContent());
      } catch (err2) {
        return res.status(500).json({ error: 'Unable to load content.' });
      }
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);

      const password = body && body.password;
      const content = body && body.content;
      const expected = process.env.ADMIN_PASSWORD || 'SanviEducation';

      if (password !== expected) {
        return res.status(401).json({ success: false, error: 'Incorrect password.' });
      }
      if (!content || typeof content !== 'object') {
        return res.status(400).json({ success: false, error: 'Missing content payload.' });
      }

      content.meta = content.meta || {};
      content.meta.lastUpdated = new Date().toISOString();

      if (!hasDB()) {
        return res.status(200).json({
          success: false,
          persisted: false,
          error: 'No database is connected yet, so this cannot go live for all visitors. In your Vercel project go to Storage → Marketplace Database Integrations → Neon (Postgres), connect it to this project, then redeploy. Until then use "Preview only" to check changes in this browser.'
        });
      }

      const sql = getSql();
      await ensureTable(sql);
      await sql`
        INSERT INTO sanvi_content (id, data, updated_at)
        VALUES (1, ${JSON.stringify(content)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
      `;
      return res.status(200).json({ success: true, persisted: true, content: content });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Server error while saving: ' + err.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
