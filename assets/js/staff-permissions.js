/* Nababi Ristorante — Staff Permissions
 * Client-side helper for the admin dashboard.
 * IMPORTANT: UI checks are convenience only. Enforce the same permissions with
 * Supabase Row Level Security policies and trusted server-side functions.
 */
(function (global) {
  'use strict';

  const MODULES = [
    ['secret', 'Secret Coupon Box'], ['menu_manager', 'Menu Manager'],
    ['categories', 'Categories'], ['bookings', 'Bookings'],
['coupons', 'Coupons'],
    ['performance', 'Staff Performance'], ['attendance', 'Staff Attendance'],
    ['activity', 'Staff Activity Log'], ['tables', 'Tables'],
    ['gallery', 'Gallery'], ['delivery', 'Food Delivery'],
    ['social', 'Social'], ['menu_public', 'Public Menu'],
    ['news', 'Breaking News'], ['reviews', 'Reviews'],
    ['hours', 'Opening Hours'], ['logo', 'Logo Management'],
    ['reports', 'Reports'], ['contact', 'Contact'], ['settings', 'Settings']
  ];

  const TABLE_PERMISSION = {
    secret: ['coupons'], menu_manager: ['menu_items'], categories: ['categories'],
    bookings: ['bookings'], coupons: ['coupons'],
    performance: ['staff_activity_logs'], attendance: ['staff_attendance'],
    activity: ['staff_activity_logs'], tables: ['restaurant_tables'],
    gallery: ['gallery_items'], delivery: ['delivery_orders'], social: ['social_links'],
    menu_public: ['menu_items'], news: ['breaking_news'], reviews: ['reviews'],
    hours: ['opening_hours'], logo: ['site_settings'],
    reports: ['staff_attendance', 'staff_activity_logs'],
    contact: ['contact_messages'], settings: ['site_settings']
  };

  const state = { role: 'guest', userId: null, permissions: [] };

  function setSession(role, userId, permissions) {
    state.role = role === 'admin' ? 'admin' : 'staff';
    state.userId = userId || null;
    state.permissions = state.role === 'admin'
      ? MODULES.map(([id]) => id)
      : [...new Set(Array.isArray(permissions) ? permissions.filter(p => MODULES.some(([id]) => id === p)) : [])];
    return getSession();
  }

  function clearSession() {
    state.role = 'guest'; state.userId = null; state.permissions = [];
  }

  function canAccess(moduleId) {
    if (moduleId === 'dashboard') return state.role === 'admin' || state.role === 'staff';
    return state.role === 'admin' || (state.role === 'staff' && state.permissions.includes(moduleId));
  }

  function visibleModules() {
    return MODULES.filter(([id]) => canAccess(id));
  }

  function getSession() {
    return Object.freeze({ role: state.role, userId: state.userId, permissions: [...state.permissions] });
  }

  async function loadCurrentUser(supabase) {
    if (!supabase) throw new Error('Supabase client is required.');
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const user = authData && authData.user;
    if (!user) { clearSession(); throw new Error('No authenticated user.'); }

    const { data: admin, error: adminError } = await supabase
      .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (adminError) throw adminError;
    if (admin) return setSession('admin', user.id, []);

    const { data: staff, error: staffError } = await supabase
      .from('staff').select('auth_user_id, permissions, is_active')
      .eq('auth_user_id', user.id).maybeSingle();
    if (staffError) throw staffError;
    if (!staff || staff.is_active !== true) {
      clearSession();
      throw new Error('Staff account is not enabled. Contact the Super Admin.');
    }
    return setSession('staff', user.id, staff.permissions);
  }

  async function saveStaffPermissions(supabase, staffId, permissions, active) {
    if (state.role !== 'admin') throw new Error('Only Super Admin can change staff permissions.');
    if (!supabase || !staffId) throw new Error('Supabase client and staff ID are required.');
    const allowed = new Set(MODULES.map(([id]) => id));
    const clean = [...new Set((permissions || []).filter(id => allowed.has(id)))];
    const { data, error } = await supabase.from('staff')
      .update({ permissions: clean, is_active: active !== false })
      .eq('id', staffId)
      .select('id, auth_user_id, permissions, is_active')
      .single();
    if (error) throw error;
    return data;
  }

  async function linkStaffAuthUser(supabase, staffId, authUserId, permissions, active) {
    if (state.role !== 'admin') throw new Error('Only Super Admin can link staff accounts.');
    if (!supabase || !staffId || !authUserId) throw new Error('Missing required staff account details.');
    const allowed = new Set(MODULES.map(([id]) => id));
    const clean = [...new Set((permissions || []).filter(id => allowed.has(id)))];
    const { data, error } = await supabase.from('staff')
      .update({ auth_user_id: authUserId, permissions: clean, is_active: active !== false })
      .eq('id', staffId)
      .select('id, auth_user_id, permissions, is_active')
      .single();
    if (error) throw error;
    return data;
  }

  global.NababiStaffPermissions = Object.freeze({
    modules: MODULES.map(([id, label]) => ({ id, label })),
    tablePermission: TABLE_PERMISSION,
    setSession, clearSession, canAccess, visibleModules, getSession,
    loadCurrentUser, saveStaffPermissions, linkStaffAuthUser
  });
})(window);
