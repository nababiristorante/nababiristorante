
(() => {
  "use strict";

  const config = window.NABABI_CONFIG || {};
  const supabaseUrl = config.SUPABASE_URL;
  const supabaseKey = config.SUPABASE_ANON_KEY;

  const list = document.getElementById("staff-list");
  const pinArea = document.getElementById("pin-area");
  const chosen = document.getElementById("chosen-staff");
  const pinInput = document.getElementById("pin");
  const punchButton = document.getElementById("punch");
  const backButton = document.getElementById("back");
  const feedback = document.getElementById("feedback");
  const noticeBox = document.getElementById("notice");

  let client = null;
  let selectedStaff = null;
  let busy = false;

  function message(text, type = "normal") {
    feedback.textContent = text;
    feedback.style.color =
      type === "success" ? "#8cdbad" :
      type === "error" ? "#ff9999" : "#fff8ec";
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function localTime(value) {
    return new Date(value).toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  async function loadNotices() {
    const { data, error } = await client
      .from("staff_special_notices")
      .select("title,message,starts_at,ends_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error || !data || !data.length) return;

    const now = Date.now();

    const current = data.find(item => {
      const start = item.starts_at
        ? new Date(item.starts_at).getTime() : 0;
      const end = item.ends_at
        ? new Date(item.ends_at).getTime() : Infinity;

      return start <= now && end >= now;
    });

    if (!current) return;

    noticeBox.innerHTML =
      `<h3>${escapeHTML(current.title)}</h3>
       <div>${escapeHTML(current.message)}</div>`;

    noticeBox.classList.remove("hidden");
  }

  function renderStaff(staff) {
    if (!staff || !staff.length) {
      list.textContent = "এখনো কোনো Active Staff যোগ করা হয়নি।";
      return;
    }

    list.innerHTML = "";

    staff.forEach(person => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "staff-card";

      const photo = person.photo_url
        ? `<img src="${escapeHTML(person.photo_url)}"
             alt="${escapeHTML(person.full_name)}"
             onerror="this.style.display='none'">`
        : `<div class="avatar-placeholder">N</div>`;

      card.innerHTML =
        `${photo}
         <strong>${escapeHTML(person.full_name)}</strong>
         <small>${escapeHTML(person.job_title || "Staff")}</small>`;

      card.addEventListener("click", () => {
        selectedStaff = person;

        document.querySelectorAll(".staff-card").forEach(item => {
          item.classList.remove("selected");
        });

        card.classList.add("selected");
        chosen.textContent = person.full_name;
        pinArea.classList.remove("hidden");
        pinInput.value = "";
        message("");
        pinInput.focus();
      });

      list.appendChild(card);
    });
  }

  async function loadStaff() {
    list.textContent = "স্টাফ তালিকা লোড হচ্ছে...";

    const { data, error } = await client
      .from("staff_public_profiles")
      .select("id,full_name,job_title,photo_url")
      .order("full_name");

    if (error) {
      console.error("Staff loading error:", error);
      list.textContent =
        "স্টাফ তালিকা লোড হয়নি। Admin-এর সঙ্গে যোগাযোগ করুন।";
      return;
    }

    renderStaff(data);
  }

  async function punch() {
    if (busy) return;

    if (!selectedStaff) {
      message("আগে নিজের নাম নির্বাচন করুন।", "error");
      return;
    }

    const pin = pinInput.value.trim();

    if (!/^[0-9]{4,8}$/.test(pin)) {
      message("৪ থেকে ৮ সংখ্যার PIN দিন।", "error");
      return;
    }

    busy = true;
    punchButton.disabled = true;
    punchButton.textContent = "অপেক্ষা করুন...";
    message("আপনার Attendance যাচাই হচ্ছে...");

    try {
      const { data, error } = await client.rpc(
        "staff_qr_punch",
        {
          p_staff_id: selectedStaff.id,
          p_pin: pin
        }
      );

      if (error) throw error;

      if (!data || data.ok !== true) {
        throw new Error("Attendance সম্পন্ন হয়নি।");
      }

      const event = data.event === "check_in"
        ? "CHECK IN"
        : "CHECK OUT";

      message(
        `${data.staff_name || selectedStaff.full_name} — ${event} সফল হয়েছে। সময়: ${localTime(data.occurred_at)}`,
        "success"
      );

      pinInput.value = "";
    } catch (error) {
      console.error("Attendance error:", error);
      message(
        error.message || "PIN ভুল অথবা সংযোগে সমস্যা হয়েছে।",
        "error"
      );
    } finally {
      busy = false;
      punchButton.disabled = false;
      punchButton.textContent = "Check In / Check Out";
    }
  }

  backButton.addEventListener("click", () => {
    selectedStaff = null;
    pinInput.value = "";
    pinArea.classList.add("hidden");
    document.querySelectorAll(".staff-card").forEach(item => {
      item.classList.remove("selected");
    });
    message("");
  });

  punchButton.addEventListener("click", punch);

  pinInput.addEventListener("keydown", event => {
    if (event.key === "Enter") punch();
  });

  async function start() {
    if (!supabaseUrl || !supabaseKey) {
      list.textContent =
        "Supabase configuration পাওয়া যায়নি।";
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      list.textContent =
        "Supabase library লোড হয়নি। পেজটি আবার খুলুন।";
      return;
    }

    client = window.supabase.createClient(
      supabaseUrl,
      supabaseKey
    );

    await Promise.all([
      loadStaff(),
      loadNotices()
    ]);
  }

  start();
})();
