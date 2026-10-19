(function () {
  "use strict";

  var GATE_PASSWORD = "SanviEducation"; // convenience gate only — NOT real security.
  // Real protection is the ADMIN_PASSWORD env var checked server-side in api/content.js
  // on every publish. Anyone reading this file's source can see this constant, so set
  // ADMIN_PASSWORD in your Vercel project settings before going live with real donors.

  var SS_PW = "sanvi_admin_pw_session";
  var LS_ADMIN_DRAFT = "sanvi_admin_draft";

  function qs(sel) { return document.querySelector(sel); }
  function val(id) { var el = qs("#" + id); return el ? el.value : ""; }
  function setVal(id, v) { var el = qs("#" + id); if (el) el.value = v == null ? "" : v; }
  function checked(id) { var el = qs("#" + id); return !!(el && el.checked); }
  function setChecked(id, v) { var el = qs("#" + id); if (el) el.checked = !!v; }
  function num(id) { return parseInt(val(id), 10) || 0; }

  function showBanner(msg, type) {
    var b = qs("#statusBanner");
    b.textContent = msg;
    b.className = "status-banner is-visible " + (type || "ok");
  }

  /* ---------------- Gate ---------------- */
  function trySessionUnlock() {
    try {
      if (sessionStorage.getItem(SS_PW) === GATE_PASSWORD) {
        unlock();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function unlock() {
    qs("#gateScreen").style.display = "none";
    qs("#adminWrap").classList.add("is-visible");
    loadIntoForm();
  }

  function initGate() {
    if (trySessionUnlock()) return;
    qs("#gateForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var entered = val("gatePassword");
      if (entered === GATE_PASSWORD) {
        try { sessionStorage.setItem(SS_PW, entered); } catch (err) {}
        unlock();
      } else {
        qs("#gateError").textContent = "Incorrect password.";
      }
    });
  }

  /* ---------------- Load content into form ---------------- */
  var BUDGET_ROWS = 0;

  function renderBudgetRows(items) {
    var container = qs("#budgetRows");
    container.innerHTML = "";
    BUDGET_ROWS = items.length;
    items.forEach(function (item, i) {
      var row = document.createElement("div");
      row.className = "budget-row-edit";
      row.innerHTML =
        '<input type="text" id="f_budget_item_' + i + '_label" placeholder="Item label">' +
        '<input type="number" id="f_budget_item_' + i + '_amount" placeholder="Amount ₹">';
      container.appendChild(row);
      setVal("f_budget_item_" + i + "_label", item.label);
      setVal("f_budget_item_" + i + "_amount", item.amount);
    });
  }

  async function fetchCurrentContent() {
    try {
      var res = await fetch("/api/content", { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (e) {}
    try {
      var res2 = await fetch("content.json", { cache: "no-store" });
      if (res2.ok) return await res2.json();
    } catch (e2) {}
    return null;
  }

  function populateForm(d) {
    var c = d.campaign || {}, legal = d.legal || {}, contact = d.contact || {}, payment = d.payment || {};
    setVal("f_campaign_trustName", c.trustName);
    setVal("f_campaign_schoolName", c.schoolName);
    setVal("f_campaign_location", c.location);
    setVal("f_campaign_goalAmount", c.goalAmount);
    setVal("f_campaign_raisedAmount", c.raisedAmount);
    setVal("f_campaign_donorCount", c.donorCount);
    setVal("f_campaign_childrenCount", c.childrenCount);
    setVal("f_campaign_classroomCount", c.classroomCount);
    setVal("f_campaign_teacherCount", c.teacherCount);
    setVal("f_campaign_villageCount", c.villageCount);

    renderBudgetRows((d.budget && d.budget.items) || []);
    setVal("f_budget_budgetPdfUrl", d.budget && d.budget.budgetPdfUrl);

    setChecked("f_legal_registeredTrust", legal.registeredTrust);
    setChecked("f_legal_has12A", legal.has12A);
    setChecked("f_legal_has80G", legal.has80G);
    setChecked("f_legal_hasCSR1", legal.hasCSR1);
    setChecked("f_legal_hasFCRA", legal.hasFCRA);
    setChecked("f_legal_hasAuditedReports", legal.hasAuditedReports);
    setVal("f_legal_registrationNo", legal.registrationNo);
    setVal("f_legal_cert80G", legal.cert80G);
    setVal("f_legal_pan", legal.pan);

    setVal("f_contact_email", contact.email);
    setVal("f_contact_phone", contact.phone);
    setVal("f_contact_whatsapp", contact.whatsapp);
    setVal("f_contact_address", contact.address);

    setVal("f_payment_gatewayUrl", payment.gatewayUrl);
    setVal("f_payment_upiId", payment.upiId);
    setVal("f_payment_bankAccountName", payment.bankAccountName);
    setVal("f_payment_bankAccountNumber", payment.bankAccountNumber);
    setVal("f_payment_bankIfsc", payment.bankIfsc);
    setVal("f_payment_bankName", payment.bankName);

    qs("#lastSaved").textContent = (d.meta && d.meta.lastUpdated) ? new Date(d.meta.lastUpdated).toLocaleString() : "never";
  }

  async function loadIntoForm() {
    showBanner("Loading current content…", "ok");
    var data = await fetchCurrentContent();
    if (!data) { showBanner("Could not load existing content — starting blank.", "warn"); data = { campaign: {}, budget: { items: [] }, legal: {}, contact: {}, payment: {} }; }
    populateForm(data);
    qs("#statusBanner").classList.remove("is-visible");
  }

  /* ---------------- Collect form into content object ---------------- */
  function collectForm() {
    var items = [];
    for (var i = 0; i < BUDGET_ROWS; i++) {
      items.push({ label: val("f_budget_item_" + i + "_label"), amount: num("f_budget_item_" + i + "_amount") });
    }
    return {
      campaign: {
        trustName: val("f_campaign_trustName"),
        schoolName: val("f_campaign_schoolName"),
        location: val("f_campaign_location"),
        goalAmount: num("f_campaign_goalAmount"),
        raisedAmount: num("f_campaign_raisedAmount"),
        donorCount: num("f_campaign_donorCount"),
        childrenCount: num("f_campaign_childrenCount"),
        classroomCount: num("f_campaign_classroomCount"),
        teacherCount: num("f_campaign_teacherCount"),
        villageCount: num("f_campaign_villageCount")
      },
      budget: { items: items, budgetPdfUrl: val("f_budget_budgetPdfUrl") },
      legal: {
        registeredTrust: checked("f_legal_registeredTrust"),
        has12A: checked("f_legal_has12A"),
        has80G: checked("f_legal_has80G"),
        hasCSR1: checked("f_legal_hasCSR1"),
        hasFCRA: checked("f_legal_hasFCRA"),
        hasAuditedReports: checked("f_legal_hasAuditedReports"),
        registrationNo: val("f_legal_registrationNo"),
        cert80G: val("f_legal_cert80G"),
        pan: val("f_legal_pan")
      },
      contact: {
        email: val("f_contact_email"),
        phone: val("f_contact_phone"),
        whatsapp: val("f_contact_whatsapp"),
        address: val("f_contact_address")
      },
      payment: {
        gatewayUrl: val("f_payment_gatewayUrl"),
        upiId: val("f_payment_upiId"),
        bankAccountName: val("f_payment_bankAccountName"),
        bankAccountNumber: val("f_payment_bankAccountNumber"),
        bankIfsc: val("f_payment_bankIfsc"),
        bankName: val("f_payment_bankName")
      }
    };
  }

  /* ---------------- Actions ---------------- */
  function initActions() {
    qs("#btnReload").addEventListener("click", loadIntoForm);

    qs("#btnPreview").addEventListener("click", function () {
      var content = collectForm();
      try {
        localStorage.setItem(LS_ADMIN_DRAFT, JSON.stringify(content));
        showBanner("Saved as a local preview. Open the live page in this same browser to see it — other visitors won't see this until you click \"Publish live\".", "warn");
      } catch (e) {
        showBanner("Could not save preview: " + e.message, "err");
      }
    });

    qs("#btnPublish").addEventListener("click", async function () {
      var content = collectForm();
      var password = (function () { try { return sessionStorage.getItem(SS_PW); } catch (e) { return null; } })();
      showBanner("Publishing…", "ok");
      try {
        var res = await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password, content: content })
        });
        var out = await res.json();
        if (res.status === 401) {
          showBanner("Incorrect password on the server side — re-enter the admin password.", "err");
          try { sessionStorage.removeItem(SS_PW); } catch (e) {}
          qs("#adminWrap").classList.remove("is-visible");
          qs("#gateScreen").style.display = "flex";
          return;
        }
        if (out.success) {
          try { localStorage.removeItem(LS_ADMIN_DRAFT); } catch (e) {}
          showBanner("Published! This is now live for all visitors.", "ok");
          qs("#lastSaved").textContent = new Date().toLocaleString();
        } else {
          try { localStorage.setItem(LS_ADMIN_DRAFT, JSON.stringify(content)); } catch (e) {}
          showBanner((out.error || "Could not publish.") , "warn");
        }
      } catch (err) {
        try { localStorage.setItem(LS_ADMIN_DRAFT, JSON.stringify(content)); } catch (e) {}
        showBanner("Could not reach the server API (is this deployed on Vercel?). Saved as a local preview instead.", "err");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initGate();
    initActions();
  });
})();
