import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Isaac Mode - accessible to anyone (no authentication required)

    // Get all users
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        passwordHash: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Get all admins
    const admins = await db.admin.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        passwordHash: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      users,
      admins,
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
