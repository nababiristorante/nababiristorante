
/* ==========================================
   NABABI RISTORANTE
   PERMANENT LOGO SAVE AND LOAD
   SUPABASE STORAGE + DATABASE
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
    console.error("Nababi: Supabase configuration not found.");
    return;
  }

  const supabaseUrl =
    config.SUPABASE_URL || config.url;

  const supabaseKey =
    config.SUPABASE_ANON_KEY ||
    config.anonKey ||
    config.key;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Nababi: Supabase credentials missing.");
    return;
  }

  const client = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
  );

  const get = (id) => document.getElementById(id);

  let isUploading = false;

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

      if (data && data.setting_value) {
        showLogo(data.setting_value);
      }

    } catch (error) {
      console.error("Nababi: Logo loading failed.", error);
    }
  }

  async function uploadAndSaveLogo(file) {
    if (!file || isUploading) return;

    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      alert("Please select a PNG, JPG, WEBP or GIF image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Logo must be smaller than 5 MB.");
      return;
    }

    isUploading = true;

    const button = get("change-logo");

    if (button) {
      button.disabled = true;
      button.textContent = "Uploading...";
    }

    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error("Please log in again.");
      }

      const extension =
        file.name.split(".").pop().toLowerCase();

      const filePath =
        "restaurant-logo/logo-" +
        Date.now() +
        "." +
        extension;

      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = client.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

      const imageUrl = publicData?.publicUrl;

      if (!imageUrl) {
        throw new Error("Could not generate public image URL.");
      }

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
      console.error("Nababi logo upload failed:", error);

      alert(
        "Logo could not be saved: " +
        (error.message || "Unknown error")
      );

    } finally {
      isUploading = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Change Logo";
      }
    }
  }

  function setupLogoUpload() {
    const fileInput = get("logo-file");
    const changeButton = get("change-logo");

    if (!fileInput || !changeButton) {
      console.error("Nababi: Logo upload elements not found.");
      return;
    }

    changeButton.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];

      if (file) {
        await uploadAndSaveLogo(file);
      }

      fileInput.value = "";
    });

    loadSavedLogo();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      setupLogoUpload
    );
  } else {
    setupLogoUpload();
  }

})();
