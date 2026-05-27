# FASTPRINTLA GROW

FASTPRINTLA GROW is a simple SaaS MVP for finding local business leads with Google Places, lead credits, CSV export, public email lookup, saved leads, search history, and admin user management.

API keys and admin secrets stay server-side in Next.js API routes.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in the project root:

```bash
GOOGLE_MAPS_API_KEY=
ADMIN_PASSWORD=
ADMIN_MAX_LEADS=1000

MAGIC_LINK_SECRET=
APP_BASE_URL=http://localhost:3000

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

STARTER_SHOPIFY_URL=
GROWTH_SHOPIFY_URL=
PRO_SHOPIFY_URL=
AGENCY_SHOPIFY_URL=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Login

FASTPRINTLA GROW uses passwordless email login.

- Go to `/login`.
- Enter the same email used during Shopify checkout.
- In local development, the magic link is printed in the development server console instead of sending a real email.
- Clicking the magic link creates the user if needed, logs them in, and loads their plan and credits.

SMTP variables are reserved for a future real email provider.

## Supabase Storage

FASTPRINTLA GROW can use Supabase for persistent production data. Create this table in the Supabase SQL Editor before deploying:

```sql
create table if not exists public.fastprintgrow_app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant usage on schema public to service_role;
grant select, insert, update, delete on public.fastprintgrow_app_state to service_role;
```

Then add these environment variables locally and in Vercel:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_secret_service_role_key
```

If Supabase is configured and the Supabase table is empty, the app will seed it from the local JSON database once. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.

## Plans and Credits

- Free: 20 total lead credits, limited CSV, no public email lookup.
- Starter: $9.99, 100 credits, email lookup, CSV export, history, saved leads.
- Growth: $19.99, 250 credits, email lookup, CSV export, history, saved leads.
- Pro: $29.99, 500 credits, email lookup, CSV export, history, saved leads.
- Agency: $49.99, 1000 credits, email lookup, CSV export, history, saved leads.
- Admin: unlimited internal access, full CSV, full email lookup, user management.

Users request a quantity of leads. Credits are deducted only for returned leads that have not already been charged to that same user. Reloading saved history does not call Google again and does not deduct credits.

## Shopify Upgrade Links

Set these environment variables to your Shopify product URLs:

```bash
STARTER_SHOPIFY_URL=
GROWTH_SHOPIFY_URL=
PRO_SHOPIFY_URL=
AGENCY_SHOPIFY_URL=
```

If a URL is missing, the dashboard pricing card shows `Coming Soon`.

The code is prepared for a future Shopify webhook: after checkout, verify the webhook server-side, match by user email, then update `plan`, `creditsRemaining`, `creditsTotal`, `shopifyOrderNumber`, and `paymentStatus`.

## Admin

The private admin area is `/admin`.

Admin access works with either:

- the existing `ADMIN_PASSWORD` unlock flow, or
- a logged-in user whose plan is `admin`.

After admin login, `/admin` shows:

- total users
- free users
- paid users
- active users
- total searches
- credits used today
- new users today
- recent registrations
- quick plan, credit, and deactivate actions

Detailed user management is at `/admin/users`, where admin can manually edit plan, credits, Shopify order number, payment status, and active status.

## Local Data Storage

The MVP uses a local JSON database:

```text
data/fastlead-db.json
```

This is for local testing only. Before real Vercel production usage, move the data model to a persistent hosted database such as Supabase, PostgreSQL, Firebase, Neon, or another managed store.

## Email Lookup

Email lookup is not automatic. Paid users and admin must click `Find Public Emails`.

The app checks only public business websites returned by Google Places. It does not bypass login pages, captchas, blocked pages, or private data.

CSV export includes business name, phone, website, public email, email status, contact page URL, address, rating, Google Maps link, search keyword, search location, and search date.

## Google APIs Required

Enable these APIs for your Google key:

- Geocoding API
- Places API
