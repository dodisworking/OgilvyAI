#!/bin/bash
# Script to fully restart the dev server with fresh Prisma client

echo "🛑 Stopping any running Next.js processes..."
pkill -f "next dev" || true
sleep 2

echo "🧹 Clearing Next.js cache..."
rm -rf .next

echo "🔄 Regenerating Prisma client..."
npx prisma generate

echo "🚀 Starting dev server..."
npm run dev
