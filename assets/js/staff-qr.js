
(() => {
  "use strict";

  const CONFIG = window.NABABI_CONFIG || {};
  const SUPABASE = window.supabase;

  const supabaseUrl =
    CONFIG.supabaseUrl ||
    CONFIG.SUPABASE_URL ||
    CONFIG.projectUrl ||
    CONFIG.url;

  const anonKey =
    CONFIG.supabaseAnonKey ||
    CONFIG.SUPABASE_ANON_KEY ||
    CONFIG.anonKey ||
    CONFIG.anon_key ||
    CONFIG.publicAnonKey;

  const staffView = document.getElementById("staffView");
  const pinView = document.getElementById("pinView");
  const actionView = document.getElementById("actionView");

  const staffGrid = document.getElementById("staffGrid");
  const loading = document.getElementById("loading");

  const pinForm = document.getElementById("pinForm");
  const pinInput = document.getElementById("pin");
  const verifyButton = document.getElementById("verifyButton");
  const selectedStaffName =
    document.getElementById("selectedStaffName");
  const selectedStaffPhoto = document.getElementById("selectedStaffPhoto");
  const pinMessage = document.getElementById("pinMessage");

  const actionTitle = document.getElementById("actionTitle");
  const actionDescription =
    document.getElementById("actionDescription");
  const actionButton = document.getElementById("actionButton");
  const actionMessage =
    document.getElementById("actionMessage");
  const successCard = document.getElementById("checkInSuccessCard");
  const successPhoto = document.getElementById("checkInSuccessPhoto");
  const successLogo = document.getElementById("checkInSuccessLogo");
  const successName = document.getElementById("checkInSuccessName");
  const successTime = document.getElementById("checkInSuccessTime");

  const backFromPin = document.getElementById("backFromPin");
  const backToStaff = document.getElementById("backToStaff");
  const staffNoticeModal = document.getElementById("staffNoticeModal");
  const staffNoticeList = document.getElementById("staffNoticeList");
  const staffNoticeClose = document.getElementById("staffNoticeClose");
  const staffBrandLogo = document.getElementById("staffBrandLogo");
  const staffBrandFallback = document.getElementById("staffBrandFallback");

  let db = null;
  let selectedStaff = null;
  let pendingPin = null;
  let busy = false;

  function showMessage(element, message) {
    element.textContent = message || "";
  }

  function showView(view) {
    staffView.classList.toggle("hidden", view !== "staff");
    pinView.classList.toggle("hidden", view !== "pin");
    actionView.classList.toggle("hidden", view !== "action");
  }

  function setBusy(button, value, originalText) {
    busy = value;
    button.disabled = value;
    button.textContent = value ? "PLEASE WAIT..." : originalText;
  }

  async function loadStaffBrandLogo() {
    if (!db || !staffBrandLogo) return;
    try {
      const { data, error } = await db.from("site_settings")
        .select("setting_key,setting_value")
        .in("setting_key", ["restaurant_logo_url", "restaurant_logo_show_staff_qr"]);
      if (error) throw error;
      const settings = Object.fromEntries((data || []).map(row => [row.setting_key, row.setting_value]));
      const url = safePhotoUrl(settings.restaurant_logo_url);
      const enabled = settings.restaurant_logo_show_staff_qr !== "false";
      if (url && enabled) {
        staffBrandLogo.src = url;
        staffBrandLogo.classList.remove("hidden");
        if (staffBrandFallback) staffBrandFallback.classList.add("hidden");
      } else {
        staffBrandLogo.removeAttribute("src");
        staffBrandLogo.classList.add("hidden");
        if (staffBrandFallback) staffBrandFallback.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Staff QR logo could not be loaded:", error);
    }
  }

  async function showActiveStaffNotices() {
    if (!staffNoticeModal || !staffNoticeList) return;
    try {
      const { data, error } = await db.rpc("staff_qr_active_announcements");
      if (error) throw error;
      const notices = Array.isArray(data) ? data : [];
      if (!notices.length) return;

      staffNoticeList.replaceChildren();
      notices.forEach(notice => {
        const item = document.createElement("article");
        item.className = "notice-item";
        const heading = document.createElement("h3");
        heading.textContent = notice.title || "Staff notice";
        const body = document.createElement("p");
        body.textContent = notice.message || "";
        item.append(heading, body);
        staffNoticeList.appendChild(item);
      });
      staffNoticeModal.classList.remove("hidden");
      if (staffNoticeClose) staffNoticeClose.focus();
    } catch (error) {
      console.error("Staff announcements could not be loaded:", error);
    }
  }

  function closeStaffNotices() {
    if (staffNoticeModal) staffNoticeModal.classList.add("hidden");
  }

  function getInitials(name) {
    const words = String(name || "").trim().split(/\s+/);
    return words.slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "N";
  }

  function safePhotoUrl(value) {
    if (!value || typeof value !== "string") return "";

    try {
      const url = new URL(value, window.location.origin);

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function createStaffCard(staff) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "staff-card";

    const photo = document.createElement("div");
    photo.className = "staff-photo";

    const photoUrl = safePhotoUrl(staff.photo_url);

    if (photoUrl) {
      const img = document.createElement("img");
      img.src = photoUrl;
      img.alt = staff.full_name || "Staff photo";
      img.loading = "lazy";

      img.addEventListener("error", () => {
        photo.replaceChildren();
        photo.textContent = getInitials(staff.full_name);
      });

      photo.appendChild(img);
    } else {
      photo.textContent = getInitials(staff.full_name);
    }

    const name = document.createElement("span");
    name.className = "staff-name";
    name.textContent = staff.full_name || "Staff";

    card.append(photo, name);

    card.addEventListener("click", () => {
      selectStaff(staff);
    });

    return card;
  }

  async function loadStaff() {
    loading.textContent = "Loading staff...";
    staffGrid.replaceChildren();

    const { data, error } = await db.rpc(
      "nababi_staff_attendance_cards"
    );

    if (error) {
      loading.textContent =
        "স্টাফদের তথ্য আনা যাচ্ছে না। অনুগ্রহ করে অ্যাডমিনের সঙ্গে যোগাযোগ করুন।";
      console.error("Staff list error:", error);
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      loading.textContent = "কোনো সক্রিয় স্টাফ পাওয়া যায়নি।";
      return;
    }

    loading.classList.add("hidden");

    data.forEach(staff => {
      staffGrid.appendChild(createStaffCard(staff));
    });
  }

  function selectStaff(staff) {
    selectedStaff = staff;
    pendingPin = null;

    pinInput.value = "";
    showMessage(pinMessage, "");

    selectedStaffName.textContent = staff.full_name;
    if (selectedStaffPhoto) {
      selectedStaffPhoto.replaceChildren();
      const url = safePhotoUrl(staff.photo_url);
      if (url) {
        const img = document.createElement("img");
        img.src = url; img.alt = staff.full_name || "Staff photo";
        selectedStaffPhoto.appendChild(img);
      } else { selectedStaffPhoto.textContent = getInitials(staff.full_name); }
    }

    verifyButton.disabled = false;
    verifyButton.textContent = "VERIFICA PIN";

    showView("pin");
    pinInput.focus();
  }

  async function verifyPin(event) {
    event.preventDefault();

    if (busy || !selectedStaff) return;

    const pin = pinInput.value.trim();

    if (!/^[0-9]{4}$/.test(pin)) {
      showMessage(pinMessage, "অনুগ্রহ করে ৪ সংখ্যার পিন লিখুন।");
      return;
    }

    setBusy(verifyButton, true, "VERIFICA PIN");
    showMessage(pinMessage, "আপনার পিন যাচাই করা হচ্ছে...");

    try {
      const { data, error } = await db.rpc(
        "staff_qr_status",
        {
          p_staff_id: selectedStaff.id,
          p_pin: pin
        }
      );

      if (error) throw error;

      if (!data || data.ok !== true) {
        pendingPin = null;
        pinInput.value = "";

        showMessage(
          pinMessage,
          data?.message || "পিন যাচাই করা যায়নি। আবার চেষ্টা করুন।"
        );

        return;
      }

      pendingPin = pin;
      pinInput.value = "";

      showView("action");
      if (successCard) successCard.hidden = true;
      showMessage(actionMessage, "");

      if (data.next_action === "check_in") {
        actionTitle.textContent = "আসসালামু আলাইকুম!";
        actionDescription.textContent =
          "আজকের উপস্থিতি এখনো শুরু হয়নি।";

        actionButton.textContent = "চেক-ইন করুন";
        actionButton.classList.remove("hidden");
        actionButton.disabled = false;
      } else if (data.next_action === "check_out") {
        actionTitle.textContent = "শিফট শেষ";
        actionDescription.textContent =
          "আপনার চেক-ইন সংরক্ষিত হয়েছে। এখন চেক-আউট করতে পারবেন।";

        actionButton.textContent = "চেক-আউট করুন";
        actionButton.classList.remove("hidden");
        actionButton.disabled = false;
      } else if (data.next_action === "completed") {
        pendingPin = null;

        actionTitle.textContent = "আজকের উপস্থিতি সম্পন্ন";
        actionDescription.textContent =
          "আজকের উপস্থিতি ইতিমধ্যে সম্পন্ন হয়েছে।";

        actionButton.classList.add("hidden");

        showMessage(
          actionMessage,
          "আজকের চেক-ইন ও চেক-আউট দুটোই সম্পন্ন হয়েছে।"
        );
      } else {
        pendingPin = null;
        actionButton.classList.add("hidden");

        showMessage(
          actionMessage,
          "Unknown attendance status. Please contact the administrator."
        );
      }
    } catch (error) {
      console.error("PIN verification error:", error);

      showMessage(
        pinMessage,
        "সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
      );
    } finally {
      setBusy(verifyButton, false, "VERIFICA PIN");
    }
  }

  async function submitPunch() {
    if (busy || !selectedStaff || !pendingPin) return;

    const currentAction = actionButton.textContent;
    setBusy(actionButton, true, currentAction);

    showMessage(actionMessage, "উপস্থিতি সংরক্ষণ করা হচ্ছে...");

    try {
      const { data, error } = await db.rpc(
        "staff_qr_punch",
        {
          p_staff_id: selectedStaff.id,
          p_pin: pendingPin
        }
      );

      if (error) throw error;

      if (!data || data.ok !== true) {
        pendingPin = null;
        actionButton.classList.add("hidden");

        showMessage(
          actionMessage,
          data?.message || "উপস্থিতি সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।"
        );

        return;
      }

      const eventName =
        data.event === "check_in" ? "চেক-ইন" : "চেক-আউট";

      pendingPin = null;

      actionButton.classList.add("hidden");

      actionTitle.textContent = data.event === "check_in" ? "অভিনন্দন!" : "ধন্যবাদ!";
      actionDescription.textContent = "NABABI RISTORANTE · স্টাফ উপস্থিতি";

      if (data.event === "check_in" && successCard) {
        const name = data.staff_name || selectedStaff.full_name || "প্রিয় সহকর্মী";
        const rawTime = data.check_in || data.recorded_at || data.punched_at || data.created_at;
        const parsedTime = rawTime ? new Date(rawTime) : new Date();
        const shownTime = Number.isNaN(parsedTime.getTime()) ? new Date() : parsedTime;
        if (successName) successName.textContent = name;
        if (successTime) successTime.textContent = shownTime.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
        if (successPhoto) {
          successPhoto.replaceChildren();
          const photoUrl = safePhotoUrl(selectedStaff.photo_url);
          if (photoUrl) {
            const img = document.createElement("img");
            img.src = photoUrl; img.alt = name;
            successPhoto.appendChild(img);
          } else {
            successPhoto.textContent = getInitials(name);
          }
        }
        if (successLogo) {
          successLogo.replaceChildren();
          if (staffBrandLogo && !staffBrandLogo.classList.contains("hidden") && staffBrandLogo.src) {
            const logo = document.createElement("img");
            logo.src = staffBrandLogo.src; logo.alt = "NABABI RISTORANTE";
            successLogo.appendChild(logo);
          } else {
            successLogo.textContent = "♛ NABABI RISTORANTE";
          }
        }
        successCard.hidden = false;
        showMessage(actionMessage, "");
        await showActiveStaffNotices();
      } else {
        showMessage(actionMessage, "আপনার " + eventName + " সফলভাবে সংরক্ষণ হয়েছে। ধন্যবাদ।");
      }

    } catch (error) {
      console.error("Attendance error:", error);

      showMessage(
        actionMessage,
        "Connection error. Please try again."
      );

      actionButton.disabled = false;
      return;
    } finally {
      if (pendingPin) {
        setBusy(actionButton, false, currentAction);
      } else {
        busy = false;
      }
    }
  }

  function backToStaffList() {
    selectedStaff = null;
    pendingPin = null;
    pinInput.value = "";

    showMessage(pinMessage, "");
    showMessage(actionMessage, "");

    actionButton.classList.add("hidden");
    actionButton.disabled = false;

    showView("staff");
  }

  function start() {
    if (!SUPABASE || typeof SUPABASE.createClient !== "function") {
      loading.textContent = "সিস্টেম লোড হয়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।";
      return;
    }

    if (!supabaseUrl || !anonKey) {
      loading.textContent =
        "সিস্টেম কনফিগারেশন পাওয়া যায়নি। অ্যাডমিনের সঙ্গে যোগাযোগ করুন।";
      console.error("Supabase config keys were not found.");
      return;
    }

    db = SUPABASE.createClient(supabaseUrl, anonKey);

    pinForm.addEventListener("submit", verifyPin);
    actionButton.addEventListener("click", submitPunch);

    backFromPin.addEventListener("click", backToStaffList);
    backToStaff.addEventListener("click", backToStaffList);
    if (staffNoticeClose) staffNoticeClose.addEventListener("click", closeStaffNotices);
    if (staffNoticeModal) {
      staffNoticeModal.addEventListener("click", event => {
        if (event.target === staffNoticeModal) closeStaffNotices();
      });
    }

    pinInput.addEventListener("input", () => {
      pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    });

    Promise.all([loadStaff(), loadStaffBrandLogo()]);
  }

  start();
})();
