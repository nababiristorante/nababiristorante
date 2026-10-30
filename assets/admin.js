
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const loginView = $("#login-view");
  const adminApp = $("#admin-app");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const pageContent = $("#page-content");
  const pageTitle = $("#page-title");

  let db = null;
  let currentUser = null;

  const CONFIG = window.SUPABASE_CONFIG || window.supabaseConfig || {};
  const SUPABASE_URL =
    CONFIG.url ||
    window.SUPABASE_URL ||
    window.supabaseUrl;

  const SUPABASE_KEY =
    CONFIG.anonKey ||
    CONFIG.key ||
    window.SUPABASE_ANON_KEY ||
    window.supabaseAnonKey;

  function message(text, type = "info") {
    let box = $("#admin-message");

    if (!box) {
      box = document.createElement("div");
      box.id = "admin-message";
      box.style.cssText =
        "padding:12px;margin:12px 0;border-radius:8px;font-size:14px;";
      pageContent?.prepend(box);
    }

    box.textContent = text;
    box.style.background =
      type === "error" ? "#fde8e8" : "#e8f5eb";
    box.style.color =
      type === "error" ? "#a21d1d" : "#176b38";
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function showLogin() {
    loginView.hidden = false;
    adminApp.hidden = true;
  }

  function showAdmin() {
    loginView.hidden = true;
    adminApp.hidden = false;
  }

  function setupMobileStyles() {
    if ($("#admin-mobile-styles")) return;

    const style = document.createElement("style");
    style.id = "admin-mobile-styles";
    style.textContent = `
      * { box-sizing: border-box; }
      body { overflow-x: hidden; }
      .admin-main { min-width: 0; }
      #page-content { min-width: 0; overflow-wrap: anywhere; }
      #page-content input,
      #page-content textarea,
      #page-content select {
        max-width: 100%;
        font-size: 16px;
      }
      #page-content button,
      .sidebar button,
      #logout {
        min-height: 42px;
      }
      .admin-list-item,
      .staff-item,
      .content-card {
        max-width: 100%;
        overflow-wrap: anywhere;
      }
      @media(max-width:900px) {
        .admin-layout { display: block !important; }
        .sidebar {
          width: 100% !important;
          padding: 12px !important;
        }
        .sidebar nav {
          display: flex !important;
          gap: 5px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
        }
        .sidebar nav button {
          width: auto !important;
          flex: 0 0 auto;
          white-space: nowrap;
        }
        .admin-main { padding: 12px !important; }
        .stats { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
        .login-box { margin: 35px auto !important; }
      }
      @media(max-width:480px) {
        .stats { grid-template-columns: 1fr !important; }
        .admin-header { align-items: flex-start; }
        .stat-card, .content-card { padding: 14px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function initializeSupabase() {
    if (!window.supabase?.createClient) {
      throw new Error("Supabase library লোড হয়নি।");
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error(
        "assets/config.js-এ Supabase URL এবং Anon Key পাওয়া যায়নি।"
      );
    }

    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  async function verifyAdmin(userId) {
    const { data, error } = await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async function login(event) {
    event.preventDefault();
    loginError.textContent = "";

    const form = new FormData(loginForm);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const allowed = await verifyAdmin(data.user.id);

      if (!allowed) {
        await db.auth.signOut();
        throw new Error("এই অ্যাকাউন্টের Admin অনুমতি নেই।");
      }

      currentUser = data.user;
      showAdmin();
      await loadDashboard();
    } catch (error) {
      loginError.textContent =
        error.message || "Login করা যায়নি।";
    }
  }

  async function logout() {
    if (db) await db.auth.signOut();
    currentUser = null;
    showLogin();
  }

  async function restoreSession() {
    const { data } = await db.auth.getSession();
    const session = data?.session;

    if (!session?.user) {
      showLogin();
      return;
    }

    try {
      const allowed = await verifyAdmin(session.user.id);

      if (!allowed) {
        await db.auth.signOut();
        showLogin();
        return;
      }

      currentUser = session.user;
      showAdmin();
      await loadDashboard();
    } catch (error) {
      console.error(error);
      showLogin();
    }
  }

  function setPage(title, html) {
    pageTitle.textContent = title;
    pageContent.innerHTML = html;
  }

  function card(title, body) {
    return `
      <div class="content-card">
        <h2>${escapeHTML(title)}</h2>
        ${body}
      </div>
    `;
  }

  async function countRows(table) {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) return "—";
    return count ?? 0;
  }

  async function loadDashboard() {
    setPage("Dashboard", `
      <div class="stats">
        <div class="stat-card">Customers<h2 id="stat-customers">…</h2></div>
        <div class="stat-card">Staff<h2 id="stat-staff">…</h2></div>
        <div class="stat-card">Bookings<h2>—</h2></div>
        <div class="stat-card">Coupons<h2 id="stat-coupons">…</h2></div>
      </div>
      ${card("Welcome to Nababi Ristorante",
        "<p>আপনার Restaurant Admin Panel-এ স্বাগতম।</p>")}
    `);

    const [customers, staff, coupons] = await Promise.all([
      countRows("customers"),
      countRows("staff"),
      countRows("coupons")
    ]);

    $("#stat-customers").textContent = customers;
    $("#stat-staff").textContent = staff;
    $("#stat-coupons").textContent = coupons;
  }

  async function loadStaff() {
    setPage("Staff Management", `
      ${card("Add Staff", `
        <form id="staff-form">
          <input name="full_name" placeholder="Staff Name" required>
          <input name="job_title" placeholder="Job Title">
          <input name="phone" placeholder="Phone">
          <button class="save-button" type="submit">Add Staff</button>
        </form>
      `)}
      ${card("Staff List", `<div id="staff-list">Loading...</div>`)}
    `);

    $("#staff-form").addEventListener("submit", addStaff);
    await renderStaffList();
  }

  async function addStaff(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const record = {
      full_name: String(form.get("full_name") || "").trim(),
      job_title: String(form.get("job_title") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      is_active: true
    };

    if (!record.full_name) {
      message("Staff-এর নাম লিখুন।", "error");
      return;
    }

    const { error } = await db.from("staff").insert(record);

    if (error) {
      message(error.message, "error");
      return;
    }

    message("Staff যোগ হয়েছে।");
    await renderStaffList();
    event.currentTarget.reset();
  }

  async function renderStaffList() {
    const list = $("#staff-list");
    if (!list) return;

    const { data, error } = await db
      .from("staff")
      .select("id,full_name,job_title,phone,photo_url,is_active,created_at,pin_updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      list.textContent = error.message;
      return;
    }

    if (!data?.length) {
      list.textContent = "এখনও কোনো Staff যোগ করা হয়নি।";
      return;
    }

    list.innerHTML = data.map(person => `
      <div class="content-card staff-item">
        <strong>${escapeHTML(person.full_name)}</strong>
        <p>${escapeHTML(person.job_title || "Staff")}</p>
        <p>${escapeHTML(person.phone || "")}</p>
        <p>Status: ${person.is_active ? "Active" : "Inactive"}</p>
        <p>PIN: ${person.pin_updated_at ? "Set করা আছে" : "Set করা হয়নি"}</p>
        <form class="pin-form" data-id="${escapeHTML(person.id)}">
          <input name="pin" type="password"
            inputmode="numeric" pattern="[0-9]{4,8}"
            minlength="4" maxlength="8"
            placeholder="নতুন ৪–৮ সংখ্যার PIN" required>
          <button class="save-button" type="submit">Set / Change PIN</button>
        </form>
      </div>
    `).join("");

    $$(".pin-form", list).forEach(form => {
      form.addEventListener("submit", setStaffPin);
    });
  }

  async function setStaffPin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const staffId = form.dataset.id;
    const pin = String(new FormData(form).get("pin") || "");

    if (!/^\d{4,8}$/.test(pin)) {
      message("PIN অবশ্যই ৪ থেকে ৮ সংখ্যার হতে হবে।", "error");
      return;
    }

    const { error } = await db.rpc("admin_set_staff_pin", {
      p_staff_id: staffId,
      p_pin: pin
    });

    form.reset();

    if (error) {
      message(error.message, "error");
      return;
    }

    message("Staff PIN সফলভাবে সেট হয়েছে।");
    await renderStaffList();
  }

  async function loadAttendance() {
    setPage("Staff Attendance", `
      ${card("Attendance Event History", `
        <p>সর্বশেষ ২০০টি Check-in / Check-out Event</p>
        <div id="attendance-list">Loading...</div>
      `)}
    `);

    const list = $("#attendance-list");

    const { data: events, error } = await db
      .from("staff_attendance_events")
      .select("id,staff_id,event_type,occurred_at,source")
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (error) {
      list.textContent = error.message;
      return;
    }

    if (!events?.length) {
      list.textContent = "এখনও Attendance Event নেই।";
      return;
    }

    const ids = [...new Set(events.map(item => item.staff_id))];

    const { data: people, error: peopleError } = await db
      .from("staff")
      .select("id,full_name")
      .in("id", ids);

    if (peopleError) {
      list.textContent = peopleError.message;
      return;
    }

    const names = new Map(
      (people || []).map(person => [person.id, person.full_name])
    );

    list.innerHTML = events.map(item => `
      <div class="content-card">
        <strong>${escapeHTML(names.get(item.staff_id) || "Unknown Staff")}</strong>
        <p>${item.event_type === "check_in" ? "Check In" : "Check Out"}</p>
        <p>${escapeHTML(new Date(item.occurred_at).toLocaleString())}</p>
        <small>Source: ${escapeHTML(item.source || "Unknown")}</small>
      </div>
    `).join("");
  }

  function placeholder(title, description) {
    setPage(title, card(title, `
      <p>${escapeHTML(description)}</p>
      <p>এই অংশটি চালু করতে সংশ্লিষ্ট Supabase Table ও Column যাচাই করতে হবে।</p>
    `));
  }

  const pages = {
    dashboard: loadDashboard,
    staff: loadStaff,
    attendance: loadAttendance,

    customers: () => placeholder("Customers", "Customer Management"),
    categories: () => placeholder("Categories", "Menu Categories"),
    performance: () => placeholder("Staff Performance", "Staff Performance"),
    activity: () => placeholder("Staff Activity Log", "Staff Activity History"),
    tables: () => placeholder("Tavolo", "Restaurant Tables"),
    coupons: () => placeholder("Coupon Manager", "Manage Coupons"),
    website: () => placeholder("Website ON/OFF", "Website Status"),
    delivery: () => placeholder("Food Delivery Link", "Delivery Settings"),
    hours: () => placeholder("Opening Hours", "Restaurant Opening Hours"),
    events: () => placeholder("Staff Event & Advice", "Staff Events and Advice"),
    messages: () => placeholder("Staff Message", "Staff Messages"),
    breaking: () => placeholder("Breaking News", "Website Announcements")
  };

  async function navigate(page) {
    const handler = pages[page];

    if (!handler) return;

    $$("#admin-nav button").forEach(button => {
      button.classList.toggle("active", button.dataset.page === page);
    });

    try {
      await handler();
    } catch (error) {
      console.error(error);
      message(error.message || "Page load করা যায়নি।", "error");
    }
  }

  function setupNavigation() {
    $("#admin-nav")?.addEventListener("click", event => {
      const button = event.target.closest("button[data-page]");
      if (button) navigate(button.dataset.page);
    });

    $("#logout")?.addEventListener("click", logout);
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      alert("PNG, JPG অথবা WEBP ছবি নির্বাচন করুন।");
      return;
    }

    const path = `admin-logo-${Date.now()}.${file.name.split(".").pop()}`;

    const { error } = await db.storage
      .from("site-assets")
      .upload(path, file, { upsert: true });

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = db.storage
      .from("site-assets")
      .getPublicUrl(path);

    const image = $("#admin-logo");
    const fallback = $("#admin-logo-fallback");

    image.src = data.publicUrl;
    image.hidden = false;
    fallback.hidden = true;

    alert("Logo upload হয়েছে।");
  }

  function setupLogo() {
    $("#change-logo")?.addEventListener("click", () => {
      $("#logo-file")?.click();
    });

    $("#logo-file")?.addEventListener("change", uploadLogo);
  }

  async function start() {
    setupMobileStyles();

    try {
      initializeSupabase();
      setupNavigation();
      setupLogo();

      loginForm?.addEventListener("submit", login);

      await restoreSession();

      db.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          currentUser = null;
          showLogin();
        }
      });
    } catch (error) {
      console.error(error);
      showLogin();

      if (loginError) {
        loginError.textContent = error.message;
      }
    }
  }

  start();
})();
