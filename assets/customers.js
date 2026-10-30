
/* ==========================================
   NABABI RISTORANTE
   CUSTOMER MANAGEMENT
   SUPABASE CONNECTED
========================================== */

(() => {
  "use strict";

  const config =
    window.NABABI_CONFIG ||
    window.SUPABASE_CONFIG ||
    window.supabaseConfig;

  if (!config || !window.supabase?.createClient) {
    console.error("Customers: Supabase configuration missing.");
    return;
  }

  const url = config.SUPABASE_URL || config.url;
  const key =
    config.SUPABASE_ANON_KEY ||
    config.anonKey ||
    config.key;

  if (!url || !key) {
    console.error("Customers: Supabase URL or public key missing.");
    return;
  }

  const client = window.supabase.createClient(url, key);

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  let customers = [];
  let currentPage = 0;
  const PAGE_SIZE = 50;

  function getContent() {
    return document.getElementById("page-content");
  }

  function renderPage() {
    const content = getContent();
    if (!content) return;

    content.innerHTML = `
      <div class="content-card">
        <h2>👥 Customer Management</h2>
        <p>Gestisci i clienti di Nababi Ristorante.</p>

        <input
          id="customer-search"
          type="search"
          placeholder="Search name, phone or email..."
          aria-label="Search customers"
        >

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;">
          <button class="save-button" id="customer-refresh" type="button">
            ↻ Refresh
          </button>
          <button class="save-button" id="customer-export" type="button">
            Export CSV
          </button>
        </div>

        <p id="customer-status">Loading customers...</p>

        <div id="customer-results"></div>

        <div style="display:flex;gap:10px;align-items:center;margin-top:15px;">
          <button type="button" id="customer-prev">Previous</button>
          <span id="customer-page"></span>
          <button type="button" id="customer-next">Next</button>
        </div>
      </div>
    `;

    document.getElementById("customer-search")
      .addEventListener("input", () => {
        currentPage = 0;
        renderCustomers();
      });

    document.getElementById("customer-refresh")
      .addEventListener("click", loadCustomers);

    document.getElementById("customer-export")
      .addEventListener("click", exportCSV);

    document.getElementById("customer-prev")
      .addEventListener("click", () => {
        if (currentPage > 0) {
          currentPage--;
          renderCustomers();
        }
      });

    document.getElementById("customer-next")
      .addEventListener("click", () => {
        const filtered = getFilteredCustomers();
        const pages = Math.ceil(filtered.length / PAGE_SIZE);

        if (currentPage + 1 < pages) {
          currentPage++;
          renderCustomers();
        }
      });
  }

  function getFilteredCustomers() {
    const query = (
      document.getElementById("customer-search")?.value || ""
    ).trim().toLowerCase();

    return customers.filter(customer => {
      const searchable = [
        customer.id,
        customer.name,
        customer.full_name,
        customer.phone,
        customer.email
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });
  }

  function renderCustomers() {
    const results = document.getElementById("customer-results");
    const status = document.getElementById("customer-status");
    const pageLabel = document.getElementById("customer-page");

    if (!results || !status) return;

    const filtered = getFilteredCustomers();
    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / PAGE_SIZE)
    );

    currentPage = Math.min(currentPage, totalPages - 1);

    const start = currentPage * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);

    status.textContent =
      `Showing ${filtered.length} of ${customers.length} customers`;

    pageLabel.textContent =
      `Page ${currentPage + 1} / ${totalPages}`;

    document.getElementById("customer-prev").disabled =
      currentPage === 0;

    document.getElementById("customer-next").disabled =
      currentPage + 1 >= totalPages;

    if (!visible.length) {
      results.innerHTML = "<p>No customers found.</p>";
      return;
    }

    results.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            ${visible.map(customer => `
              <tr>
                <td>${escapeHTML(customer.id)}</td>
                <td>${escapeHTML(
                  customer.full_name || customer.name || "—"
                )}</td>
                <td>${escapeHTML(customer.phone || "—")}</td>
                <td>${escapeHTML(customer.email || "—")}</td>
                <td>${customer.created_at
                  ? escapeHTML(
                      new Date(customer.created_at)
                        .toLocaleDateString("it-IT")
                    )
                  : "—"
                }</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function loadCustomers() {
    const status = document.getElementById("customer-status");
    const results = document.getElementById("customer-results");

    if (status) status.textContent = "Loading customers...";
    if (results) results.innerHTML = "";

    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error("Admin login required.");
      }

      const { data, error } = await client
        .from("customers")
        .select("id,name,full_name,phone,email,created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      customers = data || [];
      currentPage = 0;
      renderCustomers();

    } catch (error) {
      console.error("Customers loading error:", error);

      if (status) {
        status.textContent = "Could not load customers.";
      }

      if (results) {
        results.innerHTML = `
          <p style="color:#bd3545;">
            ${escapeHTML(error.message)}
          </p>
        `;
      }
    }
  }

  function exportCSV() {
    const filtered = getFilteredCustomers();

    if (!filtered.length) {
      alert("No customer records to export.");
      return;
    }

    const columns = [
      "id",
      "name",
      "full_name",
      "phone",
      "email",
      "created_at"
    ];

    const quote = value =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"';

    const csv = [
      columns.join(","),
      ...filtered.map(customer =>
        columns.map(column => quote(customer[column])).join(",")
      )
    ].join("\r\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);

    link.href = objectUrl;
    link.download = "nababi-customers.csv";
    link.click();

    URL.revokeObjectURL(objectUrl);
  }

  function openCustomers() {
    const title = document.getElementById("page-title");

    if (title) title.textContent = "Customers";

    renderPage();
    loadCustomers();
  }

  // Intercept only the Customers navigation button.
  // Other admin navigation remains with the existing admin.js.
  document.addEventListener("click", event => {
    const button = event.target.closest(
      '#admin-nav button[data-page="customers"]'
    );

    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    document.querySelectorAll("#admin-nav button")
      .forEach(item => item.classList.remove("active"));

    button.classList.add("active");

    openCustomers();

  }, true);

})();
