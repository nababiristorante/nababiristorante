
(() => {
  "use strict";

  const config = window.NABABI_CONFIG;

  const message = document.getElementById("message");
  const startButton = document.getElementById("startButton");
  const punchButton = document.getElementById("punchButton");
  const resetButton = document.getElementById("resetButton");
  const pinArea = document.getElementById("pinArea");
  const pinInput = document.getElementById("pinInput");
  const staffLabel = document.getElementById("staffLabel");

  if (!config || !window.supabase) {
    message.textContent = "Configuration error. Please contact Admin.";
    startButton.disabled = true;
    return;
  }

  const db = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );

  let scanner = null;
  let staffId = null;
  let busy = false;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function showMessage(text, success = false) {
    message.textContent = text;
    message.style.color = success ? "#d8b76a" : "#ffd0c8";
  }

  async function stopScanner() {
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (error) {
      console.warn("Scanner stop:", error);
    }
  }

  async function startScanner() {
    if (busy) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      showMessage("Camera requires HTTPS and browser permission.");
      return;
    }

    try {
      showMessage("Opening camera...");
      startButton.disabled = true;

      scanner = new Html5Qrcode("reader");

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 }
        },
        async (decodedText) => {
          if (busy) return;

          const scannedValue = decodedText.trim();

          if (!uuidPattern.test(scannedValue)) {
            showMessage("Invalid Staff QR Code.");
            return;
          }

          busy = true;
          staffId = scannedValue;

          await stopScanner();

          staffLabel.textContent = "Staff QR detected";
          pinArea.style.display = "block";
          startButton.hidden = true;
          pinInput.value = "";
          pinInput.focus();

          showMessage("Enter your 4-digit Staff PIN.", true);
        },
        () => {}
      );

      showMessage("Camera ready. Scan your Staff QR Code.", true);

    } catch (error) {
      console.error(error);
      showMessage(
        "Camera could not start. Check camera permission and HTTPS."
      );
      startButton.disabled = false;
    }
  }

  async function submitPunch() {
    if (!staffId || busy === false) {
      // A scanned Staff ID is required.
      if (!staffId) return;
    }

    const pin = pinInput.value.trim();

    if (!/^[0-9]{4}$/.test(pin)) {
      showMessage("Enter exactly 4 digits.");
      return;
    }

    punchButton.disabled = true;
    showMessage("Verifying PIN...");

    try {
      const { data, error } = await db.rpc(
        "staff_qr_punch",
        {
          p_staff_id: staffId,
          p_pin: pin
        }
      );

      pinInput.value = "";

      if (error) {
        console.error(error);
        showMessage("Attendance could not be recorded.");
        return;
      }

      if (!data || data.ok !== true) {
        showMessage(data?.message || "PIN verification failed.");
        return;
      }

      const action =
        data.event === "check_in" ? "CHECK-IN" : "CHECK-OUT";

      showMessage(
        `${action} successful. Welcome ${data.staff_name || "Staff"}.`,
        true
      );

      pinArea.style.display = "none";
      resetButton.hidden = false;

    } catch (error) {
      console.error(error);
      showMessage("Unexpected error. Please contact Admin.");
    } finally {
      punchButton.disabled = false;
    }
  }

  async function resetScanner() {
    staffId = null;
    busy = false;

    pinInput.value = "";
    pinArea.style.display = "none";
    resetButton.hidden = true;
    startButton.hidden = false;
    startButton.disabled = false;

    showMessage("Ready for next Staff QR Scan.", true);
  }

  startButton.addEventListener("click", startScanner);
  punchButton.addEventListener("click", submitPunch);
  resetButton.addEventListener("click", resetScanner);

  pinInput.addEventListener("input", () => {
    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
  });

})();
