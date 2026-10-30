
(() => {
  "use strict";

  const config = window.NABABI_CONFIG;

  if (!config || !window.supabase) {
    console.error("Nababi: Supabase configuration or library missing.");
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

  let currentUser = null;
  let editingNewsId = null;

  // -----------------------------
  // RESTAURANT LOGO UPLOAD
  // -----------------------------

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
      logo.src = logoUrl;
      logo.hidden = false;
      if (fallback) fallback.hidden = true;
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
      alert("Please select a PNG, JPG or WEBP image.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert("Logo size must be 3 MB or less.");
      return;
    }

    const changeButton = $("#change-logo");

    try {
      if (changeButton) {
        changeButton.disabled = true;
        changeButton.textContent = "Uploading...";
      }

      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "-");

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

      alert("Restaurant logo uploaded successfully.");

    } catch (error) {
      console.error("Logo upload error:", error);
      alert("Logo upload failed: " + error.message);

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

  
  // Escape database content before displaying it in HTML.
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function showLogin(message = "") {
    if (loginView) loginView.style.display = "block";
    if (adminApp) adminApp.style.display = "none";
    if (loginError) loginError.textContent = message;
  }


function showAdmin() {
  if (loginView) {
    loginView.style.display = "none";
    loginView.hidden = true;
  }

  if (adminApp) {
    adminApp.hidden = false;
    adminApp.style.display = "flex";
  }
}


  function showError(message) {
    if (pageContent) {
      pageContent.innerHTML =
        `<p class="admin-error">${escapeHTML(message)}</p>`;
    }
  }

  // -----------------------------
  // ADMIN AUTHENTICATION
  // -----------------------------

  async function checkAdmin(user) {
    if (!user) return false;

    const { data, error } = await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Admin permission check:", error.message);
      return false;
    }

    return Boolean(data);
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (!loginForm) return;

    const email = loginForm.querySelector(
      'input[type="email"], input[name="email"]'
    )?.value.trim();

    const password = loginForm.querySelector(
      'input[type="password"], input[name="password"]'
    )?.value;

    if (!email || !password) {
      showLogin("Please enter your email and password.");
      return;
    }

    const submitButton = loginForm.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    try {
      if (submitButton) submitButton.disabled = true;

      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const allowed = await checkAdmin(data.user);

      if (!allowed) {
        await db.auth.signOut();
        showLogin("Access denied. This account is not an authorised admin.");
        return;
      }

     currentUser = data.user;
     showAdmin();
     await loadAdminLogo();
     await openPage("dashboard");

    } catch (error) {
      console.error("Login error:", error.message);
      showLogin("Login failed. Please check your email and password.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function logout() {
    await db.auth.signOut();
    currentUser = null;
    showLogin("You have logged out.");
  }

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  const logoutButton = $("#logout");

  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }

  // -----------------------------
  // PAGE NAVIGATION
  // -----------------------------

  const pageNames = {
    dashboard: "Dashboard",
    customers: "Customers",
    categories: "Categories",
    staff: "Staff Management",
    performance: "Staff Performance",
    attendance: "Staff Attendance",
    activity: "Staff Activity Log",
    tables: "Tavolo Management",
    coupons: "Coupon Manager",
    website: "Website ON/OFF",
    delivery: "Food Delivery Link",
    hours: "Opening Hours",
    events: "Staff Event & Advice",
    messages: "Staff Message",
    breaking: "Breaking News"
  };

  async function openPage(page) {
    if (!pageContent) return;

    const title = pageNames[page] || "Dashboard";

    if (pageTitle) pageTitle.textContent = title;

    document.querySelectorAll("[data-page]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    if (page === "dashboard") return loadDashboard();
    if (page === "breaking") return loadBreakingNews();
    if (page === "categories") return loadCategories();
    if (page === "customers") return loadCustomers();
    if (page === "staff") return loadStaff();
    if (page === "tables") return loadTables();
    if (page === "coupons") return loadCoupons();
    if (page === "hours") return loadOpeningHours();
    if (page === "delivery") return loadDelivery();

    pageContent.innerHTML = `
      <h2>${escapeHTML(title)}</h2>
      <p>This section is prepared for the next development step.</p>
    `;
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-page]");
    if (!button) return;

    event.preventDefault();
    await openPage(button.dataset.page);
  });

  // -----------------------------
  // DASHBOARD
  // -----------------------------

  async function getCount(table) {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error(`Count error (${table}):`, error.message);
      return "—";
    }

    return count ?? 0;
  }

  async function loadDashboard() {
    pageContent.innerHTML = "<p>Loading dashboard...</p>";

    const [bookings, customers, news, categories] = await Promise.all([
      getCount("bookings"),
      getCount("customers"),
      getCount("breaking_news"),
      getCount("categories")
    ]);

    pageContent.innerHTML = `
      <h2>Welcome to Nababi Ristorante</h2>
      <div class="admin-stats">
        <div class="stat-card">
          <h3>Bookings</h3><strong>${bookings}</strong>
        </div>
        <div class="stat-card">
          <h3>Customers</h3><strong>${customers}</strong>
        </div>
        <div class="stat-card">
          <h3>Breaking News</h3><strong>${news}</strong>
        </div>
        <div class="stat-card">
          <h3>Categories</h3><strong>${categories}</strong>
        </div>
      </div>
      <p>Use the menu to manage your restaurant website.</p>
    `;
  }

  // -----------------------------
  // BREAKING NEWS
  // -----------------------------

  async function loadBreakingNews() {
    editingNewsId = null;

    pageContent.innerHTML = `
      <h2>Breaking News</h2>

      <form id="news-form" class="admin-form">
        <label>News Title</label>
        <input name="title" required maxlength="150">

        <label>News Description</label>
        <textarea name="body" rows="4"></textarea>

        <label>Image URL (optional)</label>
        <input name="image_url" type="url">

        <label>YouTube URL (optional)</label>
        <input name="youtube_url" type="url">

        <label>Start Date and Time</label>
        <input name="starts_at" type="datetime-local" required>

        <label>End Date and Time</label>
        <input name="ends_at" type="datetime-local" required>

        <label>
          <input name="is_active" type="checkbox" checked>
          Active
        </label>

        <button type="submit">Save News</button>
        <button type="button" id="cancel-news-edit" hidden>
          Cancel Edit
        </button>
      </form>

      <h3>Existing News</h3>
      <div id="news-list">Loading...</div>
    `;

    $("#news-form").addEventListener("submit", saveNews);

    $("#cancel-news-edit").addEventListener("click", () => {
      loadBreakingNews();
    });

    await refreshNewsList();
  }

  function toLocalDateTime(value) {
    if (!value) return "";

    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;

    return new Date(date.getTime() - offset)
      .toISOString()
      .slice(0, 16);
  }

  async function saveNews(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    const startsAt = new Date(data.get("starts_at"));
    const endsAt = new Date(data.get("ends_at"));

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      alert("Please select a valid end time after the start time.");
      return;
    }

    const news = {
      title: String(data.get("title")).trim(),
      body: String(data.get("body") || "").trim(),
      image_url: String(data.get("image_url") || "").trim() || null,
      youtube_url: String(data.get("youtube_url") || "").trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      is_active: data.get("is_active") === "on"
    };

    try {
      let result;

      if (editingNewsId) {
        result = await db
          .from("breaking_news")
          .update(news)
          .eq("id", editingNewsId);
      } else {
        result = await db
          .from("breaking_news")
          .insert([news]);
      }

      if (result.error) throw result.error;

      alert("Breaking News saved successfully.");
      await loadBreakingNews();

    } catch (error) {
      console.error("Save news error:", error.message);
      alert("Could not save news. Check your Supabase table and permissions.");
    }
  }

  async function refreshNewsList() {
    const list = $("#news-list");
    if (!list) return;

    const { data, error } = await db
      .from("breaking_news")
      .select("*")
      .order("starts_at", { ascending: false });

    if (error) {
      list.textContent = "Could not load news: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      list.textContent = "No news added yet.";
      return;
    }

    list.innerHTML = data.map((news) => `
      <div class="admin-list-item">
        <strong>${escapeHTML(news.title)}</strong>
        <p>${escapeHTML(news.body || "")}</p>
        <p>Status: ${news.is_active ? "Active" : "Inactive"}</p>
        <p>Ends: ${escapeHTML(news.ends_at || "")}</p>
        <button type="button" data-edit-news="${escapeHTML(news.id)}">
          Edit
        </button>
        <button type="button" data-toggle-news="${escapeHTML(news.id)}"
          data-active="${news.is_active ? "true" : "false"}">
          ${news.is_active ? "Turn OFF" : "Turn ON"}
        </button>
        <button type="button" data-delete-news="${escapeHTML(news.id)}">
          Delete
        </button>
      </div>
    `).join("");

    list.querySelectorAll("[data-edit-news]").forEach((button) => {
      button.addEventListener("click", () => {
        const news = data.find(
          (item) => String(item.id) === button.dataset.editNews
        );
        if (!news) return;

        editingNewsId = news.id;

        const form = $("#news-form");
        form.elements.title.value = news.title || "";
        form.elements.body.value = news.body || "";
        form.elements.image_url.value = news.image_url || "";
        form.elements.youtube_url.value = news.youtube_url || "";
        form.elements.starts_at.value = toLocalDateTime(news.starts_at);
        form.elements.ends_at.value = toLocalDateTime(news.ends_at);
        form.elements.is_active.checked = Boolean(news.is_active);

        form.querySelector('button[type="submit"]').textContent =
          "Update News";

        $("#cancel-news-edit").hidden = false;
        form.scrollIntoView({ behavior: "smooth" });
      });
    });

    list.querySelectorAll("[data-toggle-news]").forEach((button) => {
      button.addEventListener("click", async () => {
        const currentlyActive = button.dataset.active === "true";

        const { error } = await db
          .from("breaking_news")
          .update({ is_active: !currentlyActive })
          .eq("id", button.dataset.toggleNews);

        if (error) {
          alert("Could not update news status.");
          return;
        }

        await refreshNewsList();
      });
    });

    list.querySelectorAll("[data-delete-news]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this news?")) return;

        const { error } = await db
          .from("breaking_news")
          .delete()
          .eq("id", button.dataset.deleteNews);

        if (error) {
          alert("Could not delete news.");
          return;
        }

        await refreshNewsList();
      });
    });
  }

  // -----------------------------
  // CATEGORIES
  // -----------------------------

  async function loadCategories() {
    pageContent.innerHTML = `
      <h2>Categories</h2>
      <form id="category-form" class="admin-form">
        <label>Category Name</label>
        <input name="name" required maxlength="100">
        <button type="submit">Add Category</button>
      </form>
      <div id="category-list">Loading...</div>
    `;

    $("#category-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = new FormData(event.currentTarget)
        .get("name").trim();

      const { error } = await db
        .from("categories")
        .insert([{ name }]);

      if (error) {
        alert("Could not add category: " + error.message);
        return;
      }

      await loadCategories();
    });

    const { data, error } = await db
      .from("categories")
      .select("*")
      .order("name");

    const list = $("#category-list");

    if (error) {
      list.textContent = "Could not load categories: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      list.textContent = "No categories yet.";
      return;
    }

    list.innerHTML = data.map((item) => `
      <div class="admin-list-item">
        ${escapeHTML(item.name)}
        <button type="button" data-delete-category="${escapeHTML(item.id)}">
          Delete
        </button>
      </div>
    `).join("");

    list.querySelectorAll("[data-delete-category]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this category?")) return;

        const { error } = await db
          .from("categories")
          .delete()
          .eq("id", button.dataset.deleteCategory);

        if (error) {
          alert("Could not delete category.");
          return;
        }

        await loadCategories();
      });
    });
  }

  // -----------------------------
  // CUSTOMERS
  // -----------------------------

  async function loadCustomers() {
    pageContent.innerHTML = "<h2>Customers</h2><div id='customer-list'>Loading...</div>";

    const { data, error } = await db
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    const list = $("#customer-list");

    if (error) {
      list.textContent = "Could not load customers: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      list.textContent = "No customers found.";
      return;
    }

    list.innerHTML = data.map((customer) => `
      <div class="admin-list-item">
        <strong>${escapeHTML(customer.name || customer.full_name || "Customer")}</strong>
        <p>${escapeHTML(customer.phone || "")}</p>
        <p>${escapeHTML(customer.email || "")}</p>
      </div>
    `).join("");
  }

  // -----------------------------
  // TABLES
  // -----------------------------

  async function loadTables() {
    pageContent.innerHTML = `
      <h2>Tavolo Management</h2>
      <form id="table-form" class="admin-form">
        <label>Table Name / Number</label>
        <input name="name" required>
        <label>Seats</label>
        <input name="capacity" type="number" min="1" value="2" required>
        <button type="submit">Add Table</button>
      </form>
      <div id="table-list">Loading...</div>
    `;

    $("#table-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const form = new FormData(event.currentTarget);

      const { error } = await db.from("restaurant_tables").insert([{
        name: String(form.get("name")).trim(),
        capacity: Number(form.get("capacity"))
      }]);

      if (error) {
        alert("Could not add table: " + error.message);
        return;
      }

      await loadTables();
    });

    const { data, error } = await db
      .from("restaurant_tables")
      .select("*")
      .order("name");

    const list = $("#table-list");

    if (error) {
      list.textContent = "Could not load tables: " + error.message;
      return;
    }

    list.innerHTML = (data || []).map((table) => `
      <div class="admin-list-item">
        <strong>${escapeHTML(table.name)}</strong>
        <p>Seats: ${escapeHTML(table.capacity)}</p>
      </div>
    `).join("") || "No tables added yet.";
  }

  // -----------------------------
  // COUPONS
  // -----------------------------

  async function loadCoupons() {
    pageContent.innerHTML = `
      <h2>Coupon Manager</h2>
      <form id="coupon-form" class="admin-form">
        <label>Coupon Code</label>
        <input name="code" required>
        <label>Discount (%)</label>
        <input name="discount_percent" type="number" min="1" max="100" required>
        <button type="submit">Add Coupon</button>
      </form>
      <div id="coupon-list">Loading...</div>
    `;

    $("#coupon-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const form = new FormData(event.currentTarget);

      const { error } = await db.from("coupons").insert([{
        code: String(form.get("code")).trim().toUpperCase(),
        discount_percent: Number(form.get("discount_percent"))
      }]);

      if (error) {
        alert("Could not add coupon: " + error.message);
        return;
      }

      await loadCoupons();
    });

    const { data, error } = await db
      .from("coupons")
      .select("*")
      .order("code");

    const list = $("#coupon-list");

    if (error) {
      list.textContent = "Could not load coupons: " + error.message;
      return;
    }

    list.innerHTML = (data || []).map((coupon) => `
      <div class="admin-list-item">
        <strong>${escapeHTML(coupon.code)}</strong>
        <p>${escapeHTML(coupon.discount_percent)}% discount</p>
      </div>
    `).join("") || "No coupons added yet.";
  }

  // -----------------------------
  // OPENING HOURS
  // -----------------------------

  async function loadOpeningHours() {
    pageContent.innerHTML = `
      <h2>Opening Hours</h2>
      <p>Opening hours management will be connected after the hours table is set up in Supabase.</p>
    `;
  }

  // -----------------------------
  // FOOD DELIVERY LINK
  // -----------------------------

  async function loadDelivery() {
    pageContent.innerHTML = `
      <h2>Food Delivery Link</h2>
      <form id="delivery-form" class="admin-form">
        <label>Delivery Website URL</label>
        <input name="url" type="url" required>
        <button type="submit">Save Link</button>
      </form>
      <div id="delivery-status"></div>
    `;

    $("#delivery-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const url = new FormData(event.currentTarget).get("url");

      const { error } = await db
        .from("site_settings")
        .upsert({
          setting_key: "delivery_url",
          setting_value: String(url)
        }, { onConflict: "setting_key" });

      $("#delivery-status").textContent = error
        ? "Could not save link: " + error.message
        : "Delivery link saved.";
    });
  }

  // =====================================
  // STAFF MANAGEMENT
  // =====================================

  let editingStaffId = null;

  async function loadStaff() {
    editingStaffId = null;

    pageContent.innerHTML = `
      <h2>Staff Management</h2>

      <form id="staff-form" class="admin-form">
        <label>Staff Full Name</label>
        <input name="full_name" required maxlength="120"
          placeholder="Enter staff name">

        <label>Job Title</label>
        <input name="job_title" maxlength="100"
          placeholder="Chef, Waiter, Manager...">

        <label>Phone Number</label>
        <input name="phone" maxlength="40"
          placeholder="Staff phone number">

        <label>Staff Photo URL</label>
        <input name="photo_url" type="url"
          placeholder="https://example.com/photo.jpg">

        <label>
          <input name="is_active" type="checkbox" checked>
          Active Staff
        </label>

        <button type="submit">Add Staff</button>
        <button type="button" id="cancel-staff-edit" hidden>
          Cancel Edit
        </button>
      </form>

      <h3>Staff List</h3>
      <div id="staff-list">Loading staff...</div>
    `;

    $("#staff-form").addEventListener("submit", saveStaff);

    $("#cancel-staff-edit").addEventListener("click", () => {
      loadStaff();
    });

    await refreshStaffList();
  }

  async function saveStaff(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const values = new FormData(form);

    const staffData = {
      full_name: String(values.get("full_name") || "").trim(),
      job_title: String(values.get("job_title") || "").trim() || null,
      phone: String(values.get("phone") || "").trim() || null,
      photo_url: String(values.get("photo_url") || "").trim() || null,
      is_active: values.get("is_active") === "on"
    };

    if (!staffData.full_name) {
      alert("Please enter the staff name.");
      return;
    }

    try {
      let result;

      if (editingStaffId) {
        result = await db
          .from("staff")
          .update(staffData)
          .eq("id", editingStaffId);
      } else {
        result = await db
          .from("staff")
          .insert([staffData]);
      }

      if (result.error) throw result.error;

      alert(editingStaffId
        ? "Staff information updated."
        : "New staff added successfully."
      );

      await loadStaff();

    } catch (error) {
      console.error("Staff save error:", error.message);
      alert("Could not save staff. Please check Supabase permissions.");
    }
  }

  async function refreshStaffList() {
    const list = $("#staff-list");
    if (!list) return;

    const { data, error } = await db
      .from("staff")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      list.textContent = "Could not load staff: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      list.textContent = "No staff members added yet.";
      return;
    }

    list.innerHTML = data.map((staff) => `
      <div class="admin-list-item">
        ${
          staff.photo_url
            ? `<img src="${escapeHTML(staff.photo_url)}"
                alt="Staff photo"
                width="75"
                height="75"
                style="object-fit:cover;border-radius:50%">`
            : ""
        }

        <h3>${escapeHTML(staff.full_name)}</h3>

        <p>${escapeHTML(staff.job_title || "No job title")}</p>
        <p>${escapeHTML(staff.phone || "No phone number")}</p>

        <p>
          Status:
          <strong>${staff.is_active ? "Active" : "Inactive"}</strong>
        </p>

        <button type="button" data-edit-staff="${escapeHTML(staff.id)}">
          Edit
        </button>

        <button type="button"
          data-toggle-staff="${escapeHTML(staff.id)}"
          data-active="${staff.is_active ? "true" : "false"}">
          ${staff.is_active ? "Deactivate" : "Activate"}
        </button>

        <button type="button" data-delete-staff="${escapeHTML(staff.id)}">
          Delete
        </button>
      </div>
    `).join("");

    // EDIT STAFF
    list.querySelectorAll("[data-edit-staff]").forEach((button) => {
      button.addEventListener("click", () => {
        const staff = data.find(
          (item) => item.id === button.dataset.editStaff
        );

        if (!staff) return;

        editingStaffId = staff.id;

        const form = $("#staff-form");

        form.elements.full_name.value = staff.full_name || "";
        form.elements.job_title.value = staff.job_title || "";
        form.elements.phone.value = staff.phone || "";
        form.elements.photo_url.value = staff.photo_url || "";
        form.elements.is_active.checked = Boolean(staff.is_active);

        form.querySelector('button[type="submit"]').textContent =
          "Update Staff";

        $("#cancel-staff-edit").hidden = false;

        form.scrollIntoView({ behavior: "smooth" });
      });
    });

    // ACTIVATE / DEACTIVATE STAFF
    list.querySelectorAll("[data-toggle-staff]").forEach((button) => {
      button.addEventListener("click", async () => {
        const currentlyActive = button.dataset.active === "true";

        const { error } = await db
          .from("staff")
          .update({ is_active: !currentlyActive })
          .eq("id", button.dataset.toggleStaff);

        if (error) {
          alert("Could not change staff status.");
          return;
        }

        await refreshStaffList();
      });
    });

    // DELETE STAFF
    list.querySelectorAll("[data-delete-staff]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this staff member?")) {
          return;
        }

        const { error } = await db
          .from("staff")
          .delete()
          .eq("id", button.dataset.deleteStaff);

        if (error) {
          alert("Could not delete staff member.");
          return;
        }

        await refreshStaffList();
      });
    });
  }

  // -----------------------------
  // CHECK EXISTING SESSION
  // -----------------------------

  async function initialise() {
    showLogin();

    const { data, error } = await db.auth.getSession();

    if (error || !data.session) return;

    const user = data.session.user;
    const allowed = await checkAdmin(user);

    if (!allowed) {
      await db.auth.signOut();
      showLogin("This account is not authorised as an admin.");
      return;
    }

   currentUser = user;
  showAdmin();
  await loadAdminLogo();
 await openPage("dashboard");
  }

  initialise();

})();
