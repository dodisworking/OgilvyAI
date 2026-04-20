import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

const ADMIN_PORTAL_COOKIE = 'admin_portal_user'

// Get current user from session
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

    // Fetch user or admin data based on session type
    if (session.isAdmin) {
      const admin = await db.admin
        .findUnique({
          where: { id: session.userId },
          select: { id: true, email: true, name: true },
        })
        .catch(() => null)

      const portal = request.cookies.get(ADMIN_PORTAL_COOKIE)?.value === 'jess' ? 'jess' : 'tim'
      const baseAdmin = admin ?? {
        id: session.userId,
        email: 'tim.legallo@ogilvy.com',
        name: 'Tim',
      }
      const displayAdmin =
        portal === 'jess'
          ? { ...baseAdmin, name: 'Jess', email: 'jessica.coccaro@ogilvy.com' }
          : { ...baseAdmin, name: 'Tim', email: 'tim.legallo@ogilvy.com' }

      return NextResponse.json({ user: displayAdmin, isAdmin: true, adminPortal: portal })
    } else {
      // Fetch user with profile data
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, name: true, profilePicture: true, avatarData: true, accountType: true },
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ user, isAdmin: false })
    }
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    )
  }
}
