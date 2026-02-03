# Vercel setup – make sure everything runs

Add these **Environment Variables** in Vercel so login, database, and optional features work.

## Where to add them

1. Go to **[vercel.com](https://vercel.com)** → your **OgilvyAI** project.
2. Open **Settings** → **Environment Variables**.
3. Add each variable below. Use **Production**, **Preview**, and **Development** (or at least **Production**).
4. After adding/editing, go to **Deployments** → click **…** on the latest → **Redeploy** so the new values are used.

---

## Required (login + database)

| Variable        | Where to get it | Example |
|----------------|-----------------|---------|
| **DATABASE_URL** | Same as your local `.env` or `.env.local`. If using **Supabase**: Project Settings → Database → **Connection string** → **URI**. Prefer the **Connection pooling** URL (port **6543**) for Vercel. | `postgresql://postgres.xxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres` |
| **JWT_SECRET**   | Same long random string you use locally. If you don’t have one: generate a random string (e.g. 32+ characters) and set it in both local `.env` and Vercel. | `a1b2c3d4e5...` |

Without these, **login will not work** on Vercel.

---

## Required for correct links (emails, redirects)

| Variable                 | Value |
|--------------------------|--------|
| **NEXT_PUBLIC_BASE_URL** | Your live app URL, e.g. `https://ogilvy-ai.vercel.app` (or the custom domain you use). |

---

## Optional

| Variable             | When you need it |
|----------------------|-------------------|
| **OPENAI_API_KEY**   | Production Schedule Maker (AI schedule generation). |
| **GMAIL_USER**       | Sending email (Drowning, requests, etc.). |
| **GMAIL_APP_PASSWORD** | Gmail app password for the above. |
| **ADMIN_EMAIL**      | Fallback “from” / admin address for emails. |

---

## Checklist

- [ ] **DATABASE_URL** added (Supabase or Postgres connection string).
- [ ] **JWT_SECRET** added (same as local or new and consistent).
- [ ] **NEXT_PUBLIC_BASE_URL** set to your Vercel URL (e.g. `https://ogilvy-ai.vercel.app`).
- [ ] Redeploy triggered after changing env vars.
- [ ] Test login on the live URL.

After redeploy, try logging in again. If it still fails, check **Vercel → Logs** and the browser **Network** tab (e.g. `/api/auth/login`) for the exact error.
