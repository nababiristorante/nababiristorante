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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { booking_code } = await req.json();
    if (typeof booking_code !== "string" || !/^NAB-[A-F0-9]{8,12}$/.test(booking_code)) {
      return json({ error: "Invalid booking code" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const notificationEmail = Deno.env.get("NOTIFICATION_EMAIL");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !notificationEmail || !resendFromEmail) {
      console.error("Missing required function secrets.");
      return json({ error: "Notification is not configured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: booking, error } = await admin
      .from("bookings")
      .select("booking_code, full_name, booking_date, booking_time, guests, phone, email, booking_type, notes, created_at")
      .eq("booking_code", booking_code)
      .maybeSingle();

    if (error || !booking) return json({ error: "Booking not found" }, 404);

    // Only allow a notification for a booking created very recently.
    const createdAt = new Date(booking.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 5 * 60 * 1000) {
      return json({ error: "Booking is not eligible for a new notification" }, 409);
    }

    const lines = [
      "Nuova prenotazione ricevuta — Nababi Ristorante",
      "",
      `Codice: ${booking.booking_code}`,
      `Nome: ${booking.full_name}`,
      `Data: ${booking.booking_date}`,
      `Ora: ${String(booking.booking_time || "").slice(0, 5)}`,
      `Ospiti: ${booking.guests}`,
      `Telefono: ${booking.phone || "Non indicato"}`,
      `Email cliente: ${booking.email || "Non indicata"}`,
      `Tipo: ${booking.booking_type || "table"}`,
      `Note: ${booking.notes || "Nessuna"}`,
      "",
      "Apri Admin Panel per confermare o rifiutare la prenotazione.",
    ];

    const mailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [notificationEmail],
        subject: "Nababi Ristorante — nuova prenotazione",
        text: lines.join("\n"),
      }),
    });

    if (!mailResponse.ok) {
      const details = await mailResponse.text();
      console.error("Resend delivery error:", details);
      return json({ error: "Email could not be sent" }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Booking notification error:", error);
    return json({ error: "Unexpected notification error" }, 500);
  }
});
