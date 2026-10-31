
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));

  const loginForm = $("#loginForm");
  const loginBox = $("#login");
  const app = $("#app");
  const errorBox = $("#error");
  const emailInput = $("#email");
  const passwordInput = $("#password");

  if (!loginForm || !errorBox || !emailInput || !passwordInput) {
    console.error("Nababi Admin: Login HTML elements missing.");
    return;
  }

  function showMessage(message, success = false) {
    errorBox.textContent = message;
    errorBox.style.color = success ? "#d8b76a" : "#e6a09a";
  }

  // Supabase configuration
  const config = window.NABABI_CONFIG || {};
  const supabaseLib = window.supabase;
  let db = null;

  if (!supabaseLib || !supabaseLib.createClient) {
    showMessage("Supabase SDK caricato. Ricarica la pagina e riprova.");
  } else if (
    !config.SUPABASE_URL ||
    !config.SUPABASE_ANON_KEY ||
    config.SUPABASE_URL.includes("YOUR-") ||
    config.SUPABASE_ANON_KEY.includes("YOUR_")
  ) {
    showMessage("Configurazione Supabase mancante.");
  } else {
    try {
      db = supabaseLib.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY
      );
      showMessage("Supabase pronto. Inserisci le credenziali.", true);
    } catch (error) {
      console.error(error);
      showMessage("Errore durante la connessione a Supabase.");
    }
  }

  // Add login button loading support
  let loginButton = loginForm.querySelector('button[type="submit"]');

  if (!loginButton) {
    loginButton = loginForm.querySelector("button");
  }

  if (loginButton) {
    loginButton.type = "submit";
  }

  // Add password recovery link if it does not exist
  let forgotLink = $("#forgotPassword");

  if (!forgotLink) {
    forgotLink = document.createElement("a");
    forgotLink.id = "forgotPassword";
    forgotLink.href = "#";
    forgotLink.textContent = "Password dimenticata?";
    forgotLink.style.display = "block";
    forgotLink.style.marginTop = "15px";
    loginForm.appendChild(forgotLink);
  }

  // Password reset area
  let resetBox = $("#resetBox");

  if (!resetBox) {
    resetBox = document.createElement("section");
    resetBox.id = "resetBox";
    resetBox.hidden = true;

    resetBox.innerHTML = `
      <h2>Nuova password</h2>
      <label>
        Nuova password
        <input
          id="newPassword"
          type="password"
          minlength="8"
          autocomplete="new-password"
        >
      </label>
      <button type="button" id="savePassword" class="btn">
        Salva nuova password
      </button>
    `;

    loginForm.appendChild(resetBox);
  }

  // Show dashboard after successful login
  async function showApp() {
    loginBox.hidden = true;
    app.hidden = false;
    await loadPage("dashboard");
  }

  // Dashboard and admin pages
  async function loadPage(pageName) {
    const title = $("#title");
    const view = $("#view");

    if (!title || !view) return;

    title.textContent =
      pageName.charAt(0).toUpperCase() + pageName.slice(1);

    if (!db) {
      view.innerHTML =
        "<section class='box'>Supabase non configurato.</section>";
      return;
    }

    if (pageName === "dashboard") {
      view.innerHTML =
        "<section class='box'>Caricamento dashboard...</section>";

      const results = await Promise.all([
        db.from("categories").select("*", {
          count: "exact",
          head: true
        }),
        db.from("menu_items").select("*", {
          count: "exact",
          head: true
        }),
        db.from("bookings").select("*", {
          count: "exact",
          head: true
        })
      ]);

      const [categories, menu, bookings] = results;
      const errors = results.filter((item) => item.error);

      if (errors.length) {
        view.innerHTML = `
          <section class="box error">
            ${errors.map((item) =>
              esc(item.error.message)
            ).join("<br>")}
          </section>`;
        return;
      }

      view.innerHTML = `
        <div class="stats">
          <div class="box">
            Categories
            <h2>${categories.count ?? "—"}</h2>
          </div>

          <div class="box">
            Menu Items
            <h2>${menu.count ?? "—"}</h2>
          </div>

          <div class="box">
            Bookings
            <h2>${bookings.count ?? "—"}</h2>
          </div>
        </div>

        <section class="box">
          Benvenuto nel pannello Admin Nababi.
        </section>
      `;

      return;
    }

    const tables = {
      categories: "categories",
      bookings: "bookings",
      menu: "menu_items",
      coupons: "coupons",
      news: "breaking_news"
    };

    const table = tables[pageName];

    if (!table) return;

    view.innerHTML =
      "<section class='box'>Caricamento...</section>";

    const result = await db
      .from(table)
      .select("*")
      .limit(100);

    if (result.error) {
      view.innerHTML = `
        <section class="box error">
          ${esc(result.error.message)}
        </section>`;
      return;
    }

    if (pageName === "categories") {
      view.innerHTML = `
        <section class="box">
          <form id="addCategory">
            <input
              name="name"
              placeholder="Nuova categoria"
              required
            >
            <button class="btn" type="submit">
              Aggiungi
            </button>
          </form>

          ${(result.data || []).map((item) => `
            <p class="row">
              ${esc(item.name)}
              <button
                type="button"
                data-del="${esc(item.id)}"
              >
                Elimina
              </button>
            </p>
          `).join("")}
        </section>
      `;

      $("#addCategory").onsubmit = async (event) => {
        event.preventDefault();

        const name = new FormData(event.currentTarget)
          .get("name");

        const response = await db
          .from("categories")
          .insert({ name });

        if (response.error) {
          alert(response.error.message);
        } else {
          await loadPage("categories");
        }
      };

      view.onclick = async (event) => {
        const id = event.target.dataset.del;

        if (!id || !confirm("Eliminare questa categoria?")) {
          return;
        }

        const response = await db
          .from("categories")
          .delete()
          .eq("id", id);

        if (response.error) {
          alert(response.error.message);
        } else {
          await loadPage("categories");
        }
      };

    } else {
      view.innerHTML = `
        <section class="box">
          <p>${(result.data || []).length} record caricati.</p>

          ${(result.data || []).map((item) => `
            <p class="row">
              ${esc(item.name || item.title || item.code || item.id)}
            </p>
          `).join("")}
        </section>
      `;
    }
  }

  // LOGIN
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!db) {
      showMessage("Supabase non pronto. Ricarica la pagina.");
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showMessage("Inserisci email e password.");
      return;
    }

    const originalText = loginButton
      ? loginButton.textContent
      : "Accedi";

    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = "Accesso in corso...";
    }

    showMessage("Verifica accesso...", true);

    try {
      const { data, error } =
        await db.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        console.error("Nababi login error:", error);
        showMessage(error.message);
        return;
      }

      if (!data || !data.session) {
        showMessage("Sessione non ricevuta. Riprova.");
        return;
      }

      await showApp();

    } catch (error) {
      console.error("Nababi login exception:", error);
      showMessage(
        "Errore di connessione. Controlla Internet e riprova."
      );

    } finally {
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = originalText;
      }
    }
  });

  // PASSWORD RECOVERY
  forgotLink.addEventListener("click", async (event) => {
    event.preventDefault();

    if (!db) {
      showMessage("Supabase non pronto.");
      return;
    }

    const email = emailInput.value.trim();

    if (!email) {
      showMessage("Inserisci prima la tua email.");
      return;
    }

    showMessage("Invio email di recupero...", true);

    try {
      const redirectTo =
        window.location.origin + window.location.pathname;

      const { error } =
        await db.auth.resetPasswordForEmail(email, {
          redirectTo
        });

      if (error) {
        showMessage(error.message);
        return;
      }

      showMessage(
        "Se l'email è registrata, riceverai un link di recupero.",
        true
      );

    } catch (error) {
      console.error(error);
      showMessage("Errore durante il recupero password.");
    }
  });

  // Save new password after recovery
  $("#savePassword").addEventListener("click", async () => {
    if (!db) return;

    const newPassword = $("#newPassword").value;

    if (newPassword.length < 8) {
      showMessage("La password deve contenere almeno 8 caratteri.");
      return;
    }

    const { error } = await db.auth.updateUser({
      password: newPassword
    });

    if (error) {
      showMessage(error.message);
      return;
    }

    resetBox.hidden = true;

    showMessage(
      "Password aggiornata. Ora puoi accedere.",
      true
    );
  });

  // Detect password recovery session
  if (db) {
    db.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        resetBox.hidden = false;
        showMessage("Inserisci la tua nuova password.", true);
      }
    });
  }

  // Admin navigation
  app.addEventListener("click", (event) => {
    const pageName = event.target.dataset.page;

    if (pageName) {
      loadPage(pageName);
    }
  });

  // Logout
  $("#logout").addEventListener("click", async () => {
    if (db) {
      await db.auth.signOut();
    }

    app.hidden = true;
    loginBox.hidden = false;
    showMessage("Sei uscito dal pannello Admin.", true);
  });

  // Restore existing session
  if (db) {
    db.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error(error);
        return;
      }

      if (data.session) {
        showApp();
      }
    }).catch((error) => {
      console.error("Session check:", error);
    });
  }

})();
