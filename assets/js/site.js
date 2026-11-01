
(() => {
  "use strict";

  const cfg = window.NABABI_CONFIG || {};
  const $ = selector => document.querySelector(selector);

  const NEWS_TABLE = "breaking_news";
  const BOOKING_TABLE = "bookings";
  const GALLERY_TABLE = "gallery_items";
  const REFRESH_MS = 30000;

  let db = null;

  function getClient() {
    if (db) return db;

    if (
      !window.supabase ||
      !cfg.SUPABASE_URL ||
      !cfg.SUPABASE_ANON_KEY
    ) {
      throw new Error(
        "Supabase URL অথবা Anon Key পাওয়া যায়নি।"
      );
    }

    db = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );

    return db;
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["https:", "http:"].includes(url.protocol)
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  /* =========================
     BOOKING
  ========================= */

  function setupBookingForm() {
    const form = $("#booking-form");
    if (!form) return;

    const dateInput = form.elements.booking_date;
    const timeInput = form.elements.booking_time;
    const typeInput = form.elements.booking_type;
    const phoneInput = form.elements.phone;
    const emailInput = form.elements.email;

    const message = $("#booking-message");
    const submitButton = $("#booking-submit");
    const tableArea = $("#booking-table-area");
    const map = $("#booking-map");
    const mapMessage = $("#booking-map-message");
    const tableInput = $("#booking-table-number");
    const formTitle = $("#booking-form-title");

    const choiceButtons = [
      ...document.querySelectorAll("[data-booking-choice]")
    ];

    if (
      !dateInput ||
      !timeInput ||
      !typeInput ||
      !phoneInput ||
      !emailInput ||
      !submitButton ||
      !message
    ) {
      console.error("Booking form elements missing.");
      return;
    }

    let selectedTable = "";

    function todayString() {
      const d = new Date();

      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
      ].join("-");
    }

    dateInput.min = todayString();

    function showMessage(text, type = "") {
      message.textContent = text;
      message.className =
        "booking-message" + (type ? " " + type : "");
    }

    function validFutureDateTime() {
      if (!dateInput.value || !timeInput.value) {
        return false;
      }

      const selected = new Date(
        `${dateInput.value}T${timeInput.value}:00`
      );

      return (
        Number.isFinite(selected.getTime()) &&
        selected.getTime() > Date.now()
      );
    }

    function updateContactRequirements() {
      const type = typeInput.value;
      const special =
        type === "birthday" ||
        type === "special_event";

      phoneInput.required = special;
      emailInput.required = special;
    }

    function selectBookingType(type) {
      if (
        !["table", "birthday", "special_event"].includes(type)
      ) return;

      typeInput.value = type;
      selectedTable = "";

      if (tableInput) tableInput.value = "";
      if (map) map.replaceChildren();

      if (tableArea) {
        tableArea.hidden = type !== "table";
      }

      const titles = {
        table: "Richiesta prenotazione tavolo",
        birthday: "Richiesta per compleanno",
        special_event: "Richiesta per evento speciale"
      };

      if (formTitle) {
        formTitle.textContent = titles[type];
      }

      choiceButtons.forEach(button => {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.bookingChoice === type)
        );
      });

      form.classList.add("active");
      updateContactRequirements();
      showMessage("");

      if (mapMessage) {
        mapMessage.textContent =
          "Scegli data e orario per controllare la disponibilità.";
      }

      form.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    choiceButtons.forEach(button => {
      button.addEventListener("click", () => {
        selectBookingType(button.dataset.bookingChoice);
      });
    });

    /* TABLE AVAILABILITY */

    async function loadTableAvailability() {
      if (typeInput.value !== "table") return;
      if (!map || !mapMessage) return;

      selectedTable = "";
      if (tableInput) tableInput.value = "";

      map.replaceChildren();

      if (!dateInput.value || !timeInput.value) {
        mapMessage.textContent =
          "Scegli data e orario per controllare la disponibilità.";
        return;
      }

      if (!validFutureDateTime()) {
        mapMessage.textContent =
          "Seleziona una data e un orario futuri.";
        return;
      }

      mapMessage.textContent = "Controllo disponibilità...";

      try {
        const client = getClient();

        const { data: floorMaps, error: floorError } =
          await client
            .from("restaurant_floor_maps")
            .select("id,name")
            .eq("is_active", true)
            .limit(1);

        if (floorError) throw floorError;

        if (!floorMaps || !floorMaps.length) {
          mapMessage.textContent =
            "La mappa dei tavoli non è ancora configurata.";
          return;
        }

        const { data: unavailable, error: availabilityError } =
          await client.rpc(
            "get_unavailable_booking_tables",
            {
              p_booking_date: dateInput.value,
              p_booking_time: `${timeInput.value}:00`
            }
          );

        if (availabilityError) {
          throw availabilityError;
        }

        const { data: tables, error: tablesError } =
          await client
            .from("restaurant_map_tables")
            .select("table_number,seat_count,is_active")
            .eq("floor_map_id", floorMaps[0].id)
            .eq("is_active", true)
            .order("table_number");

        if (tablesError) throw tablesError;

        if (!tables || !tables.length) {
          mapMessage.textContent =
            "Nessun tavolo attivo configurato.";
          return;
        }

        const blocked = new Set(
          (unavailable || []).map(row =>
            String(row.table_number)
          )
        );

        mapMessage.textContent =
          "Seleziona un tavolo disponibile. La scelta è facoltativa.";

        tables.forEach(table => {
          const number = String(table.table_number);
          const isUnavailable = blocked.has(number);

          const button = element(
            "button",
            "booking-table",
            `Tavolo ${number} · ${table.seat_count} posti` +
              (isUnavailable ? " · Occupato" : "")
          );

          button.type = "button";
          button.disabled = isUnavailable;

          button.addEventListener("click", () => {
            selectedTable =
              selectedTable === number ? "" : number;

            if (tableInput) {
              tableInput.value = selectedTable;
            }

            map.querySelectorAll(".booking-table")
              .forEach(item =>
                item.classList.remove("selected")
              );

            if (selectedTable) {
              button.classList.add("selected");
            }
          });

          map.append(button);
        });

      } catch (error) {
        console.error("TABLE AVAILABILITY ERROR:", error);

        mapMessage.textContent =
          "Impossibile verificare i tavoli. Puoi inviare la richiesta senza scegliere un tavolo.";
      }
    }

    dateInput.addEventListener(
      "change",
      loadTableAvailability
    );

    timeInput.addEventListener(
      "change",
      loadTableAvailability
    );

    /* SUBMIT */

    form.addEventListener("submit", async event => {
      event.preventDefault();

      showMessage("");
      updateContactRequirements();

      if (!form.reportValidity()) return;

      const data = new FormData(form);

      const fullName =
        String(data.get("full_name") || "").trim();

      const phone =
        String(data.get("phone") || "").trim();

      const email =
        String(data.get("email") || "").trim();

      const bookingDate =
        String(data.get("booking_date") || "");

      const bookingTime =
        String(data.get("booking_time") || "");

      const bookingType =
        String(data.get("booking_type") || "");

      const guests = Number(data.get("guests"));

      if (!fullName) {
        showMessage("Inserisci nome e cognome.", "error");
        return;
      }

      if (!validFutureDateTime()) {
        showMessage(
          "Seleziona una data e un orario futuri.",
          "error"
        );
        return;
      }

      if (
        !Number.isInteger(guests) ||
        guests < 1 ||
        guests > 30
      ) {
        showMessage(
          "Numero di ospiti non valido.",
          "error"
        );
        return;
      }

      if (
        !["table", "birthday", "special_event"]
          .includes(bookingType)
      ) {
        showMessage(
          "Tipo di prenotazione non valido.",
          "error"
        );
        return;
      }

      if (bookingType === "table" && !phone && !email) {
        showMessage(
          "Inserisci almeno telefono oppure email.",
          "error"
        );
        return;
      }

      if (
        bookingType !== "table" &&
        (!phone || !email)
      ) {
        showMessage(
          "Telefono ed email sono obbligatori per eventi e compleanni.",
          "error"
        );
        return;
      }

      if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        showMessage(
          "Inserisci un indirizzo email valido.",
          "error"
        );
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Invio in corso…";

      try {
        const client = getClient();

        const payload = {
          full_name: fullName,
          phone: phone || null,
          email: email || null,
          booking_date: bookingDate,
          booking_time: bookingTime,
          guests: guests,
          booking_type: bookingType,
          notes:
            String(data.get("notes") || "").trim() || null,
          status: "pending",
          table_number:
            bookingType === "table"
              ? selectedTable || null
              : null
        };

        /*
         * Insert only.
         * Avoid SELECT on bookings for anonymous visitors.
         * The database trigger can generate the confirmation code.
         */

        const { error } = await client
          .from(BOOKING_TABLE)
          .insert(payload);

        if (error) throw error;

        form.reset();
        form.classList.remove("active");

        selectedTable = "";

        if (tableInput) tableInput.value = "";
        if (map) map.replaceChildren();
        if (tableArea) tableArea.hidden = true;

        choiceButtons.forEach(button => {
          button.setAttribute("aria-pressed", "false");
        });

        showMessage(
          "Richiesta inviata con successo! La tua prenotazione è in attesa di conferma del ristorante.",
          "success"
        );

        message.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

      } catch (error) {
        console.error("BOOKING ERROR:", error);

        const detail =
          error?.message ||
          error?.details ||
          error?.hint ||
          "Errore sconosciuto";

        showMessage(
          "Booking Error: " + detail,
          "error"
        );

      } finally {
        submitButton.disabled = false;
        submitButton.textContent =
          "Invia richiesta di prenotazione";
      }
    });
  }

  /* =========================
     BREAKING NEWS
  ========================= */

  function createNewsBar() {
    let bar = $("#breakingNewsBar");

    if (!bar) {
      bar = element("section", "breaking-news-bar");
      bar.id = "breakingNewsBar";
      bar.setAttribute("aria-live", "polite");

      const header = $(".site-header");

      if (header) {
        header.insertAdjacentElement("afterend", bar);
      } else {
        document.body.prepend(bar);
      }
    }

    return bar;
  }

  function renderNews(items) {
    const bar = createNewsBar();
    const now = Date.now();

    const active = (items || []).filter(item => {
      const start = Date.parse(item.starts_at);
      const end = Date.parse(item.ends_at);

      return (
        item.is_active === true &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start <= now &&
        now < end
      );
    });

    bar.replaceChildren();

    if (!active.length) {
      bar.hidden = true;
      return;
    }

    bar.hidden = false;

    active.forEach(item => {
      const article = element(
        "article",
        "breaking-news-item"
      );

      const content = element(
        "div",
        "breaking-news-content"
      );

      content.append(
        element(
          "span",
          "breaking-news-label",
          "ULTIME NOTIZIE"
        ),
        element("h2", "", item.title || ""),
        element("p", "", item.body || "")
      );

      article.append(content);

      const imageUrl = safeUrl(item.image_url);

      if (imageUrl) {
        const image = element(
          "img",
          "breaking-news-image"
        );

        image.src = imageUrl;
        image.alt = "";
        image.loading = "lazy";

        article.append(image);
      }

      const videoUrl = safeUrl(item.youtube_url);

      if (videoUrl) {
        const link = element(
          "a",
          "breaking-news-video",
          "Guarda il video"
        );

        link.href = videoUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        content.append(link);
      }

      bar.append(article);
    });
  }

  async function loadBreakingNews() {
    try {
      const client = getClient();
      const now = new Date().toISOString();

      const { data, error } = await client
        .from(NEWS_TABLE)
        .select(
          "id,title,body,image_url,youtube_url,starts_at,ends_at,is_active"
        )
        .eq("is_active", true)
        .lte("starts_at", now)
        .gt("ends_at", now)
        .order("starts_at", { ascending: true });

      if (error) throw error;

      renderNews(data || []);

    } catch (error) {
      console.error("BREAKING NEWS ERROR:", error);
      createNewsBar().hidden = true;
    }
  }

  /* =========================
     GALLERY LIGHTBOX
  ========================= */

  function setupGalleryLightbox() {
    const gallery = $("#publicGallery");

    if (
      !gallery ||
      gallery.dataset.lightboxReady === "true"
    ) return;

    gallery.dataset.lightboxReady = "true";

    const lightbox = element(
      "div",
      "gallery-lightbox"
    );

    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");

    const closeButton = element(
      "button",
      "gallery-lightbox-close",
      "×"
    );

    closeButton.type = "button";

    const largeImage = element("img");
    largeImage.alt = "";

    lightbox.append(closeButton, largeImage);
    document.body.append(lightbox);

    function closeLightbox() {
      lightbox.hidden = true;
      largeImage.removeAttribute("src");
      document.body.style.overflow = "";
    }

    gallery.addEventListener("click", event => {
      const image = event.target.closest("img");

      if (!image || !gallery.contains(image)) return;

      largeImage.src = image.currentSrc || image.src;
      largeImage.alt = image.alt || "Gallery image";

      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      closeButton.focus();
    });

    closeButton.addEventListener(
      "click",
      closeLightbox
    );

    lightbox.addEventListener("click", event => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", event => {
      if (
        event.key === "Escape" &&
        !lightbox.hidden
      ) {
        closeLightbox();
      }
    });
  }

  /* =========================
     GALLERY
  ========================= */

  async function loadGallery() {
    const gallery = $("#publicGallery");
    if (!gallery) return;

    try {
      const client = getClient();

      const { data, error } = await client
        .from(GALLERY_TABLE)
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(100);

      if (error) throw error;

      gallery.replaceChildren();

      if (!data || !data.length) {
        gallery.append(
          element("p", "help", "Nessuna foto disponibile.")
        );
        return;
      }

      let count = 0;

      data.forEach(item => {
        const imageUrl = safeUrl(
          item.image_url || item.public_url
        );

        if (!imageUrl) return;

        const card = element("article", "site-card");
        const image = element("img");

        image.src = imageUrl;
        image.alt = item.title || "Nababi Ristorante";
        image.loading = "lazy";

        card.append(image);

        if (item.title) {
          const content = element("div");
          content.append(
            element("h3", "", item.title)
          );
          card.append(content);
        }

        gallery.append(card);
        count++;
      });

      if (!count) {
        gallery.append(
          element("p", "help", "Nessuna foto disponibile.")
        );
      }

    } catch (error) {
      console.error("GALLERY ERROR:", error);

      gallery.replaceChildren(
        element(
          "p",
          "help",
          "Impossibile caricare la Gallery."
        )
      );
    }
  }

  /* =========================
     START
  ========================= */

  async function startSite() {
    setupBookingForm();
    setupGalleryLightbox();

    try {
      getClient();

      await Promise.allSettled([
        loadBreakingNews(),
        loadGallery()
      ]);

      window.setInterval(
        loadBreakingNews,
        REFRESH_MS
      );

      document.addEventListener(
        "visibilitychange",
        () => {
          if (!document.hidden) {
            loadBreakingNews();
            loadGallery();
          }
        }
      );

    } catch (error) {
      console.error("NABABI SITE ERROR:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      startSite
    );
  } else {
    startSite();
  }
})();
