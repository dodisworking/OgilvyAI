import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ISAAC_UNLOCK_COOKIE = 'isaac_mode_unlock'

export async function GET(request: NextRequest) {
  try {
    // Isaac Mode - requires unlock password (Igomoonnasa) via cookie
    const unlocked = request.cookies.get(ISAAC_UNLOCK_COOKIE)?.value === '1'
    if (!unlocked) {
      return NextResponse.json(
        { error: 'Isaac Mode is locked. Enter the password to view logins.' },
        { status: 403 }
      )
    }

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
