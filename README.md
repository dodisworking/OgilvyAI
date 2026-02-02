# Production Department Management System

A beautiful, modern organizational website for the production department head to manage employee time off and work from home requests.

## Features

- **Employee Authentication**: Secure login/registration system with password hashing
- **Time Off/WFH Requests**: Employees can submit requests with date ranges and optional reasons
- **Admin Dashboard**: Tim can view, approve, or reject all employee requests
- **Email Notifications**: Automatic email notifications via Gmail when requests are submitted or decided upon
- **Status Tracking**: Employees can view the status of their requests (Pending, Approved, Rejected)
- **Password Management**: Employees can change their passwords

## Tech Stack

- **Frontend**: Next.js 14+ with React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Google Cloud SQL - PostgreSQL (Prisma ORM)
- **Authentication**: JWT with bcrypt password hashing
- **Email**: Gmail SMTP via Nodemailer
- **UI Components**: Custom components with beautiful gradients and animations

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Google Cloud SQL PostgreSQL Connection
# See GOOGLE_CLOUD_SETUP.md for detailed setup instructions
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_PUBLIC_IP:5432/production_db?sslmode=require"

# JWT Secret (generate a random string for production)
JWT_SECRET="your-secret-key-change-this-in-production"

# Gmail SMTP Configuration
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-app-password"

# Admin Email (Tim's email)
ADMIN_EMAIL="tim@example.com"
```

**Gmail App Password Setup:**
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Go to Security > App passwords
4. Generate a new app password for "Mail"
5. Use that password as `GMAIL_APP_PASSWORD`

### 3. Set Up Google Cloud SQL Database

**IMPORTANT**: You need to set up Google Cloud SQL first! See **[GOOGLE_CLOUD_SETUP.md](GOOGLE_CLOUD_SETUP.md)** for complete instructions.

Quick steps:
1. Create a Google Cloud account
2. Create a Cloud SQL PostgreSQL instance
3. Get your connection string
4. Add it to `.env` as `DATABASE_URL`

Then run:
```bash
# Generate Prisma Client
npm run db:generate

# Push schema to Google Cloud SQL database
npm run db:push
```

### 4. Create Admin Account (Tim)

You'll need to create an admin account for Tim. Install tsx first (to run TypeScript scripts):

```bash
npm install --save-dev tsx
```

Then run the admin creation script:

```bash
npx tsx scripts/create-admin.ts tim@example.com timspassword
```

Or you can use Prisma Studio to manually create an admin:

```bash
npm run db:studio
```

Create an admin record with:
- email: Tim's email address
- passwordHash: Use an online bcrypt generator (cost: 10) to hash the password
- name: "Tim"

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Employee Flow

1. **Register**: Employees register with their work email and create a password
2. **Login**: Employees log in to access their dashboard
3. **Submit Request**: Click the "Time Off / WFH" bubble, select date range, choose type, and submit
4. **View Status**: See all their requests with current status
5. **Change Password**: Update password from the dashboard

### Admin Flow (Tim)

1. **Login**: Click "Are you Tim?" button on the login page
2. **View Requests**: See all employee requests in the admin dashboard
3. **Approve/Reject**: Review each request and approve or reject with optional notes
4. **Notifications**: Receive email notifications for new requests

## Project Structure

```
TimTheMan/
├── app/
│   ├── api/              # API routes
│   ├── admin/            # Admin dashboard page
│   ├── dashboard/        # Employee dashboard page
│   └── page.tsx         # Login/register page
├── components/
│   ├── Admin/           # Admin dashboard components
│   ├── Auth/            # Authentication components
│   ├── Dashboard/       # Employee dashboard components
│   └── UI/              # Reusable UI components
├── lib/                 # Utility functions (auth, email, db)
├── prisma/              # Database schema
└── types/               # TypeScript type definitions
```

## Database Schema

- **User**: Employee accounts
- **Request**: Time off/WFH requests
- **Admin**: Admin accounts (Tim)

## Future Enhancements

- Additional menu bubbles for other features
- Calendar view of all requests
- Export functionality
- Multi-admin support
- Email templates customization
- Request history and analytics

## License

Private - Production Department Use Only