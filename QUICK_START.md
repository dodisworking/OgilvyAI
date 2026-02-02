# 🚀 Quick Start Guide

## When You Reconnect Your SSD

Just run these commands and you're good to go:

```bash
# 1. Navigate to the project
cd "/Volumes/PortableSSD/cursor 2/TimTheMan"

# 2. Install dependencies (if needed)
npm install

# 3. Make sure your .env file exists with these variables:
# DATABASE_URL="your-supabase-connection-string"
# GMAIL_USER="timsproductionwizard@gmail.com"
# GMAIL_APP_PASSWORD="mqrdifxyumttnybi"
# ADMIN_EMAIL="isaac.boruchowicz@ogilvy.com"

# 4. Generate Prisma Client (if needed)
npm run db:generate

# 5. Start the development server
npm run dev
```

Then open: **http://localhost:3000**

---

## ✅ Everything You Need:

- ✅ All code is saved in this folder
- ✅ Database schema is saved in `prisma/schema.prisma`
- ✅ Database is in the cloud (Supabase) - no local database needed
- ✅ Dependencies are saved in `package.json`
- ✅ Email configuration saved in `.env`

## 🔐 Important: Your .env File

Make sure your `.env` file has:

```env
# Supabase PostgreSQL Connection
DATABASE_URL="postgresql://postgres.sicxjcxovvcktusztfxs:saugduysaguygs76@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"

# Gmail SMTP Configuration
GMAIL_USER="timsproductionwizard@gmail.com"
GMAIL_APP_PASSWORD="mqrdifxyumttnybi"

# Admin Email (where Tim gets notified)
ADMIN_EMAIL="isaac.boruchowicz@ogilvy.com"
```

## 🐛 If Something Breaks:

1. **Database connection issues?**
   ```bash
   npm run db:generate
   npm run db:push
   ```

2. **Prisma errors?**
   ```bash
   rm -rf .next
   npm run db:generate
   npm run dev
   ```

3. **Module not found?**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

---

## 📋 Features Installed:

1. ✅ Time Off / Work From Home requests with calendar
2. ✅ Admin dashboard for Tim
3. ✅ Email notifications (Gmail)
4. ✅ I'm Drowning rescue system
5. ✅ AI Production Scheduler Maker (placeholder)
6. ✅ Isaac Mode (credentials viewer)

That's it! Just `npm run dev` and go! 🎉
