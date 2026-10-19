const { kv } = require('@vercel/kv');
const fs = require('fs');
const path = require('path');

function hasKV() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function readDefaultContent() {
  const filePath = path.join(process.cwd(), 'content.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// GET  -> current live content (KV if connected, else the bundled content.json)
// POST -> { password, content } — password checked against ADMIN_PASSWORD env var
//         (falls back to "SanviEducation" if that env var isn't set).
//         Requires Vercel KV to actually persist across all visitors; without it,
//         the save is rejected with a clear message instead of silently no-op'ing.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      if (hasKV()) {
        const stored = await kv.get('sanvi_content');
        if (stored) return res.status(200).json(stored);
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

      if (!hasKV()) {
        return res.status(200).json({
          success: false,
          persisted: false,
          error: 'Vercel KV is not connected yet, so this cannot go live for all visitors. In your Vercel project go to Storage → Create Database → KV, connect it to this project, then redeploy. Until then use "Preview only" to check changes in this browser.'
        });
      }

      await kv.set('sanvi_content', content);
      return res.status(200).json({ success: true, persisted: true, content: content });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Server error while saving: ' + err.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
