import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

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
      const admin = await db.admin.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, name: true },
      })

      if (!admin) {
        return NextResponse.json(
          { error: 'Admin not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ user: admin, isAdmin: true })
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
