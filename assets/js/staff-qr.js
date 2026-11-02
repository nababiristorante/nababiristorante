
(() => {
  "use strict";

  const CONFIG = window.NABABI_CONFIG;
  const SUPABASE = window.supabase;

  const staffSelect = document.getElementById("staffSelect");
  const pinInput = document.getElementById("pin");
  const punchButton = document.getElementById("punchButton");
  const messageBox = document.getElementById("message");

  let db = null;
  let busy = false;

  function showMessage(message, type = "info") {
    messageBox.textContent = message;

    messageBox.style.background =
      type === "success" ? "#d8b76a" :
      type === "error" ? "#f3d0c8" : "#f7f1e5";

    messageBox.style.color = "#102d24";
  }

  function setBusy(value) {
    busy = value;
    punchButton.disabled = value;
    punchButton.textContent = value
      ? "PLEASE WAIT..."
      : "CHECK IN / CHECK OUT";
  }

  function getStaffId(item) {
    return item.staff_id || item.id || "";
  }

  function getStaffName(item) {
    return item.full_name || item.staff_name || item.name || "";
  }

  async function loadStaff() {
    staffSelect.innerHTML =
      '<option value="">Loading staff...</option>';

    punchButton.disabled = true;

    try {
      const { data, error } = await db.rpc(
        "nababi_staff_active_list"
      );

      if (error) throw error;

      if (!Array.isArray(data) || data.length === 0) {
        staffSelect.innerHTML =
          '<option value="">No active staff found</option>';

        showMessage(
          "No active staff found. Please contact the administrator.",
          "error"
        );
        return;
      }

      staffSelect.innerHTML =
        '<option value="">Select your name</option>';

      data.forEach((item) => {
        const id = getStaffId(item);
        const name = getStaffName(item);

        if (!id || !name) return;

        const option = document.createElement("option");
        option.value = id;
        option.textContent = name;

        staffSelect.appendChild(option);
      });

      if (staffSelect.options.length <= 1) {
        showMessage(
          "Staff list could not be loaded correctly.",
          "error"
        );
        return;
      }

      showMessage("Select your name and enter your PIN.");
      punchButton.disabled = false;

    } catch (error) {
      console.error("Staff loading error:", error);

      staffSelect.innerHTML =
        '<option value="">Unable to load staff</option>';

      showMessage(
        "Could not load staff list: " +
        (error.message || "Unknown error"),
        "error"
      );
    }
  }

  async function submitPunch() {
    if (busy) return;

    const staffId = staffSelect.value;
    const pin = pinInput.value.trim();

    if (!staffId) {
      showMessage("Please select your name.", "error");
      return;
    }

    if (!/^[0-9]{4}$/.test(pin)) {
      showMessage(
        "Please enter your exact 4-digit PIN.",
        "error"
      );
      pinInput.focus();
      return;
    }

    setBusy(true);
    showMessage("Verifying your PIN...");

    try {
      const { data, error } = await db.rpc(
        "staff_qr_punch",
        {
          p_staff_id: staffId,
          p_pin: pin
        }
      );

      if (error) throw error;

      if (!data || data.ok !== true) {
        showMessage(
          data?.message || "Attendance could not be recorded.",
          "error"
        );
        return;
      }

      const event = String(data.event || "").toLowerCase();

      const action =
        event === "check_in"
          ? "CHECK IN"
          : event === "check_out"
          ? "CHECK OUT"
          : "ATTENDANCE";

      const staffName = data.staff_name || "Staff";

      let timeText = "";

      if (data.occurred_at) {
        const date = new Date(data.occurred_at);

        if (!Number.isNaN(date.getTime())) {
          timeText = " — " + date.toLocaleTimeString(
            "it-IT",
            {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Rome"
            }
          );
        }
      }

      showMessage(
        "Success! " + action + " recorded for " +
        staffName + timeText,
        "success"
      );

      pinInput.value = "";

    } catch (error) {
      console.error("Attendance error:", error);

      showMessage(
        "Attendance error: " +
        (error.message || "Please try again."),
        "error"
      );

    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (!CONFIG) {
      showMessage(
        "Configuration missing. Please check config.js.",
        "error"
      );
      return;
    }

    if (!SUPABASE || typeof SUPABASE.createClient !== "function") {
      showMessage(
        "Supabase library did not load. Please refresh the page.",
        "error"
      );
      return;
    }

    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
      showMessage(
        "Supabase URL or public key is missing in config.js.",
        "error"
      );
      return;
    }

    try {
      db = SUPABASE.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY
      );

      punchButton.addEventListener("click", submitPunch);

      pinInput.addEventListener("input", () => {
        pinInput.value = pinInput.value
          .replace(/[^0-9]/g, "")
          .slice(0, 4);
      });

      loadStaff();

    } catch (error) {
      console.error("Initialization error:", error);

      showMessage(
        "Could not initialize attendance: " +
        (error.message || "Unknown error"),
        "error"
      );
    }
  }

  start();
})();
