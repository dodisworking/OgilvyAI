# Google Cloud SQL Setup Guide

This guide will help you set up Google Cloud SQL (PostgreSQL) to store all your data in the cloud.

## Prerequisites

1. A Google account
2. Access to Google Cloud Console
3. A credit card (for billing, but you get $300 free credits)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click "New Project"
4. Name it (e.g., "Production Management System")
5. Click "Create"

## Step 2: Enable Cloud SQL API

1. Go to [Cloud SQL API page](https://console.cloud.google.com/apis/library/sqladmin.googleapis.com)
2. Click "Enable" (may take a minute)

## Step 3: Create a Cloud SQL Instance

1. Go to [Cloud SQL Instances](https://console.cloud.google.com/sql/instances)
2. Click "Create Instance"
3. Choose **PostgreSQL**
4. Fill in the details:

   **Instance ID**: `production-db` (or any name you want)
   
   **Password**: Set a strong password (save this!)
   
   **Region**: Choose closest to you (e.g., `us-central1`)
   
   **Database Version**: PostgreSQL 15 or 16
   
   **Machine Type**: 
   - For development/testing: `db-f1-micro` (cheapest, ~$7/month)
   - For production: `db-g1-small` or higher
   
   **Storage**: 
   - Type: SSD
   - Capacity: 10 GB (minimum)

5. Click "Create Instance" (takes 5-10 minutes)

## Step 4: Create a Database

1. Once your instance is created, click on it
2. Go to the "Databases" tab
3. Click "Create Database"
4. Name it: `production_db` (or any name)
5. Click "Create"

## Step 5: Get Connection String

1. Still in your instance page, go to the "Overview" tab
2. Find "Connection name" - copy this (looks like: `project-id:region:instance-id`)
3. You'll need this for your connection string

## Step 6: Configure Access

### Option A: Private IP (Recommended for Production)
- Set up VPC connector (more complex, but more secure)

### Option B: Public IP (Easier for Development)
1. Go to "Connections" tab in your instance
2. Under "Authorized networks", click "Add network"
3. For development, you can add `0.0.0.0/0` (allows from anywhere)
   - **Warning**: Only use this for development/testing
   - For production, use specific IP addresses

## Step 7: Update Your .env File

Create or update your `.env` file with:

```env
# Google Cloud SQL PostgreSQL Connection
# Format: postgresql://USER:PASSWORD@PUBLIC_IP:5432/DATABASE_NAME?sslmode=require
# 
# Get these values from:
# - USER: Usually 'postgres' (or the user you created)
# - PASSWORD: The password you set when creating the instance
# - PUBLIC_IP: Find in your instance Overview tab
# - DATABASE_NAME: The database you created (e.g., 'production_db')
# - CONNECTION_NAME: project-id:region:instance-id (for connection string format)

DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_PUBLIC_IP:5432/production_db?sslmode=require"

# JWT Secret (generate a random string)
JWT_SECRET="your-super-secret-jwt-key-change-this"

# Gmail SMTP Configuration
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-gmail-app-password"

# Admin Email (Tim's email)
ADMIN_EMAIL="tim@example.com"
```

### Finding Your Connection Details:

1. **PUBLIC_IP**: 
   - Go to your instance → Overview tab
   - Look for "Public IP address"

2. **Connection String Format**:
   ```
   postgresql://postgres:password@IP_ADDRESS:5432/database_name?sslmode=require
   ```

## Step 8: Install PostgreSQL Client (for local development)

If you want to test the connection locally:

**macOS:**
```bash
brew install postgresql
```

**Windows:**
Download from: https://www.postgresql.org/download/windows/

**Linux:**
```bash
sudo apt-get install postgresql-client
```

## Step 9: Test Connection

Test if you can connect:

```bash
# Using psql
psql "postgresql://postgres:YOUR_PASSWORD@YOUR_PUBLIC_IP:5432/production_db?sslmode=require"

# Or using connection name (if using Cloud SQL Proxy)
# This requires installing Cloud SQL Proxy first
```

## Step 10: Run Database Migrations

Once your `.env` is configured:

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to Google Cloud SQL
npm run db:push
```

This will create all tables in your cloud database!

## Step 11: Create Admin Account

```bash
npx tsx scripts/create-admin.ts tim@example.com timspassword
```

## Alternative: Using Connection Name (More Secure)

If you want to use the connection name instead of public IP:

### Install Cloud SQL Proxy:

```bash
# macOS
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Linux
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Windows
# Download from: https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.x64.exe
```

### Run Proxy:

```bash
./cloud-sql-proxy YOUR_CONNECTION_NAME
```

Then in your `.env`:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/production_db"
```

## Cost Estimate

- **db-f1-micro**: ~$7-10/month
- **db-g1-small**: ~$25-30/month
- **Storage**: ~$0.17/GB/month
- **Network**: Free tier includes 1GB/day egress

**Free Credits**: New accounts get $300 free credits valid for 90 days

## Security Best Practices

1. ✅ Use strong passwords
2. ✅ Enable SSL (already in connection string with `sslmode=require`)
3. ✅ Restrict authorized networks in production
4. ✅ Use private IP when possible
5. ✅ Regularly update passwords
6. ✅ Monitor usage and costs

## Troubleshooting

### Connection Refused
- Check if instance is running
- Verify public IP is correct
- Check authorized networks settings

### SSL Error
- Make sure `sslmode=require` is in connection string
- Some clients need SSL certificate

### Authentication Failed
- Double-check username and password
- Default user is usually `postgres`

### Database Not Found
- Make sure you created the database in Step 4
- Verify database name matches in connection string

## Need Help?

- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Prisma + PostgreSQL](https://www.prisma.io/docs/concepts/database-connectors/postgresql)

---

**Your data is now stored in Google Cloud!** 🎉