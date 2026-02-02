import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { profilePicture } = await request.json()

    if (!profilePicture) {
      return NextResponse.json(
        { error: 'Profile picture URL is required' },
        { status: 400 }
      )
    }

    // Update user's profile picture
    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: { profilePicture },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
      },
    })

    return NextResponse.json({
      user: updatedUser,
      message: 'Profile picture updated successfully',
    })
  } catch (error: any) {
    console.error('Update profile picture error:', error)
    return NextResponse.json(
      { error: 'Failed to update profile picture' },
      { status: 500 }
    )
  }
}
