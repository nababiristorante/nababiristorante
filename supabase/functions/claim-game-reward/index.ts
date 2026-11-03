import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function keyedDigest(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const gameKey = typeof body?.game_key === "string" ? body.game_key.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const visitorToken = typeof body?.visitor_token === "string" ? body.visitor_token : "";

    if (!/^[a-z0-9_-]{2,80}$/i.test(gameKey)) {
      return json({ error: "Invalid game" }, 400);
    }
    // Require international E.164 format, e.g. +393331234567.
    if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
      return json({ error: "Enter a valid phone number with country code" }, 400);
    }
    if (visitorToken.length < 8 || visitorToken.length > 200) {
      return json({ error: "Invalid visitor token" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const hashSecret = Deno.env.get("GAME_PHONE_HASH_SECRET");
    if (!supabaseUrl || !serviceRoleKey || !hashSecret || hashSecret.length < 32) {
      console.error("Game claim function is missing required secrets.");
      return json({ error: "Reward claims are not configured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const phoneHash = phone ? await keyedDigest(hashSecret, phone) : null;
    const visitorHash = await keyedDigest(hashSecret, visitorToken);
    const { data, error } = await admin.rpc("issue_game_claim", {
      p_game_key: gameKey,
      p_phone_hash: phoneHash,
      p_visitor_hash: visitorHash,
    });

    if (error) {
      console.error("Game claim database error:", error);
      return json({ error: "Could not validate reward claim" }, 500);
    }

    const claim = Array.isArray(data) ? data[0] : data;
    if (!claim?.success) {
      return json({ error: claim?.message || "Reward is not available" }, 409);
    }

    return json({
      success: true,
      code: claim.claim_code,
      reward_type: claim.reward_type,
      reward_value: claim.reward_value,
      reward_label: claim.reward_label,
      expires_at: claim.expires_at,
      phone_required: false,
    });
  } catch (error) {
    console.error("Game claim error:", error);
    return json({ error: "Unexpected claim error" }, 500);
  }
});
