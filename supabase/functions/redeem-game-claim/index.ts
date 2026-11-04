import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://nababiristorante.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Staff login required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Redemption is not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authorization.slice(7);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid staff session" }, 401);

    const userId = userData.user.id;
    const { data: adminRow, error: adminError } = await admin
      .from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
    if (adminError) return json({ error: "Could not verify admin access" }, 500);

    let authorized = Boolean(adminRow) || userId === Deno.env.get("ADMIN_USER_ID");
    if (!authorized) {
      const { data: staff, error: staffError } = await admin
        .from("staff").select("auth_user_id,is_active").eq("auth_user_id", userId).maybeSingle();
      if (staffError) return json({ error: "Could not verify staff access" }, 500);
      authorized = Boolean(staff?.is_active);
    }
    if (!authorized) return json({ error: "Not authorized to redeem coupons" }, 403);

    const body = await req.json();
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^NBG-[A-F0-9]{12}$/.test(code)) return json({ error: "Enter a valid Nababi game coupon" }, 400);

    const { data, error } = await admin.rpc("redeem_game_claim", { p_claim_code: code });
    if (error) {
      console.error("Coupon redemption database error:", error);
      return json({ error: "Could not validate coupon" }, 500);
    }
    const result = Array.isArray(data) ? data[0] : data;
    return json({
      success: result?.success === true,
      message: result?.message || "Coupon validation failed",
      game_key: result?.game_key || null,
      reward_label: result?.reward_label || null,
      redeemed_at: result?.redeemed_at || null,
    }, result?.success ? 200 : 409);
  } catch (error) {
    console.error("Game coupon redemption failed:", error);
    return json({ error: "Unexpected redemption error" }, 500);
  }
});
