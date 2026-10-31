
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
      #page-content input[type="checkbox"] {
        width:auto; margin-right:8px;
      }
      #page-content button { min-height:42px; cursor:pointer; }
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
      .admin-table-wrap { overflow-x:auto; }
      .admin-table {
        width:100%; border-collapse:collapse; min-width:520px;
      }
      .admin-table th,.admin-table td {
        padding:10px; border-bottom:1px solid #eee;
        text-align:left;
      }
      .admin-table th { background:#f7f1e5; }
      .admin-panel-card {
        background:#fff; border:1px solid #eadff0;
        border-radius:12px; padding:15px; margin-bottom:15px;
      }
      .admin-panel-card h2 { margin-top:0; }
      .admin-primary {
        background:#32134f; color:white; border:0;
        border-radius:7px; padding:11px 16px;
      }
      .admin-danger {
        background:#a52b35; color:white; border:0;
        border-radius:7px; padding:11px 16px;
      }
      .admin-stats {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px; margin-bottom:16px;
      }
      .admin-stat {
        padding:16px; background:#f7f1e5;
        border-radius:10px; min-width:0;
      }
      .admin-stat strong {
        display:block; font-size:24px; margin-top:6px;
      }
      .coupon-logo-preview {
        display:block; max-width:220px; max-height:130px;
        object-fit:contain; margin:12px 0;
        padding:8px; background:#32134f;
        border-radius:10px;
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
        .stats,.admin-stats { grid-template-columns:1fr !important; }
        .staff-grid { grid-template-columns:1fr; }
        .staff-photo,.staff-photo-placeholder { height:220px; }
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
    if (loginView) loginView.hidden = false;
    if (adminApp) adminApp.hidden = true;
  }

  function showAdmin() {
    if (loginView) loginView.hidden = true;
    if (adminApp) adminApp.hidden = false;
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
      await loadCouponDashboard();
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

  // =========================================
  // COUPON BOX LOGO MANAGER
  // =========================================

  async function loadCouponLogo() {
    const preview = $("#coupon-logo-preview");
    const status = $("#coupon-logo-status");

    if (!preview) return;

    const { data, error } = await db
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "coupon_logo_url")
      .maybeSingle();

    if (error) {
      if (status) status.textContent =
        "Saved logo load করা যায়নি: " + error.message;
      return;
    }

    if (data?.setting_value) {
      preview.src = data.setting_value;
      preview.hidden = false;
      if (status) status.textContent = "বর্তমান Coupon Logo লোড হয়েছে।";
    } else {
      preview.hidden = true;
      if (status) status.textContent = "এখনও Coupon Logo Save করা হয়নি।";
    }
  }

  async function saveCouponLogo(event) {
    event.preventDefault();

    const fileInput = $("#coupon-logo-file");
    const preview = $("#coupon-logo-preview");
    const status = $("#coupon-logo-status");
    const button = $("#coupon-logo-save");
    const file = fileInput?.files?.[0];

    if (!file) {
      status.textContent = "প্রথমে একটি Logo ছবি নির্বাচন করুন।";
      return;
    }

    const allowed = ["image/png", "image/jpeg", "image/webp"];

    if (!allowed.includes(file.type)) {
      status.textContent = "শুধু PNG, JPG অথবা WEBP ছবি ব্যবহার করুন।";
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      status.textContent = "Logo-এর সাইজ ৩ MB-এর কম হতে হবে।";
      return;
    }

    button.disabled = true;
    status.textContent = "Logo Upload হচ্ছে...";

    try {
      const extension =
        file.type === "image/png" ? "png" :
        file.type === "image/webp" ? "webp" : "jpg";

      const path =
        `coupon-logo/coupon-logo-${Date.now()}.${extension}`;

      const { error: uploadError } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      const logoUrl = publicData?.publicUrl;

      if (!logoUrl) {
        throw new Error("Logo-এর Public URL পাওয়া যায়নি।");
      }

      const { error: saveError } = await db
        .from("site_settings")
        .upsert({
          setting_key: "coupon_logo_url",
          setting_value: logoUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: "setting_key" });

      if (saveError) throw saveError;

      preview.src = logoUrl;
      preview.hidden = false;
      status.textContent = "Coupon Box Logo সফলভাবে Save হয়েছে।";
      fileInput.value = "";
    } catch (error) {
      status.textContent = "Logo Save করা যায়নি: " + error.message;
    } finally {
      button.disabled = false;
    }
  }

  function setupCouponLogoForm() {
    const fileInput = $("#coupon-logo-file");
    const preview = $("#coupon-logo-preview");
    const form = $("#coupon-logo-form");
    const status = $("#coupon-logo-status");

    if (!fileInput || !preview || !form) return;

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];

      if (!file) return;

      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        status.textContent = "শুধু PNG, JPG অথবা WEBP ছবি ব্যবহার করুন।";
        fileInput.value = "";
        return;
      }

      if (file.size > 3 * 1024 * 1024) {
        status.textContent = "Logo-এর সাইজ ৩ MB-এর কম হতে হবে।";
        fileInput.value = "";
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      preview.src = previewUrl;
      preview.hidden = false;
      status.textContent = "Preview তৈরি হয়েছে। Save Coupon Logo চাপুন।";
    });

    form.addEventListener("submit", saveCouponLogo);
    loadCouponLogo();
  }

  // =========================================
  // COUPON DASHBOARD
  // =========================================

  async function loadCouponDashboard() {
    setPage("Coupon Dashboard", `
      <div class="admin-stats">
        <div class="admin-stat">Generated Coupons
          <strong id="coupon-generated">...</strong>
        </div>
        <div class="admin-stat">Redeemed
          <strong id="coupon-redeemed">...</strong>
        </div>
        <div class="admin-stat">Unused
          <strong id="coupon-unused">...</strong>
        </div>
        <div class="admin-stat">Current Discount
          <strong id="coupon-discount">...</strong>
        </div>
      </div>

      <div class="admin-panel-card">
        <h2>Coupon Box Logo</h2>
        <p>Website-এর Coupon Box-এ যে Logo দেখাতে চান সেটি এখানে Upload করুন।</p>

        <form id="coupon-logo-form">
          <label>Choose Coupon Logo</label>
          <input
            type="file"
            id="coupon-logo-file"
            accept="image/png,image/jpeg,image/webp"
          >

          <img
            id="coupon-logo-preview"
            class="coupon-logo-preview"
            alt="Coupon Logo Preview"
            hidden
          >

          <button
            type="submit"
            id="coupon-logo-save"
            class="admin-primary"
          >
            Save Coupon Logo
          </button>

          <p id="coupon-logo-status" aria-live="polite"></p>
        </form>
      </div>

      <div class="admin-panel-card">
        <h2>Coupon Offer Settings</h2>
        <form id="coupon-settings-form">
          <label>Discount Percentage (%)</label>
          <input name="discount" type="number"
            min="1" max="100" step="1" required>

          <label>Start Date & Time</label>
          <input name="starts" type="datetime-local" required>

          <label>Expiry Date & Time</label>
          <input name="ends" type="datetime-local" required>

          <label>
            <input name="enabled" type="checkbox">
            Enable Coupon Offer
          </label>

          <button class="admin-primary" type="submit">
            Save Coupon Settings
          </button>
        </form>
        <p id="coupon-offer-status"></p>
      </div>

      <div class="admin-panel-card">
        <h2>Verify & Redeem Coupon</h2>
        <form id="coupon-redeem-form">
          <label>Customer Coupon Code</label>
          <input name="code"
            placeholder="NABABI-123456" required>
          <button class="admin-primary" type="submit">
            Verify & Redeem
          </button>
        </form>
        <div id="coupon-result" aria-live="polite"></div>
      </div>

      <div class="admin-panel-card">
        <h2>Recent Coupons</h2>
        <div id="coupon-list">Loading...</div>
      </div>
    `);

    setupCouponLogoForm();

    const { data: offer, error: offerError } = await db
      .from("coupon_offer_settings")
      .select("*")
      .eq("id", true)
      .single();

    if (offerError) throw offerError;

    const form = $("#coupon-settings-form");

    const toLocalInput = value => {
      const date = new Date(value);
      const local = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
      );
      return local.toISOString().slice(0, 16);
    };

    form.elements.discount.value = offer.discount_percent;
    form.elements.starts.value = toLocalInput(offer.starts_at);
    form.elements.ends.value = toLocalInput(offer.ends_at);
    form.elements.enabled.checked = offer.is_enabled;

    const now = Date.now();
    const starts = new Date(offer.starts_at).getTime();
    const ends = new Date(offer.ends_at).getTime();

    let status = "Offer is disabled";

    if (offer.is_enabled && now < starts) status = "Offer scheduled";
    if (offer.is_enabled && now >= starts && now < ends) status = "Offer is active";
    if (now >= ends) status = "Discount Offer Has Ended";

    $("#coupon-offer-status").textContent = status;

    form.addEventListener("submit", saveCouponSettings);
    $("#coupon-redeem-form").addEventListener("submit", redeemCoupon);

    const { data: coupons, error } = await db
      .from("coupons")
      .select("id,code,discount_percent,is_active,starts_at,ends_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const { data: redemptions, error: redemptionError } = await db
      .from("coupon_redemptions")
      .select("coupon_id");

    if (redemptionError) throw redemptionError;

    const redeemedIds = new Set(
      (redemptions || []).map(item => String(item.coupon_id))
    );

    const generated = coupons?.length || 0;
    const redeemed = redeemedIds.size;

    const activeUnused = (coupons || []).filter(c =>
      c.is_active &&
      !redeemedIds.has(String(c.id)) &&
      Date.now() < new Date(c.ends_at).getTime()
    ).length;

    $("#coupon-generated").textContent = generated;
    $("#coupon-redeemed").textContent = redeemed;
    $("#coupon-unused").textContent = activeUnused;
    $("#coupon-discount").textContent = offer.discount_percent + "%";

    $("#coupon-list").innerHTML = !generated
      ? "<p>No coupons generated yet.</p>"
      : `<div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              ${(coupons || []).map(c => {
                const used = redeemedIds.has(String(c.id));
                const expired =
                  !c.is_active ||
                  Date.now() >= new Date(c.ends_at).getTime();

                const couponStatus = used
                  ? "Redeemed"
                  : expired ? "Expired" : "Unused";

                return `<tr>
                  <td>${escapeHTML(c.code)}</td>
                  <td>${escapeHTML(c.discount_percent)}%</td>
                  <td>${couponStatus}</td>
                  <td>${escapeHTML(
                    new Date(c.ends_at).toLocaleString()
                  )}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`;
  }

  async function saveCouponSettings(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const discount = Number(form.elements.discount.value);
    const starts = new Date(form.elements.starts.value);
    const ends = new Date(form.elements.ends.value);

    if (!Number.isInteger(discount) || discount < 1 || discount > 100) {
      notify("Discount ১ থেকে ১০০-এর মধ্যে হতে হবে।", "error");
      return;
    }

    if (
      !Number.isFinite(starts.getTime()) ||
      !Number.isFinite(ends.getTime()) ||
      ends <= starts
    ) {
      notify("সঠিক Start ও Expiry Date দিন।", "error");
      return;
    }

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

    if (error) {
      notify(error.message, "error");
      return;
    }

    notify("Coupon Offer Settings সংরক্ষণ হয়েছে।");
    await loadCouponDashboard();
  }

  async function redeemCoupon(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const code = String(
      new FormData(form).get("code") || ""
    ).trim();

    const resultBox = $("#coupon-result");
    resultBox.textContent = "Checking...";

    const { data, error } = await db.rpc(
      "redeem_nababi_coupon",
      { p_code: code }
    );

    if (error) {
      resultBox.textContent = error.message;
      resultBox.style.color = "#a21d1d";
      return;
    }

    resultBox.textContent = data?.message || "Unknown response";
    resultBox.style.color =
      data?.success ? "#176b38" : "#a21d1d";

    if (data?.success) {
      form.reset();
      await loadCouponDashboard();
    }
  }

  // =========================================
  // WEBSITE ON / OFF
  // =========================================

  async function loadWebsiteSettings() {
    setPage("Website ON/OFF", `
      <div class="admin-panel-card">
        <h2>Website Status</h2>
        <p id="website-status">Loading...</p>
        <button id="website-toggle" class="admin-primary"
          type="button">Loading...</button>
      </div>
    `);

    const { data, error } = await db
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "website_enabled")
      .maybeSingle();

    if (error) throw error;

    let enabled = data?.setting_value !== "false";

    const render = () => {
      $("#website-status").textContent =
        enabled ? "Website is ON" : "Website is OFF";

      $("#website-toggle").textContent =
        enabled ? "Turn Website OFF" : "Turn Website ON";
    };

    render();

    $("#website-toggle").addEventListener("click", async () => {
      const next = !enabled;

      const { error: updateError } = await db
        .from("site_settings")
        .upsert({
          setting_key: "website_enabled",
          setting_value: String(next),
          updated_at: new Date().toISOString()
        }, { onConflict: "setting_key" });

      if (updateError) {
        notify(updateError.message, "error");
        return;
      }

      enabled = next;
      render();

      notify(enabled ? "Website ON হয়েছে।" : "Website OFF হয়েছে।");
    });
  }

  // =========================================
  // STAFF PHOTO UPLOAD
  // =========================================

  async function uploadStaffPhoto(file, staffId) {
    if (!file) return null;

    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.type)) {
      throw new Error("শুধু JPG, PNG অথবা WEBP ছবি ব্যবহার করুন।");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("ছবির সাইজ ৫ MB-এর কম হতে হবে।");
    }

    const extension =
      file.type === "image/png" ? "png" :
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

          <img id="new-photo-preview"
            class="staff-photo-preview"
            alt="Photo preview" hidden>

          <button class="save-button" type="submit">Add Staff</button>
        </form>
      `)}
      ${card("Staff List", `<div id="staff-list">Loading...</div>`)}
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
          "Staff যোগ হয়েছে, কিন্তু ছবি আপলোড হয়নি: " +
          uploadError.message,
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
      .select(
        "id,full_name,job_title,phone,photo_url,is_active,created_at,pin_updated_at"
      )
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
                <button class="save-button" type="submit">
                  Save Changes
                </button>
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

    list.onclick = handleStaffAction;
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
      .select("is_active")
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

  // =========================================
  // ATTENDANCE
  // =========================================

  async function loadAttendance() {
    setPage("Staff Attendance", card(
      "Attendance Event History",
      `<p>সর্বশেষ ২০০টি Check-in / Check-out Event</p>
       <div id="attendance-list">Loading...</div>`
    ));

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
        <strong>${escapeHTML(
          names.get(item.staff_id) || "Unknown Staff"
        )}</strong>
        <p>${item.event_type === "check_in" ? "Check In" : "Check Out"}</p>
        <p>${escapeHTML(
          new Date(item.occurred_at).toLocaleString()
        )}</p>
        <small>Source: ${escapeHTML(item.source || "Unknown")}</small>
      </div>
    `).join("");
  }
// =========================================
// MENU CATEGORIES: ADD / EDIT / DELETE
// =========================================

async function loadCategories() {
  setPage("Menu Categories", `
    <div class="admin-panel-card">
      <h2>Add New Category</h2>

      <form id="category-form">
        <label>Category Name</label>
        <input
          name="name"
          type="text"
          placeholder="যেমন: Antipasti"
          maxlength="100"
          required
        >

        <button class="admin-primary" type="submit">
          Add Category
        </button>
      </form>
    </div>

    <div class="admin-panel-card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <h2>Menu Categories</h2>
        <button id="category-refresh" class="admin-primary" type="button">
          ↻ Refresh
        </button>
      </div>

      <p id="category-count">Loading...</p>
      <div id="category-list">Loading...</div>
    </div>
  `);

  const form = $("#category-form");
  const list = $("#category-list");
  const count = $("#category-count");

  async function refresh() {
    list.textContent = "Loading...";
    count.textContent = "Loading...";

    const { data, error } = await db
      .from("categories")
      .select("id,name,created_at")
      .order("id", { ascending: true });

    if (error) {
      list.textContent = error.message;
      count.textContent = "Load failed";
      return;
    }

    count.textContent = `${data.length} record(s) loaded`;

    if (!data.length) {
      list.innerHTML = "<p>No categories found.</p>";
      return;
    }

    list.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Category Name</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => `
              <tr>
                <td>${escapeHTML(item.id)}</td>
                <td>
                  <input
                    class="category-name-input"
                    data-id="${escapeHTML(item.id)}"
                    value="${escapeHTML(item.name)}"
                    maxlength="100"
                    aria-label="Category name"
                  >
                </td>
                <td>${escapeHTML(
                  new Date(item.created_at).toLocaleDateString()
                )}</td>
                <td>
                  <div class="staff-actions">
                    <button
                      type="button"
                      data-category-action="edit"
                      data-id="${escapeHTML(item.id)}"
                    >Save</button>

                    <button
                      type="button"
                      class="danger"
                      data-category-action="delete"
                      data-id="${escapeHTML(item.id)}"
                    >Delete</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const name = String(new FormData(form).get("name") || "").trim();

    if (!name) {
      notify("Category Name লিখুন।", "error");
      return;
    }

    const { error } = await db
      .from("categories")
      .insert({ name });

    if (error) {
      notify("Category যোগ করা যায়নি: " + error.message, "error");
      return;
    }

    form.reset();
    notify("নতুন Category যোগ হয়েছে।");
    await refresh();
  });

  $("#category-refresh").addEventListener("click", refresh);

  list.addEventListener("click", async event => {
    const button = event.target.closest("button[data-category-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.categoryAction;

    if (action === "edit") {
      const input = list.querySelector(
        `.category-name-input[data-id="${CSS.escape(id)}"]`
      );

      const name = input?.value.trim();

      if (!name) {
        notify("Category Name খালি রাখা যাবে না।", "error");
        return;
      }

      const { error } = await db
        .from("categories")
        .update({ name })
        .eq("id", id);

      if (error) {
        notify("Update করা যায়নি: " + error.message, "error");
        return;
      }

      notify("Category Update হয়েছে।");
      await refresh();
    }

    if (action === "delete") {
      if (!confirm("এই Category Delete করতে চান?")) return;

      const { error } = await db
        .from("categories")
        .delete()
        .eq("id", id);

      if (error) {
        notify("Delete করা যায়নি: " + error.message, "error");
        return;
      }

      notify("Category Delete হয়েছে।");
      await refresh();
    }
  });

  await refresh();
}
  // =========================================
  // OTHER ADMIN PAGES
  // =========================================

  function placeholder(title, description) {
    setPage(title, card(title, `
      <p>${escapeHTML(description)}</p>
      <p>এই অংশটি চালু করতে সংশ্লিষ্ট Supabase Table ও Column যাচাই করতে হবে।</p>
    `));
  }

  const pages = {
    dashboard: loadCouponDashboard,
    coupons: loadCouponDashboard,
    website: loadWebsiteSettings,
    staff: loadStaff,
    attendance: loadAttendance,
    customers: () => placeholder("Customers", "Customer Management"),
    categories: loadCategories,
    performance: () => placeholder("Staff Performance", "Staff Performance"),
    activity: () => placeholder("Staff Activity Log", "Staff Activity History"),
    tables: () => placeholder("Tavolo", "Restaurant Tables"),
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

  // =========================================
  // RESTAURANT LOGO UPLOAD
  // =========================================

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.type)) {
      alert("শুধু JPG, PNG অথবা WEBP ছবি ব্যবহার করুন।");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Logo-এর সাইজ ৫ MB-এর কম হতে হবে।");
      return;
    }

    try {
      const extension =
        file.type === "image/png" ? "png" :
        file.type === "image/webp" ? "webp" : "jpg";

      const path = `restaurant-logo/logo-${Date.now()}.${extension}`;

      const { error } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      const logoUrl = data.publicUrl;

      const { error: settingsError } = await db
        .from("site_settings")
        .upsert({
          setting_key: "logo_url",
          setting_value: logoUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: "setting_key" });

      if (settingsError) throw settingsError;

      $("#admin-logo").src = logoUrl;
      $("#admin-logo").hidden = false;
      $("#admin-logo-fallback").hidden = true;

      alert("Logo upload ও সংরক্ষণ হয়েছে।");
    } catch (error) {
      alert(error.message || "Logo upload করা যায়নি।");
    }
  }

  function setupLogo() {
    $("#change-logo")?.addEventListener("click", () => {
      $("#logo-file")?.click();
    });

    $("#logo-file")?.addEventListener("change", uploadLogo);
  }

  // =========================================
  // RESTORE SESSION
  // =========================================

  async function restoreSession() {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

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
      await loadCouponDashboard();
    } catch (error) {
      console.error(error);
      showLogin();
    }
  }

  // =========================================
  // START
  // =========================================

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
