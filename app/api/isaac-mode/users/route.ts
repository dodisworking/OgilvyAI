import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

// Only allow isaac.boruchowicz@ogilvy.com to access this endpoint
const ISAAC_EMAIL = 'isaac.boruchowicz@ogilvy.com'

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the current user's email
    const currentUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    })

    // Only allow Isaac to access this
    if (currentUser?.email !== ISAAC_EMAIL) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch all users with their passwords
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        profilePicture: true,
        accountType: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Isaac mode error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    )
  }
}
