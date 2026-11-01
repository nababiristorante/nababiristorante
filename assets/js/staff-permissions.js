
/**
 * Nababi Ristorante
 * Staff Permissions Manager
 *
 * IMPORTANT:
 * This module controls the Admin Panel UI only.
 * Real security must always be enforced by Supabase RLS
 * and secure server-side / Edge Function checks.
 */

(function (global) {
  "use strict";

  const MODULES = [
    "dashboard",
    "secret",
    "menu_manager",
    "categories",
    "bookings",
    "customers",
    "coupons",
    "staff",
    "performance",
    "attendance",
    "activity",
    "tables",
    "gallery",
    "delivery",
    "social",
    "menu_public",
    "news",
    "reviews",
    "hours",
    "logo",
    "reports",
    "contact",
    "settings"
  ];

  const TABLE_PERMISSION = {
    categories: "categories",
    bookings: "bookings",
    customers: "customers",
    coupons: "coupons",
    staff: "staff",
    performance: "staff_activity_logs",
    activity: "staff_activity_logs",
    attendance: "staff_attendance",
    tables: "restaurant_tables",
    gallery: "gallery_items",
    delivery: "delivery_orders",
    menu_manager: "menu_items",
    menu_public: "menu_items",
    news: "breaking_news",
    reviews: "reviews",
    hours: "opening_hours",
    secret: "secret_coupon_boxes",
    social: "social_links",
    contact: "contact_messages",
    logo: "site_settings",
    settings: "site_settings"
  };

  const state = {
    role: "guest",
    user: null,
    staff: null,
    permissions: {},
    loaded: false
  };

  function normalizePermissions(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const result = {};

    MODULES.forEach(function (moduleName) {
      result[moduleName] = value[moduleName] === true;
    });

    return result;
  }

  function setSession(data) {
    data = data || {};

    state.role = data.role === "admin"
      ? "admin"
      : data.role === "staff"
        ? "staff"
        : "guest";

    state.user = data.user || null;
    state.staff = data.staff || null;
    state.permissions = normalizePermissions(data.permissions);
    state.loaded = true;

    return getSession();
  }

  function clearSession() {
    state.role = "guest";
    state.user = null;
    state.staff = null;
    state.permissions = {};
    state.loaded = false;
  }

  function getSession() {
    return {
      role: state.role,
      user: state.user,
      staff: state.staff,
      permissions: Object.assign({}, state.permissions),
      loaded: state.loaded
    };
  }

  function canAccess(moduleName) {
    if (!moduleName) return false;

    if (state.role === "admin") {
      return true;
    }

    if (state.role !== "staff") {
      return false;
    }

    return state.permissions[moduleName] === true;
  }

  function visibleModules() {
    if (state.role === "admin") {
      return MODULES.slice();
    }

    if (state.role !== "staff") {
      return [];
    }

    return MODULES.filter(function (moduleName) {
      return canAccess(moduleName);
    });
  }

  async function loadCurrentUser(db) {
    if (!db || !db.auth || !db.from) {
      clearSession();
      return getSession();
    }

    try {
      const authResult = await db.auth.getUser();

      if (authResult.error || !authResult.data || !authResult.data.user) {
        clearSession();
        return getSession();
      }

      const user = authResult.data.user;

      const adminResult = await db
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminResult.error) {
        throw adminResult.error;
      }

      if (adminResult.data) {
        return setSession({
          role: "admin",
          user: user,
          permissions: {}
        });
      }

      const staffResult = await db
        .from("staff")
        .select("id, full_name, email, role, permissions, is_active, auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (staffResult.error) {
        throw staffResult.error;
      }

      const staff = staffResult.data;

      if (!staff || staff.is_active !== true) {
        clearSession();
        return getSession();
      }

      return setSession({
        role: "staff",
        user: user,
        staff: staff,
        permissions: staff.permissions
      });

    } catch (error) {
      console.error("Nababi permissions: user loading failed.", error);
      clearSession();

      return {
        ...getSession(),
        error: error.message || "Could not load user permissions."
      };
    }
  }

  async function saveStaffPermissions(db, staffId, permissions) {
    if (state.role !== "admin") {
      throw new Error("Only an administrator can change staff permissions.");
    }

    if (!db || !staffId) {
      throw new Error("Database connection or staff ID is missing.");
    }

    const safePermissions = normalizePermissions(permissions);

    const result = await db
      .from("staff")
      .update({
        permissions: safePermissions
      })
      .eq("id", staffId)
      .select("id, permissions")
      .single();

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  async function linkStaffAuthUser(db, staffId, authUserId) {
    if (state.role !== "admin") {
      throw new Error("Only an administrator can link a staff account.");
    }

    if (!db || !staffId || !authUserId) {
      throw new Error("Database connection, staff ID, or user ID is missing.");
    }

    const result = await db
      .from("staff")
      .update({
        auth_user_id: authUserId
      })
      .eq("id", staffId)
      .select("id, auth_user_id")
      .single();

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  global.NababiStaffPermissions = {
    modules: MODULES.slice(),
    tablePermission: Object.assign({}, TABLE_PERMISSION),

    setSession: setSession,
    clearSession: clearSession,
    getSession: getSession,
    canAccess: canAccess,
    visibleModules: visibleModules,

    loadCurrentUser: loadCurrentUser,
    saveStaffPermissions: saveStaffPermissions,
    linkStaffAuthUser: linkStaffAuthUser
  };

})(window);
