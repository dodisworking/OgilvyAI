import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session || session.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const avatarData = await request.json()

    // Validate avatar data
    if (!avatarData || typeof avatarData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid avatar data' },
        { status: 400 }
      )
    }

    // Update user's avatar data in Supabase
    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: { avatarData },
      select: {
        id: true,
        avatarData: true,
      },
    })

    console.log('Avatar saved to database for user:', session.userId, 'Data:', avatarData)

    return NextResponse.json({ success: true, avatarData: updatedUser.avatarData })
  } catch (error: any) {
    console.error('Save avatar error:', error)
    return NextResponse.json(
      { error: 'Failed to save avatar' },
      { status: 500 }
    )
  }
}
