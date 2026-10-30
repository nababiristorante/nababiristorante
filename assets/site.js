
(() => {
  "use strict";

  const config = window.NABABI_CONFIG;

  if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.error("Nababi: Supabase configuration is missing.");
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error("Nababi: Supabase library is not loaded.");
    return;
  }

  const db = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );

  // -----------------------------
  // BREAKING NEWS
  // -----------------------------

  const newsBox = document.querySelector(
    "#breaking-news, [data-breaking-news]"
  );

  const newsTitle = document.querySelector(
    "#news-title, [data-news-title]"
  );

  const newsBody = document.querySelector(
    "#news-body, [data-news-body]"
  );

  const newsImage = document.querySelector(
    "#news-image, [data-news-image]"
  );

  const newsCountdown = document.querySelector(
    "#news-countdown, [data-news-countdown]"
  );

  let currentNews = null;
  let countdownTimer = null;

  function hideNews() {
    if (newsBox) newsBox.hidden = true;

    currentNews = null;

    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function showNews(news) {
    if (!newsBox || !news) return;

    currentNews = news;

    if (newsTitle) {
      newsTitle.textContent = news.title || "";
    }

    if (newsBody) {
      newsBody.textContent = news.body || "";
    }

    if (newsImage) {
      if (news.image_url) {
        newsImage.src = news.image_url;
        newsImage.alt = news.title || "Nababi Ristorante news";
        newsImage.hidden = false;
      } else {
        newsImage.removeAttribute("src");
        newsImage.hidden = true;
      }
    }

    // Optional YouTube link
    const videoLink = document.querySelector(
      "#news-video-link, [data-news-video-link]"
    );

    if (videoLink) {
      if (news.youtube_url) {
        videoLink.href = news.youtube_url;
        videoLink.hidden = false;
        videoLink.target = "_blank";
        videoLink.rel = "noopener noreferrer";
      } else {
        videoLink.hidden = true;
        videoLink.removeAttribute("href");
      }
    }

    newsBox.hidden = false;
    startCountdown(news.ends_at);
  }

  function startCountdown(endTime) {
    if (countdownTimer) clearInterval(countdownTimer);

    function updateCountdown() {
      const remaining = new Date(endTime).getTime() - Date.now();

      if (remaining <= 0) {
        hideNews();
        loadBreakingNews();
        return;
      }

      const totalSeconds = Math.floor(remaining / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (newsCountdown) {
        newsCountdown.textContent =
          `${days}d ${hours}h ${minutes}m ${seconds}s`;
      }
    }

    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 1000);
  }

  async function loadBreakingNews() {
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

      if (data && data.length > 0) {
        showNews(data[0]);
      } else {
        hideNews();
      }
    } catch (error) {
      console.error("Nababi: Could not load Breaking News:", error.message);
      hideNews();
    }
  }

  loadBreakingNews();

  // Check periodically for newly published or expired news.
  setInterval(loadBreakingNews, 30000);

  // -----------------------------
  // BOOKING FORM
  // -----------------------------

  const bookingForm = document.querySelector(
    "#booking-form, [data-booking-form]"
  );

  if (bookingForm) {
    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = bookingForm.querySelector(
        'button[type="submit"], input[type="submit"]'
      );

      const statusMessage = document.querySelector(
        "#booking-message, [data-booking-message]"
      );

      function showBookingMessage(message, isError = false) {
        if (statusMessage) {
          statusMessage.textContent = message;
          statusMessage.style.color = isError ? "#b00020" : "#176b3a";
        } else {
          alert(message);
        }
      }

      const formData = new FormData(bookingForm);

      const customerName =
        formData.get("name") ||
        formData.get("full_name") ||
        "";

      const phone = formData.get("phone") || "";
      const email = formData.get("email") || "";
      const bookingDate =
        formData.get("date") ||
        formData.get("booking_date") ||
        "";

      const bookingTime =
        formData.get("time") ||
        formData.get("booking_time") ||
        "";

      const guests = Number(
        formData.get("guests") ||
        formData.get("people") ||
        2
      );

      const notes = formData.get("notes") || "";

      if (!customerName.trim() || !phone.trim() ||
          !bookingDate || !bookingTime) {
        showBookingMessage(
          "Please complete your name, phone, date and time.",
          true
        );
        return;
      }

      if (!Number.isFinite(guests) || guests < 1) {
        showBookingMessage("Please enter a valid number of guests.", true);
        return;
      }

      const booking = {
        full_name: customerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        booking_date: bookingDate,
        booking_time: bookingTime,
        guests: guests,
        notes: String(notes).trim(),
        status: "pending"
      };

      try {
        if (submitButton) submitButton.disabled = true;

        const { error } = await db
          .from("bookings")
          .insert([booking]);

        if (error) throw error;

        showBookingMessage(
          "Grazie! Your booking request has been received."
        );

        bookingForm.reset();

      } catch (error) {
        console.error("Nababi: Booking error:", error.message);

        showBookingMessage(
          "Booking could not be sent. Please try again or call the restaurant.",
          true
        );
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  console.log("Nababi Ristorante website script loaded.");
})();
