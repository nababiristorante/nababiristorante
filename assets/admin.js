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
    if (loginView) loginView.style.display = "none";
    if (adminApp) adminApp.style.display = "block";
  }

  function showError(message) {
    if (pageContent) {
      pageContent.innerHTML =
        `<p class="admin-error">${escapeHTML(message)}</p>`;
    }
  }

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
    const button = event.target.closest("#admin-nav [data-page]");
    if (!button) return;

    event.preventDefault();
    await openPage(button.dataset.page);
  });

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

  // BREAKING NEWS

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
        <p>Starts: ${escapeHTML(news.starts_at || "")}</p>
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
          alert("Could not update news status: " + error.message);
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
          alert("Could not delete news: " + error.message);
          return;
        }

        await refreshNewsList();
      });
    });
  }

  // CATEGORIES

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
          alert("Could not delete category: " + error.message);
          return;
        }

        await loadCategories();
      });
    });
  }

  // CUSTOMERS

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

  // TABLES

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

  // COUPONS

  let couponStatusTimer = null;
  let currentCouponOffer = null;

  function couponStatus(offer) {
    if (!offer || !offer.is_enabled) {
      return { text: "OFF", color: "#b42318", bg: "#fee4e2" };
    }

    const start = new Date(offer.starts_at).getTime();
    const end = new Date(offer.ends_at).getTime();
    const now = Date.now();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return { text: "CHECK DATES", color: "#92400e", bg: "#fef3c7" };
    }

    if (now < start) {
      return { text: "SCHEDULED", color: "#92400e", bg: "#fef3c7" };
    }

    if (now >= end) {
      return { text: "EXPIRED", color: "#b42318", bg: "#fee4e2" };
    }

    return { text: "ACTIVE", color: "#067647", bg: "#d1fadf" };
  }

  function paintCouponStatus() {
    const badge = $("#coupon-status-badge");
    const note = $("#coupon-status-note");
    if (!badge) return;

    const status = couponStatus(currentCouponOffer);
    badge.textContent = status.text;
    badge.style.cssText =
      `display:inline-flex;align-items:center;padding:8px 13px;border-radius:999px;font-weight:800;font-size:13px;color:${status.color};background:${status.bg};`;

    if (note) {
      note.textContent = status.text === "ACTIVE"
        ? "Offer is live on the public website."
        : status.text === "SCHEDULED"
          ? "Offer is enabled and will appear automatically at the start time."
          : status.text === "EXPIRED"
            ? "Offer period has ended. It is hidden from the public website."
            : status.text === "OFF"
              ? "Offer is switched OFF and hidden from the public website."
              : "Please check the offer start and expiry dates.";
    }
  }

  async function loadCouponOfferSettings() {
    const { data, error } = await db
      .from("coupon_offer_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error) throw error;

    currentCouponOffer = data || {
      discount_percent: 10,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 86400000).toISOString(),
      is_enabled: false
    };

    const form = $("#coupon-settings-form");
    if (!form) return;

    form.elements.discount.value = currentCouponOffer.discount_percent ?? 10;
    form.elements.starts.value = toLocalDateTime(currentCouponOffer.starts_at);
    form.elements.ends.value = toLocalDateTime(currentCouponOffer.ends_at);
    form.elements.enabled.checked = Boolean(currentCouponOffer.is_enabled);

    paintCouponStatus();

    form.addEventListener("submit", saveCouponSettings);
    form.elements.enabled.addEventListener("change", handleEarlyStopToggle);
  }

  async function handleEarlyStopToggle(event) {
    const toggle = event.currentTarget;
    const nextEnabled = toggle.checked;
    const statusNote = $("#coupon-status-note");

    toggle.disabled = true;

    if (statusNote) {
      statusNote.textContent = nextEnabled
        ? "Turning the offer ON..."
        : "Stopping the offer on the website...";
    }

    try {
      if (nextEnabled) {
        const start = new Date(
          $("#coupon-settings-form").elements.starts.value
        ).getTime();

        const end = new Date(
          $("#coupon-settings-form").elements.ends.value
        ).getTime();

        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end <= start ||
          end <= Date.now()
        ) {
          throw new Error(
            "Set a valid future expiry time first, then Save the offer dates before turning it ON."
          );
        }
      }

      const { error } = await db
        .from("coupon_offer_settings")
        .update({
          is_enabled: nextEnabled,
          updated_at: new Date().toISOString()
        })
        .eq("id", true);

      if (error) throw error;

      currentCouponOffer = {
        ...currentCouponOffer,
        is_enabled: nextEnabled
      };

      paintCouponStatus();

      alert(
        nextEnabled
          ? "Coupon offer switched ON."
          : "Early Stop applied. Coupon offer is now OFF."
      );

    } catch (error) {
      toggle.checked = !nextEnabled;
      if (statusNote) statusNote.textContent = error.message;
      alert("Could not change offer status: " + error.message);

    } finally {
      toggle.disabled = false;
      paintCouponStatus();
    }
  }

  async function saveCouponSettings(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const discount = Number(form.elements.discount.value);
    const starts = new Date(form.elements.starts.value);
    const ends = new Date(form.elements.ends.value);

    if (!Number.isInteger(discount) || discount < 1 || discount > 100) {
      alert("Discount must be between 1 and 100.");
      return;
    }

    if (
      Number.isNaN(starts.getTime()) ||
      Number.isNaN(ends.getTime()) ||
      ends <= starts
    ) {
      alert("Expiry date and time must be later than the start date and time.");
      return;
    }

    const saveButton = form.querySelector('button[type="submit"]');

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
    }

    try {
      const { error } = await db
        .from("coupon_offer_settings")
        .update({
          discount_percent: discount,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          is_enabled: form.elements.enabled.checked,
          updated_at: new Date().toISOString()
        })
        .eq("id", true);

      if (error) throw error;

      currentCouponOffer = {
        ...currentCouponOffer,
        discount_percent: discount,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        is_enabled: form.elements.enabled.checked
      };

      paintCouponStatus();
      alert("Coupon offer settings saved successfully.");

    } catch (error) {
      alert("Could not save coupon settings: " + error.message);

    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Coupon Settings";
      }
    }
  }

  async function loadCoupons() {
    if (couponStatusTimer) clearInterval(couponStatusTimer);

    pageContent.innerHTML = `
      <h2>Coupon Manager</h2>
      <section class="admin-list-item" style="padding:18px;margin:16px 0;border:1px solid #d8b76a;border-radius:12px">
        <h3>Public Coupon Offer</h3>
        <p>Control the discount shown in the public Coupon Box.</p>

        <form id="coupon-settings-form" class="admin-form">
          <label>Discount Percentage (%)</label>
          <input name="discount" type="number" min="1" max="100" step="1" required>

          <label>Start Date &amp; Time</label>
          <input name="starts" type="datetime-local" required>

          <label>Expiry Date &amp; Time</label>
          <input name="ends" type="datetime-local" required>

          <label style="display:flex;align-items:center;gap:10px;margin:14px 0">
            <input name="enabled" type="checkbox" style="width:20px;height:20px">
            <span>
              <strong>Offer ON</strong>
              <small style="display:block">Turn OFF to stop the offer early. This switch updates the website immediately.</small>
            </span>
          </label>

          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <button type="submit">Save Coupon Settings</button>
            <span id="coupon-status-badge" aria-live="polite">Loading...</span>
          </div>

          <p id="coupon-status-note" aria-live="polite"></p>
          <p style="font-size:13px;color:#666">
            The status updates automatically as the scheduled start or expiry time is reached.
          </p>
        </form>
      </section>

      <section class="admin-list-item" style="padding:18px;margin:16px 0;border-radius:12px">
        <h3>Manual Coupon Entry</h3>
        <p>Existing manual coupon entry is retained.</p>

        <form id="coupon-form" class="admin-form">
          <label>Coupon Code</label>
          <input name="code" required>

          <label>Discount (%)</label>
          <input name="discount_percent" type="number" min="1" max="100" required>

          <button type="submit">Add Coupon</button>
        </form>
      </section>

      <div id="coupon-list">Loading coupons...</div>
    `;

    try {
      await loadCouponOfferSettings();
      couponStatusTimer = setInterval(paintCouponStatus, 1000);

    } catch (error) {
      const note = $("#coupon-status-note");
      if (note) {
        note.textContent = "Could not load offer settings: " + error.message;
      }
      console.error("Coupon offer settings error:", error);
    }

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

  // OPENING HOURS

  async function loadOpeningHours() {
    pageContent.innerHTML = `
      <h2>Opening Hours</h2>
      <p>Opening hours management will be connected after the hours table is set up in Supabase.</p>
    `;
  }

  // FOOD DELIVERY LINK

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

  // STAFF MANAGEMENT

  let editingStaffId = null;

  async function loadStaff() {
    editingStaffId = null;

    pageContent.innerHTML = `
      <h2>Staff Management</h2>

      <form id="staff-form" class="admin-form">
        <label>Staff Full Name</label>
        <input name="full_name" required maxlength="120" placeholder="Enter staff name">

        <label>Job Title</label>
        <input name="job_title" maxlength="100" placeholder="Chef, Waiter, Manager...">

        <label>Phone Number</label>
        <input name="phone" maxlength="40" placeholder="Staff phone number">

        <label>Staff Photo URL</label>
        <input name="photo_url" type="url" placeholder="https://example.com/photo.jpg">

        <label>
          <input name="is_active" type="checkbox" checked>
          Active Staff
        </label>

        <button type="submit">Add Staff</button>
        <button type="button" id="cancel-staff-edit" hidden>Cancel Edit</button>
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
        : "Staff member added.");

      await loadStaff();

    } catch (error) {
      console.error("Staff save error:", error.message);
      alert("Could not save staff information: " + error.message);
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
        <strong>${escapeHTML(staff.full_name)}</strong>
        <p>${escapeHTML(staff.job_title || "")}</p>
        <p>${escapeHTML(staff.phone || "")}</p>
        <p>Status: ${staff.is_active ? "Active" : "Inactive"}</p>

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

    list.querySelectorAll("[data-edit-staff]").forEach((button) => {
      button.addEventListener("click", () => {
        const staff = data.find(
          (item) => String(item.id) === button.dataset.editStaff
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

    list.querySelectorAll("[data-toggle-staff]").forEach((button) => {
      button.addEventListener("click", async () => {
        const currentlyActive = button.dataset.active === "true";

        const { error } = await db
          .from("staff")
          .update({ is_active: !currentlyActive })
          .eq("id", button.dataset.toggleStaff);

        if (error) {
          alert("Could not change staff status: " + error.message);
          return;
        }

        await refreshStaffList();
      });
    });

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
          alert("Could not delete staff member: " + error.message);
          return;
        }

        await refreshStaffList();
      });
    });
  }

  // CHECK EXISTING SESSION

  async function initialise() {
    showLogin();

    const { data, error } = await db.auth.getSession();

    if (error) {
      console.error("Session restore failed:", error.message);
      showLogin("Could not restore session. Please log in again.");
      return;
    }

    if (!data?.session) return;

    const user = data.session.user;
    const allowed = await checkAdmin(user);

    if (!allowed) {
      await db.auth.signOut();
      showLogin("This account is not authorised as an admin.");
      return;
    }

    currentUser = user;
    showAdmin();
    await openPage("dashboard");
  }

  initialise();

})();
