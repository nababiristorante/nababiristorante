
(() => {
  "use strict";

  const config =
    window.NABABI_CONFIG ||
    window.SUPABASE_CONFIG ||
    window.supabaseConfig;

  if (!config) {
    console.error("Nababi: Supabase configuration is missing.");
    return;
  }

  const SUPABASE_URL = config.SUPABASE_URL || config.url;
  const SUPABASE_KEY =
    config.SUPABASE_ANON_KEY || config.anonKey || config.key;

  if (!SUPABASE_URL || !SUPABASE_KEY || !window.supabase?.createClient) {
    console.error("Nababi: Supabase URL, key or library is missing.");
    return;
  }

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = selector => document.querySelector(selector);

  // --------------------------------
  // BREAKING NEWS
  // --------------------------------

  const newsBox = $("#breaking-news");
  const newsTitle = $("#news-title");
  const newsBody = $("#news-body");
  const newsImage = $("#news-image");
  const newsCountdown = $("#news-countdown");
  const newsVideo = $("#news-video-link");

  let countdownTimer = null;
  let loadingNews = false;

  function hideNews() {
    if (newsBox) newsBox.hidden = true;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
  }

  function showNews(news) {
    if (!newsBox) return;

    if (newsTitle) newsTitle.textContent = news.title || "";
    if (newsBody) newsBody.textContent = news.body || "";

    if (newsImage) {
      newsImage.hidden = !news.image_url;
      if (news.image_url) {
        newsImage.src = news.image_url;
        newsImage.alt = news.title || "Nababi Ristorante news";
      } else {
        newsImage.removeAttribute("src");
      }
    }

    if (newsVideo) {
      newsVideo.hidden = !news.youtube_url;
      if (news.youtube_url) {
        newsVideo.href = news.youtube_url;
        newsVideo.target = "_blank";
        newsVideo.rel = "noopener noreferrer";
      } else {
        newsVideo.removeAttribute("href");
      }
    }

    newsBox.hidden = false;
    startCountdown(news.ends_at);
  }

  function startCountdown(endTime) {
    if (countdownTimer) clearInterval(countdownTimer);

    function update() {
      const remaining = new Date(endTime).getTime() - Date.now();

      if (remaining <= 0) {
        hideNews();
        loadBreakingNews();
        return;
      }

      const seconds = Math.floor(remaining / 1000);
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      if (newsCountdown) {
        newsCountdown.textContent =
          `${days}d ${hours}h ${minutes}m ${secs}s`;
      }
    }

    update();
    countdownTimer = setInterval(update, 1000);
  }

  async function loadBreakingNews() {
    if (loadingNews) return;
    loadingNews = true;

    try {
      const now = new Date().toISOString();

      const { data, error } = await db
        .from("breaking_news")
        .select("*")
        .eq("is_active", true)
        .lte("starts_at", now)
        .gt("ends_at", now)
        .order("starts_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data?.length) showNews(data[0]);
      else hideNews();
    } catch (error) {
      console.error("Breaking News:", error.message);
      hideNews();
    } finally {
      loadingNews = false;
    }
  }

  loadBreakingNews();
  setInterval(loadBreakingNews, 30000);

  // --------------------------------
  // COUPON OFFER AND COUPON LOGO
  // --------------------------------

  const couponButton = $("#get-coupon");
  const couponResult = $("#coupon-result");
  const couponDiscount = $("#coupon-discount");
  const couponLogo = $("#coupon-box-logo");

  let couponOfferActive = false;

  function setCouponMessage(message) {
    if (couponResult) couponResult.textContent = message;
  }

  function normalizeResponse(value) {
    if (Array.isArray(value)) return value[0] || {};
    return value || {};
  }

  async function loadCouponLogo() {
    if (!couponLogo) return;

    try {
      const { data, error } = await db
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "coupon_logo_url")
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value) {
        couponLogo.src = data.setting_value;
        couponLogo.hidden = false;
      } else {
        couponLogo.hidden = true;
      }
    } catch (error) {
      console.error("Coupon logo:", error.message);
    }
  }

  async function loadCouponOffer() {
    if (!couponButton) return;

    couponButton.disabled = true;
    couponButton.textContent = "LOADING...";

    try {
      const { data, error } = await db.rpc("get_nababi_coupon_offer");
      if (error) throw error;

      const offer = normalizeResponse(data);
      const active =
        offer.is_active === true ||
        offer.active === true ||
        offer.is_enabled === true;

      const discount = Number(
        offer.discount_percent ?? offer.discount ?? 0
      );

      if (!active || !Number.isFinite(discount) || discount <= 0) {
        couponOfferActive = false;
        if (couponDiscount) couponDiscount.textContent = "OFFER ENDED";
        couponButton.disabled = true;
        couponButton.textContent = "OFFER NOT AVAILABLE";
        setCouponMessage("Al momento non ci sono offerte attive.");
        return;
      }

      couponOfferActive = true;
      if (couponDiscount) {
        couponDiscount.textContent = `${discount}% OFF`;
      }

      couponButton.disabled = false;
      couponButton.textContent = "GET MY COUPON";
      setCouponMessage("");
    } catch (error) {
      console.error("Coupon offer:", error.message);
      couponOfferActive = false;
      if (couponDiscount) couponDiscount.textContent = "OFFER UNAVAILABLE";
      couponButton.disabled = true;
      couponButton.textContent = "NOT AVAILABLE";
      setCouponMessage(
        "Offerta temporaneamente non disponibile. Riprova più tardi."
      );
    }
  }

  function displayCoupon(code) {
    if (!couponResult) return;

    couponResult.replaceChildren();

    const message = document.createElement("p");
    message.textContent = "Complimenti! Il tuo coupon è pronto:";
    couponResult.appendChild(message);

    const codeElement = document.createElement("span");
    codeElement.className = "coupon-code";
    codeElement.textContent = code;
    couponResult.appendChild(codeElement);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "coupon-copy";
    copyButton.textContent = "COPIA CODICE";

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code);
        copyButton.textContent = "COPIATO!";
      } catch {
        copyButton.textContent = "Seleziona e copia il codice";
      }
    });

    couponResult.appendChild(copyButton);

    const note = document.createElement("p");
    note.textContent =
      "Mostra questo codice al personale del ristorante. Valido secondo le condizioni dell'offerta.";
    couponResult.appendChild(note);
  }

  if (couponButton) {
    couponButton.addEventListener("click", async () => {
      if (!couponOfferActive) {
        setCouponMessage("Al momento non ci sono offerte attive.");
        return;
      }

      couponButton.disabled = true;
      couponButton.textContent = "GENERAZIONE IN CORSO...";
      setCouponMessage("");

      try {
        const { data, error } = await db.rpc("generate_nababi_coupon");
        if (error) throw error;

        const response = normalizeResponse(data);
        const code =
          response.code ||
          response.coupon_code ||
          response.coupon ||
          response.data?.code;

        if (!code) {
          throw new Error(
            response.message || response.error ||
            "Non è stato possibile creare il coupon."
          );
        }

        displayCoupon(String(code));
      } catch (error) {
        console.error("Coupon generation:", error.message);
        setCouponMessage(
          "Coupon non disponibile. Controlla le date dell'offerta e riprova."
        );
      } finally {
        await loadCouponOffer();
      }
    });
  }

  loadCouponLogo();
  loadCouponOffer();

  // Refresh offer state periodically.
  setInterval(loadCouponOffer, 60000);

  // --------------------------------
  // BOOKING FORM
  // --------------------------------

  const bookingForm = $("#booking-form");

  if (bookingForm) {
    bookingForm.addEventListener("submit", async event => {
      event.preventDefault();

      const submitButton = bookingForm.querySelector(
        'button[type="submit"],input[type="submit"]'
      );
      const statusMessage = $("#booking-status");

      const showMessage = (message, isError = false) => {
        if (statusMessage) {
          statusMessage.textContent = message;
          statusMessage.style.color =
            isError ? "#b00020" : "#176b3a";
        } else {
          alert(message);
        }
      };

      const formData = new FormData(bookingForm);

      const customerName = String(formData.get("name") || "").trim();
      const phone = String(formData.get("phone") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const dateTime = String(formData.get("date") || "");
      const guests = Number(formData.get("guests") || 2);
      const notes = String(formData.get("notes") || "").trim();

      if (!customerName || !phone || !dateTime) {
        showMessage("Inserisci nome, telefono, data e ora.", true);
        return;
      }

      const selectedDate = new Date(dateTime);

      if (!Number.isFinite(selectedDate.getTime()) ||
          selectedDate.getTime() <= Date.now()) {
        showMessage("Seleziona una data e un'ora future.", true);
        return;
      }

      if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
        showMessage("Inserisci un numero valido di ospiti.", true);
        return;
      }

      const booking = {
        full_name: customerName,
        phone,
        email,
        booking_date: dateTime.slice(0, 10),
        booking_time: dateTime.slice(11, 16),
        guests,
        notes,
        status: "pending"
      };

      try {
        if (submitButton) submitButton.disabled = true;

        const { error } = await db
          .from("bookings")
          .insert([booking]);

        if (error) throw error;

        showMessage(
          "Grazie! La tua richiesta di prenotazione è stata ricevuta."
        );
        bookingForm.reset();
      } catch (error) {
        console.error("Booking error:", error.message);
        showMessage(
          "Prenotazione non inviata. Riprova o chiama il ristorante.",
          true
        );
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  // --------------------------------
  // LANGUAGE SELECTOR
  // --------------------------------

  const translations = {
    it: {
      home: "Home",
      menu: "Menu",
      gallery: "Gallery",
      story: "La Storia",
      events: "Eventi",
      booking: "Prenota",
      coupon: "Coupon",
      bookTitle: "Prenota il tuo tavolo",
      bookButton: "Invia prenotazione",
      offerTitle: "🎁 NABABI SPECIAL OFFER",
      offerIntro: "Un regalo speciale per te!",
      offerDescription:
        "Richiedi il tuo coupon esclusivo e mostralo al nostro staff al ristorante."
    },
    en: {
      home: "Home",
      menu: "Menu",
      gallery: "Gallery",
      story: "Our Story",
      events: "Events",
      booking: "Book a Table",
      coupon: "Coupon",
      bookTitle: "Book your table",
      bookButton: "Send booking",
      offerTitle: "🎁 NABABI SPECIAL OFFER",
      offerIntro: "A special gift for you!",
      offerDescription:
        "Get your exclusive coupon and show it to our restaurant staff."
    },
    bn: {
      home: "হোম",
      menu: "মেনু",
      gallery: "গ্যালারি",
      story: "আমাদের গল্প",
      events: "ইভেন্ট",
      booking: "টেবিল বুকিং",
      coupon: "কুপন",
      bookTitle: "আপনার টেবিল বুক করুন",
      bookButton: "বুকিং পাঠান",
      offerTitle: "🎁 নবাবি বিশেষ অফার",
      offerIntro: "আপনার জন্য বিশেষ উপহার!",
      offerDescription:
        "আপনার কুপন সংগ্রহ করুন এবং রেস্টুরেন্টের কর্মীদের দেখান।"
    }
  };

  function setLanguage(language) {
    const text = translations[language];
    if (!text) return;

    const nav = document.querySelectorAll(".header nav a");
    const keys = ["home", "menu", "gallery", "story", "events", "booking", "coupon"];

    nav.forEach((link, index) => {
      if (keys[index]) link.textContent = text[keys[index]];
    });

    const bookingTitle = $("#booking h2");
    const bookingSubmit = $("#booking-form button[type='submit']");
    const offerTitle = $("#coupon h2");
    const offerIntro = $("#coupon-intro");
    const offerDescription = $("#coupon-description");

    if (bookingTitle) bookingTitle.textContent = text.bookTitle;
    if (bookingSubmit) bookingSubmit.textContent = text.bookButton;
    if (offerTitle) offerTitle.textContent = text.offerTitle;
    if (offerIntro) offerIntro.textContent = text.offerIntro;
    if (offerDescription) offerDescription.textContent = text.offerDescription;

    document.documentElement.lang = language;
  }

  const languageSelect = $("#language");
  if (languageSelect) {
    languageSelect.addEventListener("change", event => {
      setLanguage(event.target.value);
    });
    setLanguage(languageSelect.value || "it");
  }

  console.log("Nababi Ristorante website script loaded.");
})();
