
(() => {
  "use strict";

  // NABABI RISTORANTE - ADMIN PANEL
  // Supabase connection. Use only the public anon key here.

  const config = window.NABABI_CONFIG;

  if (!window.supabase || !config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    alert("Supabase configuration পাওয়া যায়নি। assets/config.js পরীক্ষা করুন।");
    return;
  }

  const db = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const loginView = $("#login-view");
  const adminApp = $("#admin-app");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const pageTitle = $("#page-title");
  const pageContent = $("#page-content");
  const logoutButton = $("#logout");

  let currentUser = null;

  // COMMON HELPERS

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showMessage(message) {
    alert(String(message));
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
    if (!value) return "—";
    return new Date(value).toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function localDateTimeToISO(value) {
    return value ? new Date(value).toISOString() : null;
  }

  // MOBILE-FRIENDLY ADMIN STYLES

  function installAdminStyles() {
    if ($("#admin-js-styles")) return;

    const style = document.createElement("style");
    style.id = "admin-js-styles";

    style.textContent = `
      #page-content {
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
      }

      .admin-form,
      .admin-list-item,
      .dashboard-card {
        box-sizing: border-box;
        width: 100%;
        background: #2a153b;
        color: #f8f0df;
        border: 1px solid #674b78;
        border-radius: 14px;
        padding: 16px;
        margin: 12px 0;
      }

      .admin-form {
        display: grid;
        gap: 10px;
      }

      .admin-form h3,
      .admin-list-item h4 {
        color: #e4c77f;
        margin-top: 0;
      }

      .admin-form label {
        color: #eadff0;
        font-size: 14px;
      }

      #page-content input:not([type="checkbox"]),
      #page-content textarea,
      #page-content select {
        width: 100%;
        min-height: 46px;
        padding: 12px;
        border-radius: 9px;
        border: 1px solid #806895;
        background: #1e102b;
        color: white;
        box-sizing: border-box;
        font: inherit;
      }

      #page-content textarea {
        min-height: 90px;
      }

      #page-content button {
        min-height: 44px;
        padding: 11px 16px;
        border: 1px solid #d8b45c;
        border-radius: 9px;
        background: #d8b45c;
        color: #210b38;
        font-weight: 700;
        cursor: pointer;
        margin: 5px 5px 5px 0;
      }

      #page-content button:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .admin-dashboard {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .dashboard-card strong {
        display: block;
        color: #e4c77f;
        font-size: 28px;
        margin-top: 8px;
      }

      .admin-list-item p {
        overflow-wrap: anywhere;
      }

      .muted-note {
        color: #d8c9e2;
        font-size: 13px;
        line-height: 1.5;
      }

      .pin-form {
        border: 1px solid #806895;
        border-radius: 10px;
        padding: 12px;
        margin-top: 12px;
      }

      .pin-status {
        color: #e4c77f;
        font-size: 13px;
      }

      @media (max-width: 600px) {
        .admin-dashboard {
          grid-template-columns: 1fr;
        }

        .admin-main {
          padding: 10px !important;
          min-width: 0;
        }

        .admin-form,
        .admin-list-item {
          padding: 13px;
        }

        #page-content button {
          min-height: 46px;
        }

        .sidebar nav {
          overflow-x: auto;
          max-width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ADMIN AUTHENTICATION

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

    const email = formData.get("email") ||
      $('[type="email"]', loginForm)?.value;

    const password = formData.get("password") ||
      $('[type="password"]', loginForm)?.value;

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

    if (!(await checkAdmin(data.user))) {
      await db.auth.signOut();
      showLogin("এই অ্যাকাউন্ট Admin হিসেবে অনুমোদিত নয়।");
      return;
    }

    currentUser = data.user;
    showAdmin();
    await loadAdminLogo();
    await openPage("dashboard");
  }

  loginForm?.addEventListener("submit", handleLogin);

  logoutButton?.addEventListener("click", async () => {
    await db.auth.signOut();
    currentUser = null;
    showLogin("আপনি Logout করেছেন।");
  });

  // RESTAURANT LOGO

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
      console.error("Logo loading:", error.message);
      return;
    }

    if (!data?.setting_value) {
      logo.hidden = true;
      if (fallback) fallback.hidden = false;
      return;
    }

    logo.onload = () => {
      logo.hidden = false;
      if (fallback) fallback.hidden = true;
    };

    logo.onerror = () => {
      logo.hidden = true;
      if (fallback) fallback.hidden = false;
    };

    logo.src = data.setting_value;
  }

  async function uploadRestaurantLogo(file) {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
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

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const filePath = "logo/" + Date.now() + "-" + safeName;

      const { data: uploaded, error: uploadError } = await db.storage
        .from("site-assets")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = db.storage
        .from("site-assets")
        .getPublicUrl(uploaded.path);

      const { error: saveError } = await db
        .from("site_settings")
        .upsert({
          setting_key: "logo_url",
          setting_value: publicData.publicUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });

      if (saveError) throw saveError;

      await loadAdminLogo();
      showMessage("Restaurant logo uploaded successfully.");

    } catch (error) {
      console.error(error);
      showMessage("Logo upload failed: " + error.message);

    } finally {
      if (changeButton) {
        changeButton.disabled = false;
        changeButton.textContent = "Change Logo";
      }
      const input = $("#logo-file");
      if (input) input.value = "";
    }
  }

  $("#change-logo")?.addEventListener("click", () => {
    $("#logo-file")?.click();
  });

  $("#logo-file")?.addEventListener("change", event => {
    uploadRestaurantLogo(event.target.files?.[0]);
  });

  // DASHBOARD

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
      <div class="admin-list-item">
        <h3>Benvenuto in Nababi Ristorante Admin</h3>
        <p>Manage your restaurant website from here.</p>
      </div>
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
      if (element) element.textContent = error ? "Error" : count;
    }
  }

  // BREAKING NEWS + YOUTUBE VIDEO

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
        <label><input type="checkbox" name="is_active" checked> Active</label>
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

    const { error } = await db.from("breaking_news").insert({
      title: values.get("title"),
      body: values.get("body"),
      youtube_url: values.get("youtube_url") || null,
      image_url: values.get("image_url") || null,
      starts_at: localDateTimeToISO(values.get("starts_at")),
      ends_at: localDateTimeToISO(values.get("ends_at")),
      is_active: values.get("is_active") === "on"
    });

    if (error) {
      showMessage(error.message);
      return;
    }

    form.reset();
    await renderBreakingNews();
    showMessage("Announcement saved.");
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

    list.innerHTML = (data || []).map(item => `
      <div class="admin-list-item">
        <h4>${escapeHTML(item.title)}</h4>
        <p>${escapeHTML(item.body)}</p>
        ${item.youtube_url
          ? `<p><a href="${escapeHTML(item.youtube_url)}" target="_blank" rel="noopener">Open video</a></p>`
          : ""}
        <p>Status: ${item.is_active ? "Active" : "Inactive"}</p>
        <button type="button" data-news-toggle="${escapeHTML(item.id)}"
          data-active="${item.is_active}">
          ${item.is_active ? "Deactivate" : "Activate"}
        </button>
        <button type="button" data-news-delete="${escapeHTML(item.id)}">Delete</button>
      </div>
    `).join("") || "<p>No announcements found.</p>";

    $$("[data-news-delete]", list).forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this announcement?")) return;
        const { error } = await db.from("breaking_news")
          .delete().eq("id", button.dataset.newsDelete);
        if (error) showMessage(error.message);
        else await renderBreakingNews();
      });
    });

    $$("[data-news-toggle]", list).forEach(button => {
      button.addEventListener("click", async () => {
        const { error } = await db.from("breaking_news")
          .update({ is_active: button.dataset.active !== "true" })
          .eq("id", button.dataset.newsToggle);
        if (error) showMessage(error.message);
        else await renderBreakingNews();
      });
    });
  }

  // CATEGORIES

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

    $("#category-form").addEventListener("submit", async event => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get("name");
      const { error } = await db.from("categories").insert({ name });

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

    const { data, error } = await db.from("categories")
      .select("*").order("name");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map(item => `
      <div class="admin-list-item">
        ${escapeHTML(item.name)}
        <button type="button" data-category-delete="${escapeHTML(item.id)}">Delete</button>
      </div>
    `).join("") || "<p>No categories.</p>";

    $$("[data-category-delete]", list).forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this category?")) return;
        const { error } = await db.from("categories")
          .delete().eq("id", button.dataset.categoryDelete);
        if (error) showMessage(error.message);
        else await renderCategories();
      });
    });
  }

  // CUSTOMERS

  async function loadCustomers() {
    setContent("Customers", `<div id="customer-list">Loading customers...</div>`);

    const { data, error } = await db.from("customers")
      .select("*").order("created_at", { ascending: false });

    const list = $("#customer-list");
    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map(customer => `
      <div class="admin-list-item">
        <h4>${escapeHTML(customer.full_name || customer.name)}</h4>
        <p>Phone: ${escapeHTML(customer.phone)}</p>
        <p>Email: ${escapeHTML(customer.email)}</p>
      </div>
    `).join("") || "<p>No customers found.</p>";
  }

  // STAFF MANAGEMENT + STAFF PIN

  async function loadStaff() {
    setContent("Staff Management & PIN", `
      <form id="staff-form" class="admin-form">
        <h3>Add Staff Member</h3>
        <input name="full_name" required placeholder="Full name">
        <input name="job_title" placeholder="Job title">
        <input name="phone" placeholder="Phone">
        <input name="photo_url" type="url" placeholder="Photo URL">
        <label><input type="checkbox" name="is_active" checked> Active</label>
        <button type="submit">Save Staff</button>
      </form>

      <p class="muted-note">
        Staff যোগ করার পরে নিচের ফর্ম থেকে তার PIN সেট করুন।
        PIN ৪–৮ সংখ্যার হতে হবে। PIN কাউকে প্রকাশ করবেন না।
      </p>

      <h3>Staff Members</h3>
      <div id="staff-list">Loading...</div>
    `);

    $("#staff-form").addEventListener("submit", async event => {
      event.preventDefault();

      const form = event.currentTarget;
      const values = new FormData(form);

      const { error } = await db.from("staff").insert({
        full_name: values.get("full_name"),
        job_title: values.get("job_title") || null,
        phone: values.get("phone") || null,
        photo_url: values.get("photo_url") || null,
        is_active: values.get("is_active") === "on"
      });

      if (error) {
        showMessage(error.message);
        return;
      }

      form.reset();
      await renderStaff();
      showMessage("Staff member added. এখন তার PIN সেট করুন।");
    });

    await renderStaff();
  }

  async function renderStaff() {
    const list = $("#staff-list");
    if (!list) return;

    // Do NOT select pin_hash or other secret fields.
    const { data, error } = await db.from("staff")
      .select("id,full_name,job_title,phone,photo_url,is_active,pin_updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map(person => `
      <div class="admin-list-item">
        <h4>${escapeHTML(person.full_name)}</h4>
        <p>${escapeHTML(person.job_title)}</p>
        <p>${escapeHTML(person.phone)}</p>
        <p>Status: ${person.is_active ? "Active" : "Inactive"}</p>
        <p class="pin-status">
          PIN: ${person.pin_updated_at ? "Set" : "Not set"}
        </p>

        <form class="admin-form pin-form" data-staff-id="${escapeHTML(person.id)}">
          <label>Set / Change PIN</label>
          <input
            name="pin"
            type="password"
            inputmode="numeric"
            autocomplete="new-password"
            minlength="4"
            maxlength="8"
            pattern="[0-9]{4,8}"
            required
            placeholder="New 4–8 digit PIN"
          >
          <button type="submit">Save Staff PIN</button>
        </form>

        <button type="button"
          data-staff-toggle="${escapeHTML(person.id)}"
          data-active="${person.is_active}">
          ${person.is_active ? "Deactivate" : "Activate"}
        </button>

        <button type="button" data-staff-delete="${escapeHTML(person.id)}">
          Delete
        </button>
      </div>
    `).join("") || "<p>No staff members.</p>";

    // Save PIN using the existing secure Supabase RPC.
    $$(".pin-form", list).forEach(form => {
      form.addEventListener("submit", async event => {
        event.preventDefault();

        const pin = new FormData(form).get("pin");

        if (!/^[0-9]{4,8}$/.test(pin)) {
          showMessage("PIN অবশ্যই ৪–৮ সংখ্যার হতে হবে।");
          return;
        }

        const submitButton = $('button[type="submit"]', form);
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";

        try {
          const { error } = await db.rpc("admin_set_staff_pin", {
            p_staff_id: form.dataset.staffId,
            p_pin: pin
          });

          if (error) throw error;

          form.reset();
          showMessage("Staff PIN successfully saved.");
          await renderStaff();

        } catch (error) {
          console.error("Staff PIN error:", error);
          showMessage("PIN save হয়নি: " + error.message);

        } finally {
          if (submitButton.isConnected) {
            submitButton.disabled = false;
            submitButton.textContent = "Save Staff PIN";
          }
        }
      });
    });

    $$("[data-staff-toggle]", list).forEach(button => {
      button.addEventListener("click", async () => {
        const { error } = await db.from("staff")
          .update({ is_active: button.dataset.active !== "true" })
          .eq("id", button.dataset.staffToggle);

        if (error) showMessage(error.message);
        else await renderStaff();
      });
    });

    $$("[data-staff-delete]", list).forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this staff member?")) return;

        const { error } = await db.from("staff")
          .delete().eq("id", button.dataset.staffDelete);

        if (error) showMessage(error.message);
        else await renderStaff();
      });
    });
  }

  // RESTAURANT TABLES

  async function loadTables() {
    setContent("Restaurant Tables", `
      <form id="table-form" class="admin-form">
        <h3>Add Table</h3>
        <input name="name" required placeholder="Table name">
        <input name="capacity" type="number" min="1" required placeholder="Capacity">
        <input name="notes" placeholder="Notes">
        <label><input type="checkbox" name="is_active" checked> Active</label>
        <button type="submit">Save Table</button>
      </form>
      <h3>Tables</h3>
      <div id="table-list">Loading...</div>
    `);

    $("#table-form").addEventListener("submit", async event => {
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

    const { data, error } = await db.from("restaurant_tables")
      .select("*").order("name");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map(table => `
      <div class="admin-list-item">
        <h4>${escapeHTML(table.name)}</h4>
        <p>Capacity: ${escapeHTML(table.capacity)}</p>
        <p>${escapeHTML(table.notes)}</p>
        <p>${table.is_active ? "Active" : "Inactive"}</p>
        <button type="button" data-table-delete="${escapeHTML(table.id)}">Delete</button>
      </div>
    `).join("") || "<p>No tables.</p>";

    $$("[data-table-delete]", list).forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this table?")) return;
        const { error } = await db.from("restaurant_tables")
          .delete().eq("id", button.dataset.tableDelete);
        if (error) showMessage(error.message);
        else await renderTables();
      });
    });
  }

  // COUPONS - DISCOUNT GAME IS NOT INCLUDED

  async function loadCoupons() {
    setContent("Coupons", `
      <form id="coupon-form" class="admin-form">
        <h3>Create Coupon</h3>
        <input name="code" required placeholder="Coupon code">
        <input name="discount_percent" type="number"
          min="1" max="100" required placeholder="Discount %">
        <input name="starts_at" type="datetime-local">
        <input name="ends_at" type="datetime-local">
        <label><input type="checkbox" name="is_active" checked> Active</label>
        <button type="submit">Save Coupon</button>
      </form>
      <h3>Saved Coupons</h3>
      <div id="coupon-list">Loading...</div>
    `);

    $("#coupon-form").addEventListener("submit", async event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);

      const { error } = await db.from("coupons").insert({
        code: values.get("code"),
        discount_percent: Number(values.get("discount_percent")),
        starts_at: localDateTimeToISO(values.get("starts_at")),
        ends_at: localDateTimeToISO(values.get("ends_at")),
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

    const { data, error } = await db.from("coupons")
      .select("*").order("code");

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map(coupon => `
      <div class="admin-list-item">
        <h4>${escapeHTML(coupon.code)}</h4>
        <p>Discount: ${escapeHTML(coupon.discount_percent)}%</p>
        <p>${coupon.is_active ? "Active" : "Inactive"}</p>
        <button type="button" data-coupon-delete="${escapeHTML(coupon.id)}">Delete</button>
      </div>
    `).join("") || "<p>No coupons.</p>";

    $$("[data-coupon-delete]", list).forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this coupon?")) return;
        const { error } = await db.from("coupons")
          .delete().eq("id", button.dataset.couponDelete);
        if (error) showMessage(error.message);
        else await renderCoupons();
      });
    });
  }

  // OPENING HOURS

  async function loadHours() {
    setContent("Opening Hours", `<div id="hours-list">Loading...</div>`);

    const { data, error } = await db.from("opening_hours")
      .select("*").order("day_of_week");

    const list = $("#hours-list");
    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map(day => `
      <form class="admin-form hour-form" data-day="${escapeHTML(day.day_of_week)}">
        <h4>${escapeHTML(day.day_name)}</h4>
        <label><input type="checkbox" name="is_closed"
          ${day.is_closed ? "checked" : ""}> Closed</label>
        <label>Opening time</label>
        <input type="time" name="opens_at" value="${escapeHTML(day.opens_at || "")}">
        <label>Closing time</label>
        <input type="time" name="closes_at" value="${escapeHTML(day.closes_at || "")}">
        <button type="submit">Save ${escapeHTML(day.day_name)}</button>
      </form>
    `).join("") || "<p>No opening hours found.</p>";

    $$(".hour-form", list).forEach(form => {
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const values = new FormData(form);

        const { error } = await db.from("opening_hours")
          .update({
            is_closed: values.get("is_closed") === "on",
            opens_at: values.get("opens_at") || null,
            closes_at: values.get("closes_at") || null
          })
          .eq("day_of_week", form.dataset.day);

        showMessage(error ? error.message : "Opening hours saved.");
      });
    });
  }

  // DELIVERY LINK

  async function loadDelivery() {
    setContent("Delivery Link", `
      <form id="delivery-form" class="admin-form">
        <h3>Delivery Website URL</h3>
        <input name="delivery_url" type="url" placeholder="https://example.com">
        <button type="submit">Save Delivery Link</button>
      </form>
      <p id="delivery-status"></p>
    `);

    const { data, error } = await db.from("site_settings")
      .select("setting_value")
      .eq("setting_key", "delivery_url")
      .maybeSingle();

    if (error) console.error(error);

    const input = $('#delivery-form [name="delivery_url"]');
    if (input && data) input.value = data.setting_value;

    $("#delivery-form").addEventListener("submit", async event => {
      event.preventDefault();
      const value = new FormData(event.currentTarget).get("delivery_url");

      const { error } = await db.from("site_settings").upsert({
        setting_key: "delivery_url",
        setting_value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: "setting_key" });

      $("#delivery-status").textContent = error
        ? error.message
        : "Delivery URL saved successfully.";
    });
  }

  // EVENTS

  async function loadEvents() {
    setContent("Events", `
      <form id="event-form" class="admin-form">
        <h3>Add Event</h3>
        <input name="title" required placeholder="Event title">
        <textarea name="body" placeholder="Event description"></textarea>
        <input name="event_date" type="datetime-local">
        <label><input type="checkbox" name="is_active" checked> Active</label>
        <button type="submit">Save Event</button>
      </form>
      <div id="event-list">Loading...</div>
    `);

    $("#event-form").addEventListener("submit", async event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);

      const { error } = await db.from("staff_events").insert({
        title: values.get("title"),
        body: values.get("body"),
        event_date: localDateTimeToISO(values.get("event_date")),
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

    const { data, error } = await db.from("staff_events")
      .select("*").order("event_date", { ascending: false });

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map(item => `
      <div class="admin-list-item">
        <h4>${escapeHTML(item.title)}</h4>
        <p>${escapeHTML(item.body)}</p>
        <p>${formatDate(item.event_date)}</p>
        <button type="button" data-event-delete="${escapeHTML(item.id)}">Delete</button>
      </div>
    `).join("") || "<p>No events.</p>";

    $$("[data-event-delete]", list).forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this event?")) return;
        const { error } = await db.from("staff_events")
          .delete().eq("id", button.dataset.eventDelete);
        if (error) showMessage(error.message);
        else await renderEvents();
      });
    });
  }

  // STAFF MESSAGES

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
        <label><input type="checkbox" name="is_active" checked> Active</label>
        <button type="submit">Send Message</button>
      </form>
      <div id="message-list">Loading...</div>
    `);

    $("#message-form").addEventListener("submit", async event => {
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

    const { data, error } = await db.from("staff_messages")
      .select("*").order("id", { ascending: false });

    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map(item => `
      <div class="admin-list-item">
        <h4>${escapeHTML(item.title)}</h4>
        <p>${escapeHTML(item.body)}</p>
        <p>Audience: ${escapeHTML(item.audience)}</p>
        <button type="button" data-message-delete="${escapeHTML(item.id)}">Delete</button>
      </div>
    `).join("") || "<p>No messages.</p>";

    $$("[data-message-delete]", list).forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this message?")) return;
        const { error } = await db.from("staff_messages")
          .delete().eq("id", button.dataset.messageDelete);
        if (error) showMessage(error.message);
        else await renderMessages();
      });
    });
  }

  // ATTENDANCE
  // Uses staff_attendance_events written by staff_qr_punch.

  async function loadAttendance() {
    setContent("Staff Attendance", `
      <div class="admin-form">
        <h3>Attendance History</h3>
        <p class="muted-note">সর্বশেষ ২০০টি Check In / Check Out event দেখানো হবে।</p>
        <button type="button" id="refresh-attendance">Refresh Attendance</button>
      </div>
      <div id="attendance-list">Loading attendance...</div>
    `);

    $("#refresh-attendance").addEventListener("click", renderAttendance);
    await renderAttendance();
  }

  async function renderAttendance() {
    const list = $("#attendance-list");
    if (!list) return;

    const { data, error } = await db
      .from("staff_attendance_events")
      .select("id,staff_id,event_type,occurred_at,source")
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (error) {
      list.textContent = "Attendance load failed: " + error.message;
      return;
    }

    const staffIds = [...new Set(
      (data || []).map(item => item.staff_id).filter(Boolean)
    )];

    const staffNames = {};

    if (staffIds.length) {
      const { data: staff, error: staffError } = await db
        .from("staff")
        .select("id,full_name")
        .in("id", staffIds);

      if (staffError) {
        list.textContent = "Staff names load failed: " + staffError.message;
        return;
      }

      (staff || []).forEach(person => {
        staffNames[person.id] = person.full_name;
      });
    }

    list.innerHTML = (data || []).map(item => {
      const isIn = item.event_type === "check_in";
      const eventLabel = isIn ? "CHECK IN" :
        item.event_type === "check_out" ? "CHECK OUT" : item.event_type;

      return `
        <div class="admin-list-item">
          <h4>${escapeHTML(staffNames[item.staff_id] || "Staff")}</h4>
          <p><strong>${escapeHTML(eventLabel)}</strong></p>
          <p>Date: ${formatDate(item.occurred_at)}</p>
          <p>Source: ${escapeHTML(item.source || "—")}</p>
        </div>
      `;
    }).join("") || "<p>No attendance records yet.</p>";
  }

  // ACTIVITY LOG

  async function loadActivity() {
    setContent("Staff Activity", `<div id="activity-list">Loading activity...</div>`);

    const { data, error } = await db.from("staff_activity_logs")
      .select("*").order("created_at", { ascending: false }).limit(100);

    const list = $("#activity-list");
    if (error) {
      list.textContent = error.message;
      return;
    }

    list.innerHTML = (data || []).map(item => `
      <div class="admin-list-item">
        <h4>${escapeHTML(item.staff_name)}</h4>
        <p>${escapeHTML(item.action)}</p>
        <p>${escapeHTML(item.details)}</p>
        <p>${formatDate(item.created_at)}</p>
      </div>
    `).join("") || "<p>No activity records.</p>";
  }

  // PERFORMANCE

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

  // WEBSITE SETTINGS

  async function loadWebsite() {
    setContent("Website Settings", `
      <div class="admin-list-item">
        <h3>Website Logo</h3>
        <p>Change the restaurant logo using the sidebar button.</p>
        <h3>YouTube Advertisement</h3>
        <p>YouTube video links can be added in the Breaking News section.</p>
        <p>Homepage display must also be connected to these saved settings.</p>
        <p>Discount Game is not included.</p>
      </div>
    `);
  }

  // PAGE NAVIGATION

  async function openPage(page) {
    if (!currentUser) return;

    $$("[data-page]").forEach(item => {
      item.classList.toggle("active", item.dataset.page === page);
    });

    try {
      const pages = {
        dashboard: loadDashboard,
        breaking: loadBreakingNews,
        categories: loadCategories,
        customers: loadCustomers,
        staff: loadStaff,
        tables: loadTables,
        coupons: loadCoupons,
        hours: loadHours,
        delivery: loadDelivery,
        events: loadEvents,
        messages: loadMessages,
        attendance: loadAttendance,
        activity: loadActivity,
        performance: loadPerformance,
        website: loadWebsite
      };

      if (pages[page]) {
        await pages[page]();
      } else {
        setContent("Admin Panel", "<h3>This section is not available yet.</h3>");
      }

    } catch (error) {
      console.error("Page loading error:", error);
      setContent("Error", `<p>${escapeHTML(error.message)}</p>`);
    }
  }

  $$("[data-page]").forEach(item => {
    item.addEventListener("click", () => openPage(item.dataset.page));
  });

  // INITIALIZE / RESTORE SESSION

  async function initialise() {
    installAdminStyles();
    showLogin();

    const { data, error } = await db.auth.getSession();

    if (error || !data?.session?.user) {
      showLogin();
      return;
    }

    const user = data.session.user;

    if (!(await checkAdmin(user))) {
      await db.auth.signOut();
      showLogin("এই অ্যাকাউন্ট Admin হিসেবে অনুমোদিত নয়।");
      return;
    }

    currentUser = user;
    showAdmin();
    await loadAdminLogo();
    await openPage("dashboard");
  }

  db.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      showLogin();
    }
  });

  initialise();

})();
