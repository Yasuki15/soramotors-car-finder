# Car inquiry email notification setup

When someone submits the car inquiry form, you get an email at **yasuki@ramadbk.com** with everything they entered (car, details, contact info).

## 1. Resend account and API key

1. Go to [resend.com](https://resend.com) and sign up (free).
2. In the dashboard, go to **API Keys** and click **Create API Key**. Copy the key (starts with `re_`).
3. For testing you can send from `onboarding@resend.dev` (Resend’s test sender). For production, add and verify your own domain in Resend.

## 2. Add the secret in Supabase

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Project Settings** (gear) → **Edge Functions**.
3. Under **Secrets**, add:
   - **Name:** `RESEND_API_KEY`
   - **Value:** your Resend API key  
   Save.

## 3. Deploy the Edge Function

You need the Supabase CLI and to be logged in.

**Install CLI (if needed):**

- Windows (PowerShell): `irm https://supabase.com/install.ps1 | iex`
- Or: [Supabase CLI docs](https://supabase.com/docs/guides/cli)

**Deploy:**

```bash
cd c:\Users\yasuk\soramotors-car-finder
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy send-inquiry-email
```

- `YOUR_PROJECT_REF` is the ID in your project URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`.
- If you haven’t run `supabase init` in this folder, run `supabase init` first, then `supabase link --project-ref YOUR_PROJECT_REF`, then deploy.

After deploy, the function URL will be:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-inquiry-email`

## 4. Create the Database Webhook

1. In Supabase: **Database** → **Webhooks** (or **Project Settings** → **Database** → **Webhooks**).
2. Click **Create a new hook**.
3. Set:
   - **Name:** e.g. `Car inquiry → email`
   - **Table:** `car_inquiries`
   - **Events:** tick **Insert**
   - **Type:** HTTP Request
   - **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-inquiry-email`
   - **HTTP Headers:** leave default (or add `Content-Type: application/json` if required).
4. Save.

## 5. Test

1. Submit a test car inquiry from your Car Finder form.
2. Check **yasuki@ramadbk.com** (and spam folder). You should get an email with:
   - Car age, make & model
   - Trim, colour, year range, mileage, options, other notes
   - Contact name, email, phone
   - Submitted time

## Changing the recipient email

To use a different address, edit:

**File:** `supabase/functions/send-inquiry-email/index.ts`  

**Line:** `const TO_EMAIL = "yasuki@ramadbk.com";`  

Change to your desired address, then run:

```bash
supabase functions deploy send-inquiry-email
```

## Sender address (production)

The function currently sends from `onboarding@resend.dev` (Resend’s test sender). To use your own domain (e.g. `noreply@soramotors.com.au`):

1. In Resend, add and verify your domain.
2. In `supabase/functions/send-inquiry-email/index.ts`, change the `from` field to your verified address, then redeploy.
