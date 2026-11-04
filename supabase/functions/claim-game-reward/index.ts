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
    const visitorToken = typeof body?.visitor_token === "string" ? body.visitor_token : "";
    const choice = typeof body?.choice === "string" ? body.choice.trim().slice(0, 40) : "";
    const turnstileToken = typeof body?.turnstile_token === "string" ? body.turnstile_token : "";

    if (!/^[a-z0-9_-]{2,80}$/i.test(gameKey)) {
      return json({ error: "Invalid game" }, 400);
    }
    if (visitorToken.length < 8 || visitorToken.length > 200) {
      return json({ error: "Invalid visitor token" }, 400);
    }
    if (!turnstileToken || turnstileToken.length > 2048) {
      return json({ error: "Please complete the security check." }, 400);
    }

    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileSecret) {
      console.error("Turnstile secret is not configured.");
      return json({ error: "Security verification is not configured" }, 500);
    }

    const verificationBody = new URLSearchParams({
      secret: turnstileSecret,
      response: turnstileToken,
    });
    const verificationResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: verificationBody },
    );
    if (!verificationResponse.ok) {
      console.error("Turnstile verification service returned an error.");
      return json({ error: "Security verification is temporarily unavailable." }, 502);
    }
    const verification = await verificationResponse.json();
    const allowedHostnames = new Set([
      "nababiristorante.vercel.app",
      "nababiristorante-git-feature-games-management-nababiristorante1.vercel.app",
    ]);
    if (
      verification?.success !== true ||
      !allowedHostnames.has(verification?.hostname)
    ) {
      return json({ error: "Security check failed. Please try again." }, 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const hashSecret = Deno.env.get("GAME_PHONE_HASH_SECRET");
    if (!supabaseUrl || !serviceRoleKey || !hashSecret || hashSecret.length < 32) {
      console.error("Game claim function is missing required secrets.");
      return json({ error: "Game play is not configured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const visitorHash = await keyedDigest(hashSecret, visitorToken);
    const { data, error } = await admin.rpc("play_game_and_issue_claim", {
      p_game_key: gameKey,
      p_visitor_hash: visitorHash,
      p_choice: choice,
    });

    if (error) {
      console.error("Game play database error:", error);
      return json({ error: "Could not process this game" }, 500);
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
      return json({ error: result?.message || "Game is not available" }, 409);
    }

    return json({
      success: true,
      won: result.won === true,
      code: result.claim_code || null,
      reward_type: result.reward_type || null,
      reward_value: result.reward_value ?? null,
      reward_label: result.reward_label || null,
      expires_at: result.expires_at || null,
      message: result.message || null,
    });
  } catch (error) {
    console.error("Game claim error:", error);
    return json({ error: "Unexpected claim error" }, 500);
  }
});
