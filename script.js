(function () {
  "use strict";

  /* ---------------- Utilities ---------------- */
  var LS_NAME = "sanvi_donor_name";
  var LS_PERSONA = "sanvi_donor_persona";
  var LS_SPONSORED = "sanvi_my_sponsored_room"; // demo-only, front-end persistence
  var LS_ADMIN_DRAFT = "sanvi_admin_draft"; // unpublished admin preview, this browser only

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function fmtINR(n) { return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN"); }
  function fmtShort(n) {
    n = Number(n) || 0;
    if (n >= 100000) {
      var lakhs = n / 100000;
      return "₹" + (lakhs % 1 === 0 ? lakhs : lakhs.toFixed(1)) + "L";
    }
    return fmtINR(n);
  }

  function getUrlName() {
    try {
      var params = new URLSearchParams(window.location.search);
      var n = params.get("name");
      return n ? n.trim().slice(0, 40) : null;
    } catch (e) { return null; }
  }
  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  function isPlainObject(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function deepMerge(target, source) {
    if (!isPlainObject(source)) return target;
    Object.keys(source).forEach(function (key) {
      if (isPlainObject(target[key]) && isPlainObject(source[key])) {
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
    return target;
  }

  /* ---------------- Default content (last-resort fallback) ---------------- */
  var DEFAULT_CONTENT = {
    campaign: {
      trustName: "Sanvi Educational Trust", schoolName: "Sanvi School", location: "Puducherry",
      goalAmount: 5000000, raisedAmount: 1850000, donorCount: 312,
      villageCount: 6, childrenCount: 500, classroomCount: 10, teacherCount: 28
    },
    budget: {
      items: [
        { label: "Foundation & structure (RCC)", amount: 180000 },
        { label: "Roofing & flooring", amount: 95000 },
        { label: "Windows, doors & ventilation", amount: 55000 },
        { label: "Electrical wiring & fans", amount: 40000 },
        { label: "Desks, benches & blackboard", amount: 65000 },
        { label: "Paint, finishing & signage", amount: 35000 },
        { label: "Skilled & local labour", amount: 30000 }
      ],
      budgetPdfUrl: "#"
    },
    legal: {
      registeredTrust: false, has12A: false, has80G: false, hasCSR1: false,
      hasFCRA: false, hasAuditedReports: false,
      registrationNo: "", cert80G: "", pan: ""
    },
    contact: { email: "", phone: "", whatsapp: "", address: "" },
    payment: { gatewayUrl: "#", upiId: "", bankAccountName: "", bankAccountNumber: "", bankIfsc: "", bankName: "" }
  };

  var pageContent = null; // populated by loadContent()

  async function loadContent() {
    var data = JSON.parse(JSON.stringify(DEFAULT_CONTENT));
    try {
      var res = await fetch("/api/content", { cache: "no-store" });
      if (res.ok) deepMerge(data, await res.json());
    } catch (e) {
      try {
        var res2 = await fetch("content.json", { cache: "no-store" });
        if (res2.ok) deepMerge(data, await res2.json());
      } catch (e2) { /* fall through to defaults */ }
    }
    try {
      var draft = safeGet(LS_ADMIN_DRAFT);
      if (draft) deepMerge(data, JSON.parse(draft));
    } catch (e) {}
    return data;
  }

  /* ---------------- Render content.json-driven sections ---------------- */
  function setText(sel, text) { var el = qs(sel); if (el) el.textContent = text; }
  function setHref(sel, href) { var el = qs(sel); if (el) el.setAttribute("href", href); }

  function renderTrustPills(legal) {
    var row = qs("#heroTrustRow");
    if (!row) return;
    var pills = [];
    if (legal.registeredTrust) pills.push("✓ Registered Public Trust");
    if (legal.has80G) pills.push("✓ 80G Tax Exemption");
    if (legal.has12A) pills.push("✓ 12A Registered");
    if (legal.hasCSR1) pills.push("✓ CSR-1 Registered");
    if (legal.hasAuditedReports) pills.push("✓ Annual Audited Reports");
    if (!legal.hasFCRA) pills.push("🇮🇳 Indian Donors Only");
    row.innerHTML = pills.map(function (p) { return '<span class="trust-pill">' + p + "</span>"; }).join("");
  }

  function renderBudget(budget, campaign) {
    var card = qs("#budgetCard");
    if (!card) return;
    var items = budget.items || [];
    var perClassroom = items.reduce(function (sum, it) { return sum + (Number(it.amount) || 0); }, 0);
    var rows = items.map(function (it) {
      return '<div class="budget-row"><span>' + it.label + "</span><b>" + fmtINR(it.amount) + "</b></div>";
    }).join("");
    card.innerHTML = rows +
      '<div class="budget-total"><span>Cost per classroom × ' + (campaign.classroomCount || 1) +
      "</span><b>" + fmtINR(campaign.goalAmount != null ? campaign.goalAmount : perClassroom * (campaign.classroomCount || 1)) + "</b></div>";
    return perClassroom;
  }

  function renderContent(data) {
    pageContent = data;
    var c = data.campaign, legal = data.legal, contact = data.contact;

    renderTrustPills(legal);

    var percent = c.goalAmount ? Math.min(100, Math.round((c.raisedAmount / c.goalAmount) * 100)) : 0;
    var remaining = Math.max(0, (c.goalAmount || 0) - (c.raisedAmount || 0));

    setText("#heroCardRaised", fmtINR(c.raisedAmount));
    setText("#heroCardGoal", fmtINR(c.goalAmount));
    setText("#progressPercentText", percent + "% funded");
    setText("#progressRemainingText", fmtINR(remaining) + " to go");
    var fill = qs("#heroProgressFill");
    if (fill) fill.setAttribute("data-target", String(percent));

    setText("#heroStatRaisedShort", fmtShort(c.raisedAmount));
    setText("#heroStatGoalLabel", "raised of " + fmtShort(c.goalAmount) + " goal");
    setText("#heroStatDonors", String(c.donorCount));
    setText("#heroStatVillages", String(c.villageCount));

    var bindCount = function (sel, val) {
      var el = qs(sel);
      if (el) { el.setAttribute("data-count", String(val || 0)); el.textContent = "0"; }
    };
    bindCount("#statChildren", c.childrenCount);
    bindCount("#statClassrooms", c.classroomCount);
    bindCount("#statTeachers", c.teacherCount);
    bindCount("#statVillages", c.villageCount);

    var perClassroom = renderBudget(data.budget, c);
    setHref("#budgetPdfLink", data.budget.budgetPdfUrl || "#");

    var classroomCost = perClassroom || Math.round((c.goalAmount || 0) / (c.classroomCount || 1));
    setText("#tierClassroomAmount", fmtINR(classroomCost));
    var tierBtn = qs("#tierClassroomBtn");
    if (tierBtn) tierBtn.setAttribute("data-amount", String(classroomCost));
    var tierCard = qs("#tierClassroomCard");
    if (tierCard) tierCard.setAttribute("data-amount", String(classroomCost));

    setText("#finalRemainingText", fmtINR(remaining) + " still stands between these children and a safe, permanent place to learn. Join " + c.donorCount + " donors who've already said yes.");

    var founderLine = qs("#founderContactLine");
    if (founderLine) {
      founderLine.textContent = contact.phone
        ? "Prefer to talk it through first? Call or WhatsApp " + contact.phone + " — many of our larger donors do."
        : "";
    }

    setText("#footerRegNo", "Reg. No. — " + (legal.registrationNo || "pending"));
    setText("#footerCert80G", legal.has80G ? "80G Certificate No. — " + (legal.cert80G || "—") : "80G Certificate — pending");
    setText("#footerPan", "PAN — " + (legal.pan || "pending"));
    setText("#footerTrustName", c.trustName || "Sanvi Educational Trust");

    var emailEl = qs("#footerEmail");
    if (emailEl) { emailEl.textContent = contact.email || "—"; emailEl.setAttribute("href", contact.email ? "mailto:" + contact.email : "#"); }
    var phoneEl = qs("#footerPhone");
    if (phoneEl) { phoneEl.textContent = contact.phone || "—"; phoneEl.setAttribute("href", contact.phone ? "tel:" + contact.phone.replace(/\s+/g, "") : "#"); }
    var addrEl = qs("#footerAddress");
    if (addrEl) addrEl.textContent = contact.address || "—";

    var submitBtn = qs("#submitDonation");
    if (submitBtn) submitBtn.setAttribute("data-gateway-url", (data.payment && data.payment.gatewayUrl) || "#");

    applyPersonalization();
  }

  /* ---------------- Personalization state ---------------- */
  var PERSONA_CONTENT = {
    individual: {
      heroSubTpl: "{trust} is raising {goal} to construct {n} permanent classrooms — replacing tin-roof sheds where children currently study through monsoons and summers.",
      tiersHeadline: "Choose what feels right for you",
      tiersSub: "Every amount, big or small, moves a classroom closer to completion.",
      quote: "\"I donated ₹5,000 after seeing the plan — six months later I visited and saw my name on classroom 4's plaque with my daughter. It's the best gift I've given.\"",
      person: "Rukhsar Fatima", role: "Individual donor, Bengaluru",
      modalSub: "Every classroom funded is one step closer. Thank you for showing up for these kids."
    },
    alumni: {
      heroSubTpl: "You once sat in a classroom like these. Help us give today's students the permanent, monsoon-proof classrooms your batch never had — and put your school years on a plaque that lasts.",
      tiersHeadline: "Give back to where it started",
      tiersSub: "Many alumni sponsor in their batch's name — ask us about a 'Batch of 20XX' classroom plaque.",
      quote: "\"Our batch of 1998 pooled together and sponsored classroom 7. Seeing 'Batch of 1998' on that plaque means more to us than any reunion ever has.\"",
      person: "Alumni Batch of 1998", role: "Group donors, Hyderabad",
      modalSub: "Alumni gifts can be pooled under one batch name — just add a note after donating and our team will combine it."
    },
    corporate: {
      heroSubTpl: "This campaign qualifies under Schedule VII of the Companies Act for CSR spend on education. Fund one classroom fully, or co-fund several, with your company's name on each plaque and a formal MOU.",
      tiersHeadline: "CSR-eligible giving tiers",
      tiersSub: "All tiers are eligible under Schedule VII (Education). Request a CSR proposal PDF after selecting an amount.",
      quote: "\"We sponsored 2 classrooms as part of our FY24 CSR budget. The utilization report and audited receipts made our compliance review painless.\"",
      person: "CSR Lead, Mid-size IT firm", role: "Corporate donor, Pune",
      modalSub: "For CSR, select Corporate below — our team will follow up with a formal proposal, MOU, and compliance documents."
    },
    memory: {
      heroSubTpl: "Honour someone who mattered to you with something that lasts — a classroom built, a plaque named, and {n} classrooms' worth of children who'll learn under that name for decades.",
      tiersHeadline: "Give in memory, give forever",
      tiersSub: "Any tier can carry a memorial inscription — 'In loving memory of ___' — on the plaque or donor wall.",
      quote: "\"We sponsored a classroom in memory of our father, a teacher himself. Knowing children will learn in 'his' room every single day means everything to our family.\"",
      person: "The Mehta Family", role: "Memorial donors, Ahmedabad",
      modalSub: "Add the name to be memorialised in the donor name field — it will appear on the plaque exactly as entered."
    }
  };

  var currentPersona = safeGet(LS_PERSONA) || "individual";
  var currentName = getUrlName() || safeGet(LS_NAME) || "";
  if (getUrlName()) safeSet(LS_NAME, currentName);

  function applyPersonalization() {
    if (!pageContent) return;
    var c = pageContent.campaign;
    var content = PERSONA_CONTENT[currentPersona] || PERSONA_CONTENT.individual;
    var greetingName = currentName ? currentName : null;

    var headlineEl = qs("#heroHeadline");
    if (headlineEl) {
      headlineEl.innerHTML = greetingName
        ? greetingName + ", help give <span class=\"accent\">" + c.childrenCount + " children</span> a real classroom to learn in."
        : "Give <span class=\"accent\">" + c.childrenCount + " children</span> a real classroom to learn in.";
    }
    var heroSub = content.heroSubTpl
      .replace("{trust}", c.trustName)
      .replace("{goal}", fmtINR(c.goalAmount))
      .replace("{n}", c.classroomCount);
    setText("#heroSub", heroSub);
    setText("#tiersHeadline", content.tiersHeadline);
    setText("#tiersSub", content.tiersSub);
    setText("#testiQuote", content.quote);
    setText("#testiPerson", content.person);
    setText("#testiRole", content.role);
    setText("#modalSub", content.modalSub);

    var finalHeadline = qs("#finalHeadline");
    if (finalHeadline) {
      finalHeadline.textContent = greetingName
        ? greetingName + ", your classroom is waiting to be built."
        : "Your classroom is waiting to be built.";
    }

    var chip = qs("#donorChip");
    if (chip) {
      if (greetingName) { chip.style.display = "inline-flex"; chip.textContent = "👋 Welcome back, " + greetingName; }
      else chip.style.display = "none";
    }

    qsa(".persona-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-persona") === currentPersona);
    });
  }

  /* ---------------- Persona bar ---------------- */
  function initPersonaBar() {
    var nameInput = qs("#donorNameInput");
    if (nameInput) {
      nameInput.value = currentName;
      nameInput.addEventListener("input", function () {
        currentName = nameInput.value.trim().slice(0, 40);
        safeSet(LS_NAME, currentName);
        applyPersonalization();
        updateCertificatePreview();
      });
    }
    qsa(".persona-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentPersona = btn.getAttribute("data-persona");
        safeSet(LS_PERSONA, currentPersona);
        applyPersonalization();
      });
    });
  }

  /* ---------------- Counters ---------------- */
  function initCounters() {
    var items = qsa("[data-count]");
    if (!items.length) return;
    var done = false;
    function animate() {
      if (done) return;
      done = true;
      items.forEach(function (el) {
        var target = parseInt(el.getAttribute("data-count"), 10) || 0;
        var duration = 900, startTime = null;
        function step(ts) {
          if (!startTime) startTime = ts;
          var progress = Math.min((ts - startTime) / duration, 1);
          el.textContent = Math.floor(0 + target * progress);
          if (progress < 1) requestAnimationFrame(step);
          else el.textContent = target;
        }
        requestAnimationFrame(step);
      });
    }
    var strip = qs(".stats-strip");
    if ("IntersectionObserver" in window && strip) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) { animate(); obs.disconnect(); } });
      }, { threshold: 0.3 });
      obs.observe(strip);
    } else { animate(); }
  }

  function initHeroProgress() {
    var fill = qs("#heroProgressFill");
    if (!fill) return;
    requestAnimationFrame(function () {
      setTimeout(function () { fill.style.width = (fill.getAttribute("data-target") || "0") + "%"; }, 150);
    });
  }

  /* ---------------- Classroom sponsorship grid ---------------- */
  var MOCK_SPONSORED = { 2: "Rukhsar Fatima", 6: "The Mehta Family" }; // placeholder social proof

  function getMySponsoredRoom() {
    var raw = safeGet(LS_SPONSORED);
    return raw ? parseInt(raw, 10) : null;
  }

  function classroomCostValue() {
    var tierBtn = qs("#tierClassroomBtn");
    return (tierBtn && parseInt(tierBtn.getAttribute("data-amount"), 10)) || 500000;
  }

  function renderClassroomGrid() {
    var grid = qs("#classroomGrid");
    if (!grid || !pageContent) return;
    var count = pageContent.campaign.classroomCount || 10;
    var mine = getMySponsoredRoom();
    var html = "";
    for (var i = 1; i <= count; i++) {
      var sponsoredName = MOCK_SPONSORED[i];
      var isMine = mine === i;
      var cls = "classroom-card" + (isMine ? " is-mine" : sponsoredName ? " is-sponsored" : "");
      var status = isMine ? "Reserved by you" : sponsoredName ? "Sponsored by " + sponsoredName : "Available";
      html += '<div class="' + cls + '" data-room="' + i + '" tabindex="0" role="button" aria-label="Classroom ' + i + ", " + status + '">' +
        '<div class="room-ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 10l9-6 9 6-9 6-9-6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 12.5V18c0 1.1 2.7 2 6 2s6-.9 6-2v-5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>' +
        "<h4>Classroom " + i + "</h4>" +
        '<div class="room-status">' + status + "</div></div>";
    }
    grid.innerHTML = html;

    qsa(".classroom-card", grid).forEach(function (card) {
      card.addEventListener("click", function () {
        var room = parseInt(card.getAttribute("data-room"), 10);
        if (MOCK_SPONSORED[room]) return;
        openModal({ amount: classroomCostValue(), room: room });
      });
      card.addEventListener("keypress", function (e) { if (e.key === "Enter") card.click(); });
    });
  }

  /* ---------------- FAQ accordion ---------------- */
  function initFaq() {
    qsa(".faq-item").forEach(function (item) {
      var q = qs(".faq-q", item);
      q.addEventListener("click", function () {
        var wasOpen = item.classList.contains("is-open");
        qsa(".faq-item").forEach(function (i) { i.classList.remove("is-open"); });
        if (!wasOpen) item.classList.add("is-open");
      });
    });
  }

  /* ---------------- Mobile drawer ---------------- */
  function initMobileDrawer() {
    var drawer = qs("#mobileDrawer");
    var toggle = qs("#navToggle");
    var close = qs("#drawerClose");
    if (!drawer || !toggle) return;
    toggle.addEventListener("click", function () { drawer.classList.add("is-open"); });
    if (close) close.addEventListener("click", function () { drawer.classList.remove("is-open"); });
    drawer.addEventListener("click", function (e) { if (e.target === drawer) drawer.classList.remove("is-open"); });
    qsa("a", drawer).forEach(function (a) { a.addEventListener("click", function () { drawer.classList.remove("is-open"); }); });
  }

  /* ---------------- Donation modal ---------------- */
  var modalState = { amount: 5000, room: null };

  function updateCertificatePreview() {
    var preview = qs("#certPreview");
    var nameEl = qs("#certName");
    var subEl = qs("#certSub");
    if (!preview) return;
    if (modalState.room) {
      preview.classList.add("is-visible");
      var name = (qs("#modalName") && qs("#modalName").value.trim()) || currentName || "Your Name Here";
      nameEl.textContent = name;
      subEl.textContent = "will appear on the plaque of Classroom #" + modalState.room;
    } else {
      preview.classList.remove("is-visible");
    }
  }

  function setActiveAmountChip(amount) {
    qsa(".amount-chip").forEach(function (chip) {
      chip.classList.toggle("is-active", parseInt(chip.getAttribute("data-val"), 10) === amount);
    });
    var custom = qs("#customAmount");
    if (custom) custom.value = "";
  }

  function openModal(opts) {
    opts = opts || {};
    modalState.amount = opts.amount || 5000;
    modalState.room = opts.room || null;

    var overlay = qs("#modalOverlay");
    var formView = qs("#formView");
    var thankView = qs("#thankyouView");
    if (!overlay) return;
    formView.style.display = "block";
    thankView.classList.remove("is-visible");

    setActiveAmountChip(modalState.amount);
    var nameField = qs("#modalName");
    if (nameField && currentName) nameField.value = currentName;

    updateCertificatePreview();
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    var overlay = qs("#modalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function initModal() {
    qsa("[data-open-modal]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var amt = btn.getAttribute("data-amount");
        openModal({ amount: amt ? parseInt(amt, 10) : 5000 });
      });
    });

    var overlay = qs("#modalOverlay");
    var closeBtn = qs("#modalClose");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (overlay) overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

    qsa(".amount-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        modalState.amount = parseInt(chip.getAttribute("data-val"), 10);
        setActiveAmountChip(modalState.amount);
      });
    });

    var customAmount = qs("#customAmount");
    if (customAmount) {
      customAmount.addEventListener("input", function () {
        if (customAmount.value) {
          modalState.amount = parseInt(customAmount.value, 10) || 0;
          qsa(".amount-chip").forEach(function (c) { c.classList.remove("is-active"); });
        }
      });
    }

    var modalName = qs("#modalName");
    if (modalName) modalName.addEventListener("input", updateCertificatePreview);

    var submitBtn = qs("#submitDonation");
    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        var name = qs("#modalName").value.trim();
        var email = qs("#modalEmail").value.trim();
        if (!name || !email) { alert("Please enter your name and email to continue."); return; }
        if (!modalState.amount || modalState.amount < 1) { alert("Please select or enter a donation amount."); return; }

        // EDIT (via Admin > Payment gateway URL): this demo simulates success.
        // To go live, point #submitDonation's data-gateway-url at your Razorpay/
        // Instamojo checkout (or embed their widget here) and redirect/charge
        // with { name, email, amount: modalState.amount } before showing thanks.
        safeSet(LS_NAME, name);
        currentName = name;
        if (modalState.room) safeSet(LS_SPONSORED, String(modalState.room));

        qs("#formView").style.display = "none";
        var thankView = qs("#thankyouView");
        thankView.classList.add("is-visible");
        qs("#thankyouHeadline").textContent = "Thank you, " + name.split(" ")[0] + "!";
        qs("#thankyouBody").textContent = modalState.room
          ? "Your pledge of " + fmtINR(modalState.amount) + " is reserved for Classroom #" + modalState.room + ". (Demo preview — connect a payment gateway to collect real payments.)"
          : "Your pledge of " + fmtINR(modalState.amount) + " has been recorded. (Demo preview — connect a payment gateway to collect real payments.)";

        applyPersonalization();
        if (modalState.room) renderClassroomGrid();
      });
    }

    var thankClose = qs("#thankyouClose");
    if (thankClose) thankClose.addEventListener("click", closeModal);
  }

  /* ---------------- Init ---------------- */
  document.addEventListener("DOMContentLoaded", async function () {
    var yearEl = qs("#year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    var data = await loadContent();
    renderContent(data);

    initPersonaBar();
    initCounters();
    initHeroProgress();
    renderClassroomGrid();
    initFaq();
    initMobileDrawer();
    initModal();
  });
})();
