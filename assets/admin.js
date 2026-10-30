
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const loginView = $("#login-view");
  const adminApp = $("#admin-app");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const pageContent = $("#page-content");
  const pageTitle = $("#page-title");

  const CONFIG =
    window.SUPABASE_CONFIG ||
    window.NABABI_CONFIG ||
    window.supabaseConfig ||
    {};

  const SUPABASE_URL =
    CONFIG.url || CONFIG.SUPABASE_URL ||
    window.SUPABASE_URL || window.supabaseUrl;

  const SUPABASE_KEY =
    CONFIG.anonKey || CONFIG.SUPABASE_ANON_KEY ||
    CONFIG.key || window.SUPABASE_ANON_KEY ||
    window.supabaseAnonKey;

  const STORAGE_BUCKET = "site-assets";

  let db = null;
  let currentUser = null;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function notify(text, type = "success") {
    let box = $("#admin-message");

    if (!box) {
      box = document.createElement("div");
      box.id = "admin-message";
      box.style.cssText =
        "padding:12px;margin:12px 0;border-radius:8px;font-size:14px;";
      pageContent?.prepend(box);
    }

    box.textContent = text;
    box.style.background = type === "error" ? "#fde8e8" : "#e8f5eb";
    box.style.color = type === "error" ? "#a21d1d" : "#176b38";
  }

  function setupStyles() {
    if ($("#admin-mobile-styles")) return;

    const style = document.createElement("style");
    style.id = "admin-mobile-styles";
    style.textContent = `
      * { box-sizing:border-box; }
      body { overflow-x:hidden; }
      #page-content { min-width:0; overflow-wrap:anywhere; }
      #page-content input,
      #page-content textarea,
      #page-content select {
        max-width:100%; width:100%; padding:12px;
        margin:6px 0; border:1px solid #ddd;
        border-radius:7px; font:inherit; font-size:16px;
      }
      #page-content button {
        min-height:42px; cursor:pointer;
      }
      .staff-grid {
        display:grid;
        grid-template-columns:repeat(auto-fill,minmax(230px,1fr));
        gap:14px;
      }
      .staff-card {
        background:#fff; border:1px solid #eadff0;
        border-radius:12px; padding:15px; min-width:0;
      }
      .staff-photo {
        width:100%; height:190px; object-fit:cover;
        border-radius:9px; background:#eee;
      }
      .staff-photo-placeholder {
        width:100%; height:190px; border-radius:9px;
        background:#eee5f2; display:flex; align-items:center;
        justify-content:center; font-size:48px; color:#32134f;
      }
      .staff-actions {
        display:flex; flex-wrap:wrap; gap:7px; margin-top:12px;
      }
      .staff-actions button {
        border:0; border-radius:6px; padding:9px 12px;
        background:#32134f; color:#fff;
      }
      .staff-actions .danger { background:#a52b35; }
      .staff-actions .secondary { background:#6c6173; }
      .staff-form-actions {
        display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;
      }
      .staff-form-actions button {
        border:0; border-radius:7px; padding:12px 18px;
      }
      .staff-edit-panel {
        background:#faf6ed; border:1px solid #eadff0;
        padding:15px; border-radius:10px; margin:12px 0;
      }
      .staff-edit-panel[hidden] { display:none; }
      .staff-photo-preview {
        display:block; width:120px; height:120px;
        object-fit:cover; border-radius:9px; margin:8px 0;
        background:#eee;
      }
      @media(max-width:900px) {
        .admin-layout { display:block !important; }
        .sidebar { width:100% !important; padding:12px !important; }
        .sidebar nav {
          display:flex !important; gap:5px; overflow-x:auto;
          padding-bottom:8px; -webkit-overflow-scrolling:touch;
        }
        .sidebar nav button { width:auto !important; white-space:nowrap; }
        .admin-main { padding:12px !important; }
        .stats { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
      }
      @media(max-width:480px) {
        .stats { grid-template-columns:1fr !important; }
        .staff-grid { grid-template-columns:1fr; }
        .staff-photo, .staff-photo-placeholder { height:220px; }
      }
    `;
    document.head.appendChild(style);
  }

  function initializeSupabase() {
    if (!window.supabase?.createClient) {
      throw new Error("Supabase library লোড হয়নি।");
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("assets/config.js-এ Supabase URL বা Key পাওয়া যায়নি।");
    }

    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  function showLogin() {
    loginView.hidden = false;
    adminApp.hidden = true;
  }

  function showAdmin() {
    loginView.hidden = true;
    adminApp.hidden = false;
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

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email: String(form.get("email") || "").trim(),
        password: String(form.get("password") || "")
      });

      if (error) throw error;

      if (!(await verifyAdmin(data.user.id))) {
        await db.auth.signOut();
        throw new Error("এই অ্যাকাউন্টের Admin অনুমতি নেই।");
      }

      currentUser = data.user;
      showAdmin();
      await loadDashboard();
    } catch (error) {
      loginError.textContent = error.message || "Login করা যায়নি।";
    }
  }

  async function logout() {
    await db.auth.signOut();
    currentUser = null;
    showLogin();
  }

  function setPage(title, html) {
    pageTitle.textContent = title;
    pageContent.innerHTML = html;
  }

  function card(title, body) {
    return `<div class="content-card">
      <h2>${escapeHTML(title)}</h2>${body}
    </div>`;
  }

  async function countRows(table) {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true });

    return error ? "—" : (count ?? 0);
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

  // ছবি Storage-এ আপলোড করে Public URL ফেরত দেয়।
  async function uploadStaffPhoto(file, staffId) {
    if (!file) return null;

    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.type)) {
      throw new Error("শুধু JPG, PNG অথবা WEBP ছবি ব্যবহার করুন।");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("ছবির সাইজ ৫ MB-এর কম হতে হবে।");
    }

    const extension = file.type === "image/png" ? "png" :
      file.type === "image/webp" ? "webp" : "jpg";

    const path = `staff/${staffId}/${Date.now()}.${extension}`;

    const { error } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data } = db.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async function loadStaff() {
    setPage("Staff Management", `
      ${card("Add New Staff", `
        <form id="staff-form">
          <label>Staff Name</label>
          <input name="full_name" placeholder="Staff Name" required>

          <label>Job Title</label>
          <input name="job_title" placeholder="Chef / Waiter / Manager">

          <label>Phone</label>
          <input name="phone" type="tel" placeholder="Phone Number">

          <label>Staff Photo</label>
          <input name="photo" type="file"
            accept="image/png,image/jpeg,image/webp">

          <img id="new-photo-preview" class="staff-photo-preview"
            alt="Photo preview" hidden>

          <button class="save-button" type="submit">Add Staff</button>
        </form>
      `)}
      ${card("Staff List", `
        <div id="staff-list">Loading...</div>
      `)}
    `);

    const form = $("#staff-form");

    form.addEventListener("submit", addStaff);

    form.elements.photo.addEventListener("change", () => {
      previewPhoto(form.elements.photo.files[0], $("#new-photo-preview"));
    });

    await renderStaffList();
  }

  function previewPhoto(file, image) {
    if (!file || !image) return;

    if (image.dataset.previewUrl) {
      URL.revokeObjectURL(image.dataset.previewUrl);
    }

    const url = URL.createObjectURL(file);
    image.dataset.previewUrl = url;
    image.src = url;
    image.hidden = false;
  }

  async function addStaff(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const values = new FormData(form);

    const record = {
      full_name: String(values.get("full_name") || "").trim(),
      job_title: String(values.get("job_title") || "").trim(),
      phone: String(values.get("phone") || "").trim(),
      is_active: true
    };

    if (!record.full_name) {
      notify("Staff-এর নাম লিখুন।", "error");
      return;
    }

    const { data, error } = await db
      .from("staff")
      .insert(record)
      .select("id")
      .single();

    if (error) {
      notify(error.message, "error");
      return;
    }

    const file = form.elements.photo.files[0];

    if (file) {
      try {
        const photoUrl = await uploadStaffPhoto(file, data.id);

        const { error: updateError } = await db
          .from("staff")
          .update({ photo_url: photoUrl })
          .eq("id", data.id);

        if (updateError) throw updateError;
      } catch (uploadError) {
        notify(
          "Staff যোগ হয়েছে, কিন্তু ছবি আপলোড হয়নি: " + uploadError.message,
          "error"
        );
        await renderStaffList();
        return;
      }
    }

    notify("নতুন Staff সফলভাবে যোগ হয়েছে।");
    form.reset();
    $("#new-photo-preview").hidden = true;
    await renderStaffList();
  }

  async function renderStaffList() {
    const list = $("#staff-list");
    if (!list) return;

    list.textContent = "Loading...";

    const { data, error } = await db
      .from("staff")
      .select("id,full_name,job_title,phone,photo_url,is_active,created_at,pin_updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      list.textContent = error.message;
      return;
    }

    if (!data?.length) {
      list.innerHTML = "<p>এখনও কোনো Staff যোগ করা হয়নি।</p>";
      return;
    }

    list.innerHTML = `<div class="staff-grid">
      ${data.map(person => `
        <article class="staff-card">
          ${person.photo_url
            ? `<img class="staff-photo"
                src="${escapeHTML(person.photo_url)}"
                alt="${escapeHTML(person.full_name)}">`
            : `<div class="staff-photo-placeholder">👤</div>`
          }

          <h3>${escapeHTML(person.full_name)}</h3>
          <p>${escapeHTML(person.job_title || "Staff")}</p>
          <p>${escapeHTML(person.phone || "Phone নেই")}</p>
          <p><strong>Status:</strong>
            ${person.is_active ? "Active" : "Inactive"}
          </p>
          <p><strong>PIN:</strong>
            ${person.pin_updated_at ? "Set করা আছে" : "Set করা হয়নি"}
          </p>

          <div class="staff-actions">
            <button type="button" data-action="edit"
              data-id="${escapeHTML(person.id)}">Edit</button>

            <button type="button" class="secondary"
              data-action="toggle"
              data-id="${escapeHTML(person.id)}">
              ${person.is_active ? "Deactivate" : "Activate"}
            </button>

            <button type="button" class="danger"
              data-action="delete"
              data-id="${escapeHTML(person.id)}">Delete</button>
          </div>

          <form class="pin-form" data-id="${escapeHTML(person.id)}">
            <input name="pin" type="password"
              inputmode="numeric" pattern="[0-9]{4,8}"
              minlength="4" maxlength="8"
              placeholder="নতুন ৪–৮ সংখ্যার PIN" required>
            <button class="save-button" type="submit">
              Set / Change PIN
            </button>
          </form>

          <div class="staff-edit-panel"
            id="edit-${escapeHTML(person.id)}" hidden>
            <h3>Edit Staff</h3>

            <form class="edit-form" data-id="${escapeHTML(person.id)}">
              <label>Name</label>
              <input name="full_name"
                value="${escapeHTML(person.full_name)}" required>

              <label>Job Title</label>
              <input name="job_title"
                value="${escapeHTML(person.job_title || "")}">

              <label>Phone</label>
              <input name="phone"
                value="${escapeHTML(person.phone || "")}">

              <label>Change Photo</label>
              <input name="photo" type="file"
                accept="image/png,image/jpeg,image/webp">

              ${person.photo_url
                ? `<img class="staff-photo-preview"
                    src="${escapeHTML(person.photo_url)}"
                    alt="Current staff photo">`
                : ""
              }

              <div class="staff-form-actions">
                <button class="save-button" type="submit">Save Changes</button>
                <button type="button" class="secondary"
                  data-action="cancel"
                  data-id="${escapeHTML(person.id)}">Cancel</button>
              </div>
            </form>
          </div>
        </article>
      `).join("")}
    </div>`;

    $$(".pin-form", list).forEach(form => {
      form.addEventListener("submit", setStaffPin);
    });

    $$(".edit-form", list).forEach(form => {
      form.addEventListener("submit", saveStaffEdit);
    });

    list.addEventListener("click", handleStaffAction);
  }

  async function handleStaffAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "edit") {
      const panel = $(`#edit-${CSS.escape(id)}`);
      if (panel) panel.hidden = false;
      return;
    }

    if (action === "cancel") {
      const panel = $(`#edit-${CSS.escape(id)}`);
      if (panel) panel.hidden = true;
      return;
    }

    if (action === "toggle") {
      await toggleStaff(id);
      return;
    }

    if (action === "delete") {
      await deleteStaff(id);
    }
  }

  async function saveStaffEdit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const id = form.dataset.id;
    const values = new FormData(form);

    const record = {
      full_name: String(values.get("full_name") || "").trim(),
      job_title: String(values.get("job_title") || "").trim(),
      phone: String(values.get("phone") || "").trim()
    };

    if (!record.full_name) {
      notify("Staff-এর নাম লিখুন।", "error");
      return;
    }

    const file = form.elements.photo.files[0];

    try {
      if (file) {
        record.photo_url = await uploadStaffPhoto(file, id);
      }

      const { error } = await db
        .from("staff")
        .update(record)
        .eq("id", id);

      if (error) throw error;

      notify("Staff-এর তথ্য আপডেট হয়েছে।");
      await renderStaffList();
    } catch (error) {
      notify(error.message || "Update করা যায়নি।", "error");
    }
  }

  async function toggleStaff(id) {
    const { data, error } = await db
      .from("staff")
      .select("is_active,full_name")
      .eq("id", id)
      .single();

    if (error) {
      notify(error.message, "error");
      return;
    }

    const nextValue = !data.is_active;
    const { error: updateError } = await db
      .from("staff")
      .update({ is_active: nextValue })
      .eq("id", id);

    if (updateError) {
      notify(updateError.message, "error");
      return;
    }

    notify(nextValue ? "Staff Activate হয়েছে।" : "Staff Deactivate হয়েছে।");
    await renderStaffList();
  }

  async function deleteStaff(id) {
    const confirmed = confirm(
      "আপনি কি নিশ্চিত এই Staff-কে Delete করতে চান? এই কাজ ফিরিয়ে আনা নাও যেতে পারে।"
    );

    if (!confirmed) return;

    const { error } = await db
      .from("staff")
      .delete()
      .eq("id", id);

    if (error) {
      notify(
        "Delete করা যায়নি: " + error.message +
        " Attendance history-তে এই Staff-এর রেকর্ড থাকতে পারে।",
        "error"
      );
      return;
    }

    notify("Staff Delete হয়েছে।");
    await renderStaffList();
  }

  async function setStaffPin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const id = form.dataset.id;
    const pin = String(new FormData(form).get("pin") || "");

    if (!/^\d{4,8}$/.test(pin)) {
      notify("PIN অবশ্যই ৪ থেকে ৮ সংখ্যার হতে হবে।", "error");
      return;
    }

    const { error } = await db.rpc("admin_set_staff_pin", {
      p_staff_id: id,
      p_pin: pin
    });

    form.reset();

    if (error) {
      notify(error.message, "error");
      return;
    }

    notify("Staff PIN পরিবর্তন হয়েছে।");
    await renderStaffList();
  }

  async function loadAttendance() {
    setPage("Staff Attendance", card("Attendance Event History", `
      <p>সর্বশেষ ২০০টি Check-in / Check-out Event</p>
      <div id="attendance-list">Loading...</div>
    `));

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
      notify(error.message || "Page load করা যায়নি।", "error");
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

    try {
      const path = `admin-logo-${Date.now()}.${file.name.split(".").pop()}`;

      const { error } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      $("#admin-logo").src = data.publicUrl;
      $("#admin-logo").hidden = false;
      $("#admin-logo-fallback").hidden = true;

      alert("Logo upload হয়েছে।");
    } catch (error) {
      alert(error.message);
    }
  }

  function setupLogo() {
    $("#change-logo")?.addEventListener("click", () => {
      $("#logo-file")?.click();
    });

    $("#logo-file")?.addEventListener("change", uploadLogo);
  }

  async function restoreSession() {
    const { data } = await db.auth.getSession();
    const session = data?.session;

    if (!session?.user) {
      showLogin();
      return;
    }

    try {
      if (!(await verifyAdmin(session.user.id))) {
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

  async function start() {
    setupStyles();

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
