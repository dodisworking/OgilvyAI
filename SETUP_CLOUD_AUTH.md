# Cloud-Based Session Storage Setup Guide

Your authentication system has been successfully migrated from localStorage to cloud-based database sessions! All login information is now stored in your database and accessed via secure HTTP-only cookies.

## What Changed

### Before (localStorage)
- Authentication tokens stored in browser localStorage
- Not accessible across devices/browsers
- Vulnerable to XSS attacks
- Lost when browser cache is cleared

### After (Cloud Database)
- Sessions stored in database (cloud)
- Accessible across any device/browser
- Secure HTTP-only cookies (protected from XSS)
- Persistent until manually logged out or expired

## Database Changes

A new `Session` table has been added to your database schema:
- Stores session tokens
- Links to user/admin accounts
- Tracks expiration dates
- Automatically cleaned up when expired

## Setup Steps

### 1. Database Migration (Already Done)

The database schema has been updated automatically. If you need to recreate it:

```bash
npm run db:push
```

### 2. Environment Variables

Make sure your `.env` file has all required variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# JWT Secret (important for session security)
JWT_SECRET="your-secret-key-change-this-in-production"

# Gmail SMTP
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-app-password"

# Admin Email (Tim's email)
ADMIN_EMAIL="tim@example.com"
```

**Important**: If you change `JWT_SECRET`, all existing sessions will be invalidated.

### 3. Start the Development Server

```bash
npm run dev
```

### 4. Create Admin Account (If Not Done Yet)

```bash
# Install tsx if you haven't already
npm install --save-dev tsx

# Create Tim's admin account
npx tsx scripts/create-admin.ts tim@example.com timspassword
```

Replace `tim@example.com` and `timspassword` with Tim's actual email and desired password.

### 5. Test the System

1. **Test Employee Registration:**
   - Go to http://localhost:3000
   - Click "Don't have an account? Sign up"
   - Register a new employee
   - You should be automatically redirected to dashboard

2. **Test Employee Login:**
   - Log out
   - Log back in with the same credentials
   - Should work seamlessly

3. **Test Admin Login:**
   - Click "Are you Tim?" button
   - Log in with admin credentials
   - Should access admin dashboard

4. **Test Session Persistence:**
   - Log in on one browser
   - Close and reopen the browser
   - You should still be logged in (session persists)

5. **Test Cross-Device (Optional):**
   - Log in on one device
   - Log in on another device with same credentials
   - Both sessions should work independently

## How It Works

### Login Flow:
1. User submits email/password
2. Server verifies credentials
3. Server creates session record in database
4. Server sets HTTP-only cookie with session token
5. Browser automatically sends cookie with every request

### Request Flow:
1. Browser sends request with cookie
2. Server reads cookie
3. Server looks up session in database
4. Server verifies session is valid and not expired
5. Request proceeds with authenticated user

### Logout Flow:
1. User clicks logout
2. Server deletes session from database
3. Server clears cookie
4. User is redirected to login

## API Endpoints

### Authentication Endpoints:
- `POST /api/auth/register` - Register new employee (sets cookie)
- `POST /api/auth/login` - Employee login (sets cookie)
- `POST /api/admin/login` - Admin login (sets cookie)
- `POST /api/auth/logout` - Logout (clears cookie, deletes session)
- `GET /api/auth/me` - Get current user from cookie

### Protected Endpoints (require cookie):
- `GET /api/requests` - Get requests (user's own or all if admin)
- `POST /api/requests` - Create new request
- `POST /api/requests/approve` - Approve/reject request (admin only)
- `POST /api/auth/change-password` - Change password

## Session Management

### Session Duration:
- Default: 7 days
- Can be changed in `lib/session.ts` (SESSION_DURATION_DAYS)

### Expired Sessions:
- Automatically cleaned up when accessed
- Can manually clean up all expired sessions:
  ```typescript
  import { cleanupExpiredSessions } from '@/lib/session'
  const count = await cleanupExpiredSessions()
  ```

### Multiple Sessions:
- Users can have multiple active sessions (different devices)
- Each session is independent
- Logging out removes only that specific session

## Troubleshooting

### Issue: "Unauthorized" errors
- **Check**: Make sure cookies are enabled in browser
- **Check**: Ensure `.env` file has correct `JWT_SECRET`
- **Check**: Database has Session table (run `npm run db:push`)

### Issue: Sessions not persisting
- **Check**: Cookie settings in browser (should allow cookies)
- **Check**: HTTPS in production (secure cookies require HTTPS)
- **Check**: Same-site cookie settings (currently 'lax')

### Issue: Cannot log in
- **Check**: Database connection
- **Check**: User/Admin exists in database
- **Check**: Password is correct
- **Check**: Session table exists

### Issue: Logout not working
- **Check**: `/api/auth/logout` endpoint is accessible
- **Check**: Cookie is being cleared
- **Try**: Clear browser cookies manually

## Security Features

1. **HTTP-Only Cookies**: JavaScript cannot access cookies (XSS protection)
2. **Secure Cookies**: In production, cookies only sent over HTTPS
3. **SameSite**: Prevents CSRF attacks
4. **Database Validation**: Every request validates session exists
5. **Expiration**: Sessions automatically expire after 7 days
6. **Token Verification**: JWT tokens verified on every request

## Production Deployment

### Important Settings for Production:

1. **Update `.env`:**
   ```env
   NODE_ENV="production"
   JWT_SECRET="strong-random-secret-here"
   ```

2. **Database:**
   - Consider migrating from SQLite to PostgreSQL for production
   - Update `DATABASE_URL` in `.env`

3. **HTTPS:**
   - Secure cookies require HTTPS
   - Ensure your production server uses SSL/TLS

4. **Session Cleanup:**
   - Set up a cron job to periodically clean expired sessions
   - Or use a database cleanup script

## Next Steps

1. Test all authentication flows
2. Create admin account for Tim
3. Register test employees
4. Test request submission and approval
5. Verify email notifications work

## Questions?

If you encounter any issues:
1. Check browser console for errors
2. Check server logs
3. Verify database has Session table
4. Ensure all environment variables are set correctly

---

**Migration Complete!** Your authentication is now cloud-based and more secure! 🎉