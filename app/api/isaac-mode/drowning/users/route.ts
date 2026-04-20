import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Isaac Mode drowning users endpoint - returns all users
export async function GET(request: NextRequest) {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        profilePicture: true,
        createdAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    )
  }
}
