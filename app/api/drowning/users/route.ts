import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'

// GET - Get all users that can be notified about drowning requests
// Available to all authenticated users so they can select who to send their SOS to
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all users (excluding the current user if not admin)
    const users = await db.user.findMany({
      where: session.isAdmin ? undefined : {
        id: { not: session.userId } // Regular users don't see themselves in the list
      },
      select: {
        id: true,
        name: true,
        email: true,
        profilePicture: true,
        accountType: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
