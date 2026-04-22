// Supabase Edge Function: send email when a new car inquiry is inserted.
// Triggered by Database Webhook on car_inquiries INSERT.
// Requires RESEND_API_KEY in Edge Function secrets.
// Runs on Deno (Supabase Edge); the declare block helps the IDE recognize Deno.

declare const Deno: { env: { get(key: string): string | undefined } };

// @ts-expect-error - Deno std module; resolved at runtime in Supabase Edge
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
// Use secret RESEND_TO_EMAIL so the deployed function always sends to the right address (Resend test mode = account email)
const TO_EMAIL: string = Deno.env.get("RESEND_TO_EMAIL") ?? "yasuki.rama@gmail.com";

interface CarInquiryRecord {
  id?: number;
  car_age?: string | null;
  manual_car_make?: string | null;
  manual_car_model?: string | null;
  car_make?: string | null;
  car_model?: string | null;
  trim_level?: string | null;
  mileage_from?: string | null;
  mileage_to?: string | null;
  color?: string | null;
  year_from?: string | null;
  year_to?: string | null;
  options?: string | null;
  other_requirements?: string | null;
  inquiry_seriousness?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  created_at?: string | null;
}

function formatValue(v: string | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v).trim();
}

function buildEmailBody(record: CarInquiryRecord): string {
  const r = record;
  const makeModel =
    r.car_age === "newer"
      ? `${formatValue(r.car_make)} ${formatValue(r.car_model)}`
      : `${formatValue(r.manual_car_make)} ${formatValue(r.manual_car_model)}`;

  return `
New Car Inquiry (Sora Motors)

—— Car requested ——
${r.car_age === "25_plus" ? "25+ years old" : "Newer than 25 years"}
Make & model: ${makeModel}

—— Details ——
Trim: ${formatValue(r.trim_level)}
Colour: ${formatValue(r.color)}
Year range: ${formatValue(r.year_from)} – ${formatValue(r.year_to)}
Mileage (km): ${formatValue(r.mileage_from)} – ${formatValue(r.mileage_to)}
Options/features: ${formatValue(r.options)}
Other notes: ${formatValue(r.other_requirements)}
Seriousness: ${formatValue(r.inquiry_seriousness)}

—— Contact ——
Name: ${formatValue(r.contact_name)}
Email: ${formatValue(r.contact_email)}
Phone: ${formatValue(r.contact_phone)}

Submitted at: ${formatValue(r.created_at) || new Date().toISOString()}
`.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload: { type?: string; record?: CarInquiryRecord } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (payload.type !== "INSERT" || !payload.record) {
    return new Response(
      JSON.stringify({ error: "Expected INSERT webhook with record" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const record = payload.record as CarInquiryRecord;
  const subject = `New car inquiry from ${formatValue(record.contact_name)} – ${formatValue(record.car_make) || formatValue(record.manual_car_make)} ${formatValue(record.car_model) || formatValue(record.manual_car_model)}`;
  const body = buildEmailBody(record);

  console.log("Sending inquiry email to:", TO_EMAIL);
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "Sora Motors Car Finder <onboarding@resend.dev>",
      to: [TO_EMAIL],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend API error:", res.status, errText);
    return new Response(
      JSON.stringify({ error: "Failed to send email", details: errText }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, message: "Email sent" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
