
(() => {
  const config = window.NABABI_CONFIG;

  const staffSelect = document.getElementById("staffSelect");
  const pinInput = document.getElementById("pin");
  const punchButton = document.getElementById("punchButton");
  const message = document.getElementById("message");

  if (!config || !window.supabase) {
    message.textContent = "Configuration error. Please contact Admin.";
    return;
  }

  const db = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );

  function showMessage(text, success = false) {
    message.textContent = text;
    message.style.background = success ? "#d8b76a" : "#f7f1e5";
    message.style.color = "#102d24";
  }

  async function loadStaff() {
    punchButton.disabled = true;
    staffSelect.innerHTML = '<option value="">Loading...</option>';

    const { data, error } = await db.rpc("nababi_staff_active_list");

    if (error) {
      staffSelect.innerHTML = '<option value="">Unable to load staff</option>';
      showMessage("Could not load staff list. Contact Admin.");
      console.error(error);
      return;
    }

    const staff = (Array.isArray(data) ? data : []).map((item) => ({
      id: item.staff_id ?? item.id,
      name: item.full_name ?? item.staff_name ?? item.name
    })).filter((item) => item.id && item.name);

    staffSelect.innerHTML = '<option value="">Select your name</option>';

    staff.forEach((person) => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.name;
      staffSelect.appendChild(option);
    });

    if (!staff.length) {
      showMessage("No active staff found. Contact Admin.");
      return;
    }

    punchButton.disabled = false;
    showMessage("Select your name and enter your PIN.", true);
  }

  punchButton.addEventListener("click", async () => {
    const staffId = staffSelect.value;
    const pin = pinInput.value.trim();

    if (!staffId) {
      showMessage("Please select your name.");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      showMessage("Please enter your 4-digit PIN.");
      pinInput.focus();
      return;
    }

    punchButton.disabled = true;
    punchButton.textContent = "PLEASE WAIT...";
    showMessage("Checking attendance...");

    try {
      const { data, error } = await db.rpc("staff_qr_punch", {
        p_staff_id: staffId,
        p_pin: pin
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (result && (result.success === false || result.ok === false)) {
        throw new Error(result.message || "Attendance was not recorded.");
      }

      showMessage(
        result?.message || "Attendance request completed. Please check with Admin if unsure.",
        true
      );

      pinInput.value = "";
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Attendance failed. Please try again.");
      pinInput.value = "";
    } finally {
      punchButton.disabled = false;
      punchButton.textContent = "CHECK IN / CHECK OUT";
    }
  });

  loadStaff();
})();
