
/* ==================================================
   NABABI RISTORANTE
   ADMIN EXTRA PAGES
   Supabase-connected read-only management pages
================================================== */

(() => {
  "use strict";

  const config =
    window.NABABI_CONFIG ||
    window.SUPABASE_CONFIG ||
    window.supabaseConfig;

  if (!config || !window.supabase?.createClient) {
    console.error("Admin pages: Supabase configuration missing.");
    return;
  }

  const supabaseUrl = config.SUPABASE_URL || config.url;
  const supabaseKey =
    config.SUPABASE_ANON_KEY ||
    config.anonKey ||
    config.key;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Admin pages: Supabase credentials missing.");
    return;
  }

  const db = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
  );

  const PAGE_CONFIG = {
    categories: {
      title: "Menu Categories",
      table: "categories",
      columns: ["id", "name", "created_at"],
      order: "created_at"
    },

    attendance: {
      title: "Attendance Event History",
      table: "staff_attendance_events",
      columns: [
        "id",
        "staff_id",
        "event_type",
        "occurred_at",
        "source"
      ],
      order: "occurred_at",
      limit: 200
    },

    activity: {
      title: "Staff Activity Log",
      table: "staff_activity_logs",
      columns: [
        "id",
        "staff_id",
        "staff_name",
        "action",
        "details",
        "created_at"
      ],
      order: "created_at"
    },

    tables: {
      title: "Restaurant Tables",
      table: "restaurant_tables",
      columns: [
        "id",
        "name",
        "capacity",
        "is_active",
        "notes",
        "created_at"
      ],
      order: "created_at"
    },

    coupons: {
      title: "Coupon Manager",
      table: "coupons",
      columns: [
        "id",
        "code",
        "discount_percent",
        "is_active",
        "starts_at",
        "ends_at",
        "created_at"
      ],
      order: "created_at"
    },

    website: {
      title: "Website Status",
      table: "site_settings",
      columns: [
        "setting_key",
        "setting_value",
        "updated_at"
      ],
      order: "setting_key"
    },

    delivery: {
      title: "Delivery Settings",
      table: "site_settings",
      columns: [
        "setting_key",
        "setting_value",
        "updated_at"
      ],
      order: "setting_key",
      filter: "delivery_url"
    },

    hours: {
      title: "Restaurant Opening Hours",
      table: "opening_hours",
      columns: [
        "id",
        "day_of_week",
        "day_name",
        "is_closed",
        "opens_at",
        "closes_at",
        "updated_at"
      ],
      order: "day_of_week"
    },

    events: {
      title: "Staff Events and Advice",
      table: "staff_events",
      columns: [
        "id",
        "title",
        "body",
        "event_date",
        "is_active",
        "created_at"
      ],
      order: "event_date"
    },

    messages: {
      title: "Staff Messages",
      table: "staff_messages",
      columns: [
        "id",
        "title",
        "body",
        "audience",
        "is_active",
        "created_at"
      ],
      order: "created_at"
    },

    breaking: {
      title: "Website Announcements",
      table: "breaking_news",
      columns: [
        "id",
        "title",
        "body",
        "image_url",
        "youtube_url",
        "starts_at",
        "ends_at",
        "is_active",
        "created_at"
      ],
      order: "created_at"
    }
  };

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function getContent() {
    return document.getElementById("page-content");
  }

  function formatValue(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("it-IT");
  }

  function renderTable(columns, rows) {
    if (!rows.length) {
      return "<p>No records found.</p>";
    }

    return `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              ${columns.map(column =>
                `<th>${escapeHTML(column.replaceAll("_", " "))}</th>`
              ).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${columns.map(column => {
                  const value = row[column];

                  const display = [
                    "created_at",
                    "updated_at",
                    "occurred_at",
                    "event_date",
                    "starts_at",
                    "ends_at"
                  ].includes(column)
                    ? formatDate(value)
                    : formatValue(value);

                  return `<td>${escapeHTML(display)}</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderShell(title, description) {
    const content = getContent();
    if (!content) return;

    content.innerHTML = `
      <div class="content-card">
        <h2>${escapeHTML(title)}</h2>
        <p>${escapeHTML(description)}</p>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:15px 0;">
          <button id="extra-refresh" type="button">
            ↻ Refresh
          </button>
          <input
            id="extra-search"
            type="search"
            placeholder="Search records..."
            aria-label="Search records"
          >
        </div>

        <p id="extra-status">Loading...</p>
        <div id="extra-results"></div>
      </div>
    `;
  }

  function attachSearch(rows, columns) {
    const search = document.getElementById("extra-search");
    const results = document.getElementById("extra-results");

    if (!search || !results) return;

    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();

      const filtered = rows.filter(row =>
        columns.some(column =>
          formatValue(row[column]).toLowerCase().includes(query)
        )
      );

      results.innerHTML = renderTable(columns, filtered);
    });
  }

  async function loadTablePage(page) {
    const settings = PAGE_CONFIG[page];
    if (!settings) return;

    const titleElement = document.getElementById("page-title");
    if (titleElement) titleElement.textContent = settings.title;

    renderShell(
      settings.title,
      "Supabase database records"
    );

    const status = document.getElementById("extra-status");
    const results = document.getElementById("extra-results");

    document.getElementById("extra-refresh")
      ?.addEventListener("click", () => loadTablePage(page));

    try {
      const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error("Admin login required.");
      }

      let query = db
        .from(settings.table)
        .select(settings.columns.join(","));

      if (settings.filter) {
        query = query.eq(
          "setting_key",
          settings.filter
        );
      }

      query = query.order(settings.order, {
        ascending: page === "categories" || page === "hours"
      });

      query = query.limit(settings.limit || 200);

      const { data, error } = await query;

      if (error) throw error;

      const rows = data || [];

      status.textContent =
        `${rows.length} record(s) loaded`;

      results.innerHTML = renderTable(
        settings.columns,
        rows
      );

      attachSearch(rows, settings.columns);

    } catch (error) {
      console.error(settings.title, error);

      status.textContent = "Could not load records.";

      results.innerHTML = `
        <p style="color:#bd3545;">
          ${escapeHTML(error.message)}
        </p>
        <p>
          Check the Supabase table, columns and Row Level Security permissions.
        </p>
      `;
    }
  }

  async function loadPerformance() {
    const title = "Staff Performance";

    const titleElement = document.getElementById("page-title");
    if (titleElement) titleElement.textContent = title;

    renderShell(
      title,
      "Summary based on recorded staff attendance."
    );

    const status = document.getElementById("extra-status");
    const results = document.getElementById("extra-results");

    document.getElementById("extra-refresh")
      ?.addEventListener("click", loadPerformance);

    try {
      const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error("Admin login required.");
      }

      const { data, error } = await db
        .from("staff_attendance")
        .select("staff_id,staff_name,attendance_date,check_in,check_out,status")
        .order("attendance_date", { ascending: false })
        .limit(500);

      if (error) throw error;

      const summary = {};

      (data || []).forEach(record => {
        const key = record.staff_id || record.staff_name || "Unknown";

        if (!summary[key]) {
          summary[key] = {
            staff_name: record.staff_name || "Unknown",
            total_records: 0,
            present: 0,
            absent: 0,
            with_check_in: 0,
            with_check_out: 0
          };
        }

        const item = summary[key];

        item.total_records++;

        if (record.status === "present") item.present++;
        if (record.status === "absent") item.absent++;
        if (record.check_in) item.with_check_in++;
        if (record.check_out) item.with_check_out++;
      });

      const rows = Object.values(summary);

      status.textContent =
        `${rows.length} staff member(s) found`;

      results.innerHTML = renderTable(
        [
          "staff_name",
          "total_records",
          "present",
          "absent",
          "with_check_in",
          "with_check_out"
        ],
        rows
      );

    } catch (error) {
      console.error("Staff performance:", error);

      status.textContent = "Could not load performance.";

      results.innerHTML = `
        <p style="color:#bd3545;">
          ${escapeHTML(error.message)}
        </p>
      `;
    }
  }

  const PAGE_HANDLERS = {
    categories: () => loadTablePage("categories"),
    attendance: () => loadTablePage("attendance"),
    activity: () => loadTablePage("activity"),
    tables: () => loadTablePage("tables"),
    coupons: () => loadTablePage("coupons"),
    website: () => loadTablePage("website"),
    delivery: () => loadTablePage("delivery"),
    hours: () => loadTablePage("hours"),
    events: () => loadTablePage("events"),
    messages: () => loadTablePage("messages"),
    breaking: () => loadTablePage("breaking"),
    performance: loadPerformance
  };

  /*
   * Capture only the listed navigation items.
   * Other admin navigation is left untouched.
   */
  document.addEventListener("click", event => {
    const button = event.target.closest(
      "#admin-nav [data-page]"
    );

    if (!button) return;

    const page = button.getAttribute("data-page");
    const handler = PAGE_HANDLERS[page];

    if (!handler) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    document.querySelectorAll("#admin-nav [data-page]")
      .forEach(item => item.classList.remove("active"));

    button.classList.add("active");

    handler();

  }, true);

  console.log("Nababi extra admin pages loaded.");

})();
