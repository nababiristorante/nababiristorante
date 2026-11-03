
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
  const pinMessage = document.getElementById("pinMessage");

  const actionTitle = document.getElementById("actionTitle");
  const actionDescription =
    document.getElementById("actionDescription");
  const actionButton = document.getElementById("actionButton");
  const actionMessage =
    document.getElementById("actionMessage");

  const backFromPin = document.getElementById("backFromPin");
  const backToStaff = document.getElementById("backToStaff");
  const staffNoticeModal = document.getElementById("staffNoticeModal");
  const staffNoticeList = document.getElementById("staffNoticeList");
  const staffNoticeClose = document.getElementById("staffNoticeClose");

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
        "Unable to load staff. Please contact the administrator.";
      console.error("Staff list error:", error);
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      loading.textContent = "No active staff found.";
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
      showMessage(pinMessage, "Please enter your 4-digit PIN.");
      return;
    }

    setBusy(verifyButton, true, "VERIFICA PIN");
    showMessage(pinMessage, "Verifying your PIN...");

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
          data?.message || "PIN verification failed."
        );

        return;
      }

      pendingPin = pin;
      pinInput.value = "";

      showView("action");
      showMessage(actionMessage, "");

      if (data.next_action === "check_in") {
        actionTitle.textContent = "Buongiorno!";
        actionDescription.textContent =
          "Your attendance has not started today.";

        actionButton.textContent = "CHECK IN";
        actionButton.classList.remove("hidden");
        actionButton.disabled = false;
      } else if (data.next_action === "check_out") {
        actionTitle.textContent = "Fine turno";
        actionDescription.textContent =
          "Your check-in is recorded. You can now check out.";

        actionButton.textContent = "CHECK OUT";
        actionButton.classList.remove("hidden");
        actionButton.disabled = false;
      } else if (data.next_action === "completed") {
        pendingPin = null;

        actionTitle.textContent = "Attendance completed";
        actionDescription.textContent =
          "La tua presenza di oggi è già completata.";

        actionButton.classList.add("hidden");

        showMessage(
          actionMessage,
          "Check-in and Check-out are already completed for today."
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
        "Connection error. Please try again."
      );
    } finally {
      setBusy(verifyButton, false, "VERIFICA PIN");
    }
  }

  async function submitPunch() {
    if (busy || !selectedStaff || !pendingPin) return;

    const currentAction = actionButton.textContent;
    setBusy(actionButton, true, currentAction);

    showMessage(actionMessage, "Recording attendance...");

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
          data?.message || "Attendance could not be recorded."
        );

        return;
      }

      const eventName =
        data.event === "check_in" ? "CHECK-IN" : "CHECK-OUT";

      pendingPin = null;

      actionButton.classList.add("hidden");

      actionTitle.textContent = "Success!";
      actionDescription.textContent =
        "Nababi Ristorante · Staff Attendance";

      showMessage(
        actionMessage,
        eventName + " recorded successfully for " +
        (data.staff_name || selectedStaff.full_name) + "."
      );

      if (data.event === "check_in") {
        await showActiveStaffNotices();
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
      loading.textContent = "Supabase library could not be loaded.";
      return;
    }

    if (!supabaseUrl || !anonKey) {
      loading.textContent =
        "Supabase configuration is missing. Check config.js.";
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

    loadStaff();
  }

  start();
})();
