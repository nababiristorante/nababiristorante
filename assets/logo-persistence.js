
/* ==========================================
   NABABI RISTORANTE
   PERMANENT ADMIN LOGO
   SUPABASE STORAGE + SITE SETTINGS
========================================== */

(() => {
  "use strict";

  const BUCKET = "site-assets";
  const SETTING_KEY = "logo_url";

  const config =
    window.NABABI_CONFIG ||
    window.SUPABASE_CONFIG ||
    window.supabaseConfig;

  if (!config || !window.supabase?.createClient) {
    console.error("Nababi: Supabase configuration missing.");
    return;
  }

  const url = config.SUPABASE_URL || config.url;
  const key =
    config.SUPABASE_ANON_KEY ||
    config.anonKey ||
    config.key;

  if (!url || !key) {
    console.error("Nababi: Supabase URL or public key missing.");
    return;
  }

  // Reuse Supabase's normal browser session.
  const client = window.supabase.createClient(url, key);

  const get = (id) => document.getElementById(id);

  function showLogo(imageUrl) {
    const logo = get("admin-logo");
    const fallback = get("admin-logo-fallback");

    if (!logo || !imageUrl) return;

    logo.onload = () => {
      logo.hidden = false;
      if (fallback) fallback.hidden = true;
    };

    logo.onerror = () => {
      logo.hidden = true;
      if (fallback) fallback.hidden = false;
    };

    logo.src = imageUrl;
  }

  async function loadSavedLogo() {
    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) return;

      const { data, error } = await client
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value) {
        showLogo(data.setting_value);
      }
    } catch (error) {
      console.error("Nababi: Could not load saved logo.", error);
    }
  }

  async function uploadAndSaveLogo(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5 MB.");
      return;
    }

    const button = get("change-logo");
    if (button) button.disabled = true;

    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error("Please log in again.");
      }

      const extension =
        file.name.split(".").pop().toLowerCase() || "jpg";

      const filePath =
        "restaurant-logo/logo-" +
        Date.now() +
        "." +
        extension;

      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = client.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

      const imageUrl = publicData.publicUrl;

      const { error: saveError } = await client
        .from("site_settings")
        .upsert(
          {
            setting_key: SETTING_KEY,
            setting_value: imageUrl,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: "setting_key"
          }
        );

      if (saveError) throw saveError;

      showLogo(imageUrl);

      alert("Logo uploaded and saved successfully!");

    } catch (error) {
      console.error("Nababi logo upload error:", error);

      alert(
        "Logo could not be saved: " +
        (error.message || "Unknown error")
      );

    } finally {
      if (button) button.disabled = false;
    }
  }

  // Load the saved logo when the admin panel becomes visible.
  function watchAdminPanel() {
    const app = get("admin-app");

    if (!app) return;

    const observer = new MutationObserver(() => {
      if (!app.hidden) {
        loadSavedLogo();
      }
    });

    observer.observe(app, {
      attributes: true,
      attributeFilter: ["hidden", "style", "class"]
    });

    if (!app.hidden) loadSavedLogo();
  }

  // Capture the file change before the older logo handler.
  // This prevents the old temporary-only upload from running.
  document.addEventListener(
    "change",
    (event) => {
      if (event.target?.id !== "logo-file") return;

      event.stopImmediatePropagation();

      const file = event.target.files?.[0];

      if (file) {
        uploadAndSaveLogo(file);
      }

      event.target.value = "";
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      watchAdminPanel
    );
  } else {
    watchAdminPanel();
  }

})();
