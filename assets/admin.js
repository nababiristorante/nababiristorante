
(() => {
  "use strict";

  // ==========================================
  // NABABI RISTORANTE - ADMIN PANEL
  // Supabase connection
  // ==========================================

  const config = window.NABABI_CONFIG;

  if (!window.supabase || !config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    alert("Supabase configuration পাওয়া যায়নি। assets/config.js পরীক্ষা করুন।");
    return;
  }

  const db = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );

  const $ = (selector) => document.querySelector(selector);

  const loginView = $("#login-view");
  const adminApp = $("#admin-app");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const pageTitle = $("#page-title");
  const pageContent = $("#page-content");
  const logoutButton = $("#logout");

  let currentUser = null;

  // ==========================================
  // COMMON HELPERS
  // ==========================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showMessage(message) {
    alert(message);
  }

  function setContent(title, html) {
    if (pageTitle) pageTitle.textContent = title;
    if (pageContent) pageContent.innerHTML = html;
  }

  function showLogin(message = "") {
    if (loginView) {
      loginView.hidden = false;
      loginView.style.display = "block";
    }

    if (adminApp) {
      adminApp.hidden = true;
      adminApp.style.display = "none";
    }

    if (loginError) loginError.textContent = message;
  }

  function showAdmin() {
    if (loginView) {
      loginView.hidden = true;
      loginView.style.display = "none";
    }

    if (adminApp) {
      adminApp.hidden = false;
      adminApp.style.display = "flex";
    }

    if (loginError) loginError.textContent = "";
  }

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function button(text, action, className = "") {
    return `<button type="button" class="${className}" data-action="${action}">${text}</button>`;
  }

  // ==========================================
  // ADMIN AUTHENTICATION
  // ==========================================

  async function checkAdmin(user) {
    if (!user) return false;

    const { data, error } = await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Admin verification:", error.message);
      return false;
    }

    return Boolean(data);
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (loginError) loginError.textContent = "Logging in...";

    const formData = new FormData(loginForm);

    const email =
      formData.get("email") ||
      loginForm.querySelector('[type="email"]')?.value;

    const password =
      formData.get("password") ||
      loginForm.querySelector('[type="password"]')?.value;

    if (!email || !password) {
      showLogin("Email এবং password লিখুন।");
      return;
    }

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showLogin(error.message);
      return;
    }

    const authorized = await checkAdmin(data.user);

    if (!authorized) {
      await db.auth.signOut();
      showLogin("এই অ্যাকাউন্ট Admin হিসেবে অনুমোদিত নয়।");
      return;
    }

    currentUser = data.user;
    showAdmin();
    await loadAdminLogo();
    await openPage("dashboard");
  }

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await db.auth.signOut();
      currentUser = null;
      showLogin("আপনি Logout করেছেন।");
    });
  }

  // ==========================================
  // RESTAURANT LOGO - LOAD AND UPLOAD
  // ==========================================

  async function loadAdminLogo() {
    const logo = $("#admin-logo");
    const fallback = $("#admin-logo-fallback");

    if (!logo) return;

    const { data, error } = await db
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "logo_url")
      .maybeSingle();

    if (error) {
      console.error("Logo loading error:", error.message);
      return;
    }

    const logoUrl = data?.setting_value;

    if (logoUrl) {
      logo.onload = () => {
        logo.hidden = false;
        if (fallback) fallback.hidden = true;
      };

      logo.onerror = () => {
        logo.hidden = true;
        if (fallback) fallback.hidden = false;
      };

      logo.src = logoUrl;
    } else {
      logo.hidden = true;
      if (fallback) fallback.hidden = false;
    }
  }

  async function uploadRestaurantLogo(file) {
    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      showMessage("PNG, JPG অথবা WEBP ছবি ব্যবহার করুন।");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showMessage("ছবির সাইজ সর্বোচ্চ 3 MB হতে পারবে।");
      return;
    }

    const changeButton = $("#change-logo");

    try {
      if (changeButton) {
        changeButton.disabled = true;
        changeButton.textContent = "Uploading...";
      }

      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      );

      const filePath =
        "logo/" + Date.now() + "-" + safeName;

      const { data: uploaded, error: uploadError } =
        await db.storage
          .from("site-assets")
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false
          });

      if (uploadError) throw uploadError;

      const { data: publicData } = db.storage
        .from("site-assets")
        .getPublicUrl(uploaded.path);

      const logoUrl = publicData.publicUrl;

      const { error: saveError } = await db
        .from("site_settings")
        .upsert({
          setting_key: "logo_url",
          setting_value: logoUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });

      if (saveError) throw saveError;

      await loadAdminLogo();

      showMessage("Restaurant logo uploaded successfully.");

    } catch (error) {
      console.error("Logo upload error:", error);
      showMessage("Logo upload failed: " + error.message);

    } finally {
      if (changeButton) {
        changeButton.disabled = false;
        changeButton.textContent = "Change Logo";
      }

      const fileInput = $("#logo-file");
      if (fileInput) fileInput.value = "";
    }
  }

  const changeLogoButton = $("#change-logo");
  const logoFileInput = $("#logo-file");

  if (changeLogoButton && logoFileInput) {
    changeLogoButton.addEventListener("click", () => {
      logoFileInput.click();
    });

    logoFileInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) uploadRestaurantLogo(file);
    });
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  async function loadDashboard() {
    setContent("Dashboard", `
      <div class="admin-dashboard">
        <div class="dashboard-card">
          <h3>Bookings</h3>
          <strong id="count-bookings">...</strong>
        </div>

        <div class="dashboard-card">
          <h3>Customers</h3>
          <strong id="count-customers">...</strong>
        </div>

        <div class="dashboard-card">
          <h3>Categories</h3>
          <strong id="count-categories">...</strong>
        </div>

        <div class="dashboard-card">
          <h3>Breaking News</h3>
          <strong id="count-news">...</strong>
        </div>
      </div>

      <h3>Benvenuto in Nababi Ristorante Admin</h3>
      <p>Manage your restaurant website from here.</p>
    `);

    const tables = [
      ["bookings", "count-bookings"],
      ["customers", "count-customers"],
      ["categories", "count-categories"],
      ["breaking_news", "count-news"]
    ];

    for (const [table, elementId] of tables) {
      const { count, error } = await db
        .from(table)
        .select("*", { count: "exact", head: true });

      const element = document.getElementById(elementId);

      if (element) {
        element.textContent = error ? "Error" : count;
      }
    }
  }

  // ==========================================
  // BREAKING NEWS + YOUTUBE VIDEO
  // ==========================================

  async function loadBreakingNews() {
    setContent("Breaking News & YouTube Video", `
      <form id="news-form" class="admin-form">
        <h3>Add Website Announcement / Video</h3>

        <label>Title</label>
        <input name="title" required placeholder="Announcement title">

        <label>Description</label>
        <textarea name="body" placeholder="Announcement text"></textarea>

        <label>YouTube Video URL</label>
        <input name="youtube_url" type="url"
          placeholder="https://www.youtube.com/watch?v=...">

        <label>Image URL (optional)</label>
        <input name="image_url" type="url" placeholder="Image URL">

        <label>Start date and time</label>
        <input name="starts_at" type="datetime-local">

        <label>End date and time</label>
        <input name="ends_at" type="datetime-local">

        <label>
          <input type="checkbox" name="is_active" checked>
          Active
        </label>

        <button type="submit">Save Announcement</button>
      </form>

      <hr>
      <h3>Saved Announcements</h3>
      <div id="news-list">Loading...</div>
    `);

    $("#news-form").addEventListener("submit", saveBreakingNews);
    await renderBreakingNews();
  }

  async function saveBreakingNews(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const values = new FormData(form);

    const record = {
      title: values.get("title"),
      body: values.get("body"),
      youtube_url: values.get("youtube_url") || null,
      image_url: values.get("image_url") || null,
      starts_at: values.get("starts_at")
        ? new Date(values.get("starts_at")).toISOString()
        : null,
      ends_at: values.get("ends_at")
        ? new Date(values.get("ends_at")).toISOString()
        : null,
      is_active: values.get("is_active") === "on"
    };

    const { error } = await db
      .from("breaking_news")
      .insert(record);

    if (error) {
      showMessage(error.message);
      return;
    }

    showMessage("Announcement saved.");
    form.reset();
    await renderBreakingNews();
  }

  async function renderBreakingNews() {
    const list = $("#news-list");
    if (!list) return;

    const { data, error } = await db
      .from("breaking_news")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      list.textContent = error.message;
      return;
    }

    if (!data?.length) {
      list.innerHTML = "<p>No announcements found.</p>";
      return;
    }

    list.innerHTML = data.map((item) => `
      <div class="admin-list-item">
        <h4>${escapeHTML(item.title)}</h4>
        <p>${escapeHTML(item.body)}</p>

        ${item.youtube_url
          ? `<p>YouTube: <a href="${escapeHTML(item.youtube_url)}" target="_blank" rel="noopener">Open video</a></p>`
          : ""}

        <p>Status: ${item.is_active ? "Active" : "Inactive"}</p>

        <button type="button"
          data-news-toggle="${item.id}"
          data-active="${item.is_active}">
          ${item.is_active ? "Deactivate" : "Activate"}
        </button>

        <button type="button" data-news-delete="${item.id}">
          Delete
        </button>
      </div>
    `).join("");

    list.querySelectorAll("[data-news-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this announcement?")) return;

        const { error } = await db
          .from("breaking_news")
          .delete()
          .eq("id", button.dataset.newsDelete);

        if (error) showMessage(error.message);
        else await renderBreakingNews();
      });
    });

    list.querySelectorAll("[data-news-toggle]").forEach((button) => {
      button.addEventListener("click", async () => {
        const { error } = await db
          .from("breaking_news")
          .update({
            is_active: button.dataset.active !== "true"
          })
          .eq("id", button.dataset.newsToggle);

        if (error) showMessage(error.message);
        else await renderBreakingNews();
      });
    });
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  async function loadCategories() {
    setContent("Menu Categories", `
      <form id="category-form" class="admin-form">
        <h3>Add Category</h3>
        <input name="name" required placeholder="Category name">
        <button type="submit">Add Category</button>
      </form>

      <h3>Categories</h3>
      <div id="category-list">Loading...</div>
    `);

    $("#category-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = new FormData(event.currentTarget).get("name");

      const { error } = await db
        .from("categories")
        .insert({ name });

      if (error) showMessage(error.message);
      else {
        event.currentTarget.reset();
        await renderCategories();
      }
    });

    await renderCategories();
  }

  async function renderCategories() {
    const list = $("#category-list");
    if (!list) return;

    const { data, error } = await db
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((item) => `
      <div class="admin-list-item">
        ${escapeHTML(item.name)}
        <button type="button" data-category-delete="${item.id}">
          Delete
        </button>
      </div>
    `).join("") || "<p>No categories.</p>";

    list.querySelectorAll("[data-category-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this category?")) return;

        const { error } = await db
          .from("categories")
          .delete()
          .eq("id", button.dataset.categoryDelete);

        if (error) showMessage(error.message);
        else await renderCategories();
      });
    });
  }

  // ==========================================
  // CUSTOMERS
  // ==========================================

  async function loadCustomers() {
    setContent("Customers", `
      <div id="customer-list">Loading customers...</div>
    `);

    const { data, error } = await db
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    const list = $("#customer-list");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((customer) => `
      <div class="admin-list-item">
        <h4>${escapeHTML(customer.full_name || customer.name)}</h4>
        <p>Phone: ${escapeHTML(customer.phone)}</p>
        <p>Email: ${escapeHTML(customer.email)}</p>
      </div>
    `).join("") || "<p>No customers found.</p>";
  }

  // ==========================================
  // STAFF
  // ==========================================

  async function loadStaff() {
    setContent("Staff Management", `
      <form id="staff-form" class="admin-form">
        <h3>Add Staff Member</h3>
        <input name="full_name" required placeholder="Full name">
        <input name="job_title" placeholder="Job title">
        <input name="phone" placeholder="Phone">
        <input name="photo_url" type="url" placeholder="Photo URL">
        <label>
          <input type="checkbox" name="is_active" checked>
          Active
        </label>
        <button type="submit">Save Staff</button>
      </form>

      <h3>Staff Members</h3>
      <div id="staff-list">Loading...</div>
    `);

    $("#staff-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const values = new FormData(event.currentTarget);

      const { error } = await db.from("staff").insert({
        full_name: values.get("full_name"),
        job_title: values.get("job_title"),
        phone: values.get("phone"),
        photo_url: values.get("photo_url"),
        is_active: values.get("is_active") === "on"
      });

      if (error) showMessage(error.message);
      else {
        event.currentTarget.reset();
        await renderStaff();
      }
    });

    await renderStaff();
  }

  async function renderStaff() {
    const list = $("#staff-list");
    if (!list) return;

    const { data, error } = await db
      .from("staff")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((person) => `
      <div class="admin-list-item">
        <h4>${escapeHTML(person.full_name)}</h4>
        <p>${escapeHTML(person.job_title)}</p>
        <p>${escapeHTML(person.phone)}</p>
        <p>${person.is_active ? "Active" : "Inactive"}</p>

        <button type="button" data-staff-toggle="${person.id}"
          data-active="${person.is_active}">
          ${person.is_active ? "Deactivate" : "Activate"}
        </button>

        <button type="button" data-staff-delete="${person.id}">
          Delete
        </button>
      </div>
    `).join("") || "<p>No staff members.</p>";

    list.querySelectorAll("[data-staff-toggle]").forEach((button) => {
      button.addEventListener("click", async () => {
        const { error } = await db
          .from("staff")
          .update({ is_active: button.dataset.active !== "true" })
          .eq("id", button.dataset.staffToggle);

        if (error) showMessage(error.message);
        else await renderStaff();
      });
    });

    list.querySelectorAll("[data-staff-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this staff member?")) return;

        const { error } = await db
          .from("staff")
          .delete()
          .eq("id", button.dataset.staffDelete);

        if (error) showMessage(error.message);
        else await renderStaff();
      });
    });
  }

  // ==========================================
  // RESTAURANT TABLES
  // ==========================================

  async function loadTables() {
    setContent("Restaurant Tables", `
      <form id="table-form" class="admin-form">
        <h3>Add Table</h3>
        <input name="name" required placeholder="Table name">
        <input name="capacity" type="number" min="1" required placeholder="Capacity">
        <input name="notes" placeholder="Notes">
        <label>
          <input type="checkbox" name="is_active" checked>
          Active
        </label>
        <button type="submit">Save Table</button>
      </form>

      <h3>Tables</h3>
      <div id="table-list">Loading...</div>
    `);

    $("#table-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const values = new FormData(event.currentTarget);

      const { error } = await db.from("restaurant_tables").insert({
        name: values.get("name"),
        capacity: Number(values.get("capacity")),
        notes: values.get("notes"),
        is_active: values.get("is_active") === "on"
      });

      if (error) showMessage(error.message);
      else {
        event.currentTarget.reset();
        await renderTables();
      }
    });

    await renderTables();
  }

  async function renderTables() {
    const list = $("#table-list");
    if (!list) return;

    const { data, error } = await db
      .from("restaurant_tables")
      .select("*")
      .order("name");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((table) => `
      <div class="admin-list-item">
        <h4>${escapeHTML(table.name)}</h4>
        <p>Capacity: ${escapeHTML(table.capacity)}</p>
        <p>${escapeHTML(table.notes)}</p>
        <p>${table.is_active ? "Active" : "Inactive"}</p>
        <button type="button" data-table-delete="${table.id}">
          Delete
        </button>
      </div>
    `).join("") || "<p>No tables.</p>";

    list.querySelectorAll("[data-table-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this table?")) return;

        const { error } = await db
          .from("restaurant_tables")
          .delete()
          .eq("id", button.dataset.tableDelete);

        if (error) showMessage(error.message);
        else await renderTables();
      });
    });
  }

  // ==========================================
  // COUPONS
  // ==========================================

  async function loadCoupons() {
    setContent("Coupons", `
      <form id="coupon-form" class="admin-form">
        <h3>Create Coupon</h3>
        <input name="code" required placeholder="Coupon code">
        <input name="discount_percent" type="number"
          min="1" max="100" required placeholder="Discount %">
        <input name="starts_at" type="datetime-local">
        <input name="ends_at" type="datetime-local">
        <label>
          <input type="checkbox" name="is_active" checked>
          Active
        </label>
        <button type="submit">Save Coupon</button>
      </form>

      <h3>Saved Coupons</h3>
      <div id="coupon-list">Loading...</div>
    `);

    $("#coupon-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const values = new FormData(event.currentTarget);

      const { error } = await db.from("coupons").insert({
        code: values.get("code"),
        discount_percent: Number(values.get("discount_percent")),
        starts_at: values.get("starts_at")
          ? new Date(values.get("starts_at")).toISOString()
          : null,
        ends_at: values.get("ends_at")
          ? new Date(values.get("ends_at")).toISOString()
          : null,
        is_active: values.get("is_active") === "on"
      });

      if (error) showMessage(error.message);
      else {
        event.currentTarget.reset();
        await renderCoupons();
      }
    });

    await renderCoupons();
  }

  async function renderCoupons() {
    const list = $("#coupon-list");
    if (!list) return;

    const { data, error } = await db
      .from("coupons")
      .select("*")
      .order("code");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((coupon) => `
      <div class="admin-list-item">
        <h4>${escapeHTML(coupon.code)}</h4>
        <p>Discount: ${escapeHTML(coupon.discount_percent)}%</p>
        <p>${coupon.is_active ? "Active" : "Inactive"}</p>
        <button type="button" data-coupon-delete="${coupon.id}">
          Delete
        </button>
      </div>
    `).join("") || "<p>No coupons.</p>";

    list.querySelectorAll("[data-coupon-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this coupon?")) return;

        const { error } = await db
          .from("coupons")
          .delete()
          .eq("id", button.dataset.couponDelete);

        if (error) showMessage(error.message);
        else await renderCoupons();
      });
    });
  }

  // ==========================================
  // OPENING HOURS
  // ==========================================

  async function loadHours() {
    setContent("Opening Hours", `
      <div id="hours-list">Loading opening hours...</div>
    `);

    const { data, error } = await db
      .from("opening_hours")
      .select("*")
      .order("day_of_week");

    const list = $("#hours-list");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((day) => `
      <form class="admin-form hour-form" data-day="${day.day_of_week}">
        <h4>${escapeHTML(day.day_name)}</h4>

        <label>
          <input type="checkbox" name="is_closed"
            ${day.is_closed ? "checked" : ""}>
          Closed
        </label>

        <label>Opening time</label>
        <input type="time" name="opens_at"
          value="${escapeHTML(day.opens_at || "")}">

        <label>Closing time</label>
        <input type="time" name="closes_at"
          value="${escapeHTML(day.closes_at || "")}">

        <button type="submit">Save ${escapeHTML(day.day_name)}</button>
      </form>
    `).join("") || "<p>No opening hours found.</p>";

    list.querySelectorAll(".hour-form").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const values = new FormData(form);

        const { error } = await db
          .from("opening_hours")
          .update({
            is_closed: values.get("is_closed") === "on",
            opens_at: values.get("opens_at") || null,
            closes_at: values.get("closes_at") || null
          })
          .eq("day_of_week", form.dataset.day);

        if (error) showMessage(error.message);
        else showMessage("Opening hours saved.");
      });
    });
  }

  // ==========================================
  // DELIVERY LINK
  // ==========================================

  async function loadDelivery() {
    setContent("Delivery Link", `
      <form id="delivery-form" class="admin-form">
        <h3>Delivery Website URL</h3>
        <input name="delivery_url" type="url"
          placeholder="https://example.com">
        <button type="submit">Save Delivery Link</button>
      </form>
      <p id="delivery-status"></p>
    `);

    const { data } = await db
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "delivery_url")
      .maybeSingle();

    const input = $('#delivery-form [name="delivery_url"]');

    if (input && data) input.value = data.setting_value;

    $("#delivery-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const value = new FormData(event.currentTarget)
        .get("delivery_url");

      const { error } = await db
        .from("site_settings")
        .upsert({
          setting_key: "delivery_url",
          setting_value: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });

      $("#delivery-status").textContent = error
        ? error.message
        : "Delivery URL saved successfully.";
    });
  }

  // ==========================================
  // EVENTS
  // ==========================================

  async function loadEvents() {
    setContent("Events", `
      <form id="event-form" class="admin-form">
        <h3>Add Event</h3>
        <input name="title" required placeholder="Event title">
        <textarea name="body" placeholder="Event description"></textarea>
        <input name="event_date" type="datetime-local">
        <label>
          <input type="checkbox" name="is_active" checked>
          Active
        </label>
        <button type="submit">Save Event</button>
      </form>
      <div id="event-list">Loading...</div>
    `);

    $("#event-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const values = new FormData(event.currentTarget);

      const { error } = await db.from("staff_events").insert({
        title: values.get("title"),
        body: values.get("body"),
        event_date: values.get("event_date")
          ? new Date(values.get("event_date")).toISOString()
          : null,
        is_active: values.get("is_active") === "on"
      });

      if (error) showMessage(error.message);
      else {
        event.currentTarget.reset();
        await renderEvents();
      }
    });

    await renderEvents();
  }

  async function renderEvents() {
    const list = $("#event-list");
    if (!list) return;

    const { data, error } = await db
      .from("staff_events")
      .select("*")
      .order("event_date", { ascending: false });

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((item) => `
      <div class="admin-list-item">
        <h4>${escapeHTML(item.title)}</h4>
        <p>${escapeHTML(item.body)}</p>
        <p>${formatDate(item.event_date)}</p>
        <button type="button" data-event-delete="${item.id}">
          Delete
        </button>
      </div>
    `).join("") || "<p>No events.</p>";

    list.querySelectorAll("[data-event-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this event?")) return;

        const { error } = await db
          .from("staff_events")
          .delete()
          .eq("id", button.dataset.eventDelete);

        if (error) showMessage(error.message);
        else await renderEvents();
      });
    });
  }

  // ==========================================
  // STAFF MESSAGES
  // ==========================================

  async function loadMessages() {
    setContent("Staff Messages", `
      <form id="message-form" class="admin-form">
        <h3>New Staff Message</h3>
        <input name="title" required placeholder="Message title">
        <textarea name="body" required placeholder="Message"></textarea>
        <select name="audience">
          <option value="all">All Staff</option>
          <option value="manager">Managers</option>
        </select>
        <label>
          <input type="checkbox" name="is_active" checked>
          Active
        </label>
        <button type="submit">Send Message</button>
      </form>
      <div id="message-list">Loading...</div>
    `);

    $("#message-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const values = new FormData(event.currentTarget);

      const { error } = await db.from("staff_messages").insert({
        title: values.get("title"),
        body: values.get("body"),
        audience: values.get("audience"),
        is_active: values.get("is_active") === "on"
      });

      if (error) showMessage(error.message);
      else {
        event.currentTarget.reset();
        await renderMessages();
      }
    });

    await renderMessages();
  }

  async function renderMessages() {
    const list = $("#message-list");
    if (!list) return;

    const { data, error } = await db
      .from("staff_messages")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((item) => `
      <div class="admin-list-item">
        <h4>${escapeHTML(item.title)}</h4>
        <p>${escapeHTML(item.body)}</p>
        <p>Audience: ${escapeHTML(item.audience)}</p>
        <button type="button" data-message-delete="${item.id}">
          Delete
        </button>
      </div>
    `).join("") || "<p>No messages.</p>";

    list.querySelectorAll("[data-message-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this message?")) return;

        const { error } = await db
          .from("staff_messages")
          .delete()
          .eq("id", button.dataset.messageDelete);

        if (error) showMessage(error.message);
        else await renderMessages();
      });
    });
  }

  // ==========================================
  // ATTENDANCE
  // ==========================================

  async function loadAttendance() {
    setContent("Staff Attendance", `
      <div id="attendance-list">Loading attendance...</div>
    `);

    const { data, error } = await db
      .from("staff_attendance")
      .select("*")
      .order("attendance_date", { ascending: false })
      .limit(100);

    const list = $("#attendance-list");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((item) => `
      <div class="admin-list-item">
        <h4>${escapeHTML(item.staff_name)}</h4>
        <p>Date: ${escapeHTML(item.attendance_date)}</p>
        <p>Check in: ${escapeHTML(item.check_in)}</p>
        <p>Check out: ${escapeHTML(item.check_out)}</p>
        <p>Status: ${escapeHTML(item.status)}</p>
      </div>
    `).join("") || "<p>No attendance records.</p>";
  }

  // ==========================================
  // ACTIVITY LOG
  // ==========================================

  async function loadActivity() {
    setContent("Staff Activity", `
      <div id="activity-list">Loading activity...</div>
    `);

    const { data, error } = await db
      .from("staff_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    const list = $("#activity-list");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map((item) => `
      <div class="admin-list-item">
        <h4>${escapeHTML(item.staff_name)}</h4>
        <p>${escapeHTML(item.action)}</p>
        <p>${escapeHTML(item.details)}</p>
        <p>${formatDate(item.created_at)}</p>
      </div>
    `).join("") || "<p>No activity records.</p>";
  }

  // ==========================================
  // PERFORMANCE
  // ==========================================

  async function loadPerformance() {
    setContent("Performance", `
      <h3>Restaurant Performance</h3>
      <p>Bookings and customer overview.</p>
      <div id="performance-data">Loading...</div>
    `);

    const [bookings, customers] = await Promise.all([
      db.from("bookings").select("*", { count: "exact", head: true }),
      db.from("customers").select("*", { count: "exact", head: true })
    ]);

    $("#performance-data").innerHTML = `
      <div class="admin-list-item">
        Total Bookings: ${bookings.error ? "Error" : bookings.count}
      </div>
      <div class="admin-list-item">
        Total Customers: ${customers.error ? "Error" : customers.count}
      </div>
    `;
  }

  // ==========================================
  // WEBSITE SETTINGS
  // ==========================================

  async function loadWebsite() {
    setContent("Website Settings", `
      <h3>Website Logo</h3>
      <p>Change the restaurant logo from the sidebar using the Change Logo button.</p>
      <h3>YouTube Advertisement</h3>
      <p>YouTube video links can be added in the Breaking News section.</p>
      <p>Website homepage display must also be connected to these saved settings.</p>
    `);
  }

  // ==========================================
  // PAGE NAVIGATION
  // ==========================================

  async function openPage(page) {
    if (!currentUser) return;

    document.querySelectorAll("[data-page]").forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.page === page
      );
    });

    try {
      switch (page) {
        case "dashboard":
          await loadDashboard();
          break;

        case "breaking":
          await loadBreakingNews();
          break;

        case "categories":
          await loadCategories();
          break;

        case "customers":
          await loadCustomers();
          break;

        case "staff":
          await loadStaff();
          break;

        case "tables":
          await loadTables();
          break;

        case "coupons":
          await loadCoupons();
          break;

        case "hours":
          await loadHours();
          break;

        case "delivery":
          await loadDelivery();
          break;

        case "events":
          await loadEvents();
          break;

        case "messages":
          await loadMessages();
          break;

        case "attendance":
          await loadAttendance();
          break;

        case "activity":
          await loadActivity();
          break;

        case "performance":
          await loadPerformance();
          break;

        case "website":
          await loadWebsite();
          break;

        default:
          setContent("Admin Panel", `
            <h3>This section is not available yet.</h3>
          `);
      }
    } catch (error) {
      console.error("Page loading error:", error);
      setContent("Error", `
        <p>${escapeHTML(error.message)}</p>
      `);
    }
  }

  document.querySelectorAll("[data-page]").forEach((item) => {
    item.addEventListener("click", () => {
      openPage(item.dataset.page);
    });
  });

  // ==========================================
  // INITIALIZE / RESTORE LOGIN SESSION
  // ==========================================

  async function initialise() {
    showLogin();

    const { data, error } = await db.auth.getSession();

    if (error || !data?.session?.user) {
      showLogin();
      return;
    }

    const user = data.session.user;
    const authorized = await checkAdmin(user);

    if (!authorized) {
      await db.auth.signOut();
      showLogin("এই অ্যাকাউন্ট Admin হিসেবে অনুমোদিত নয়।");
      return;
    }

    currentUser = user;
    showAdmin();
    await loadAdminLogo();
    await openPage("dashboard");
  }

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      showLogin();
    }
  });

  initialise();

})();
