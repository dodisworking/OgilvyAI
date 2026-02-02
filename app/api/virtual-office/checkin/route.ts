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

    const { teamsLink, meetingId, x, y } = await request.json()

    if (!teamsLink && !meetingId) {
      return NextResponse.json(
        { error: 'Teams link or meeting ID is required' },
        { status: 400 }
      )
    }

    // Convert meeting ID to full link if it's just an ID
    let finalLink = teamsLink
    if (meetingId && !teamsLink) {
      // Use meeting ID to create Teams link
      finalLink = `https://teams.microsoft.com/l/meetup-join/19:meeting_${meetingId}@thread.v2`
    } else if (teamsLink && !teamsLink.startsWith('http') && !teamsLink.startsWith('teams://')) {
      // Assume it's a meeting ID if it doesn't start with http or teams://
      finalLink = `https://teams.microsoft.com/l/meetup-join/19:meeting_${teamsLink}@thread.v2`
    }

    // Create or update check-in
    const checkIn = await db.virtualOfficeCheckIn.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        teamsLink: finalLink,
        isCheckedIn: true,
        x: x || null,
        y: y || null,
      },
      update: {
        teamsLink: finalLink,
        isCheckedIn: true,
        checkInTime: new Date(),
        x: x || undefined,
        y: y || undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    })

    return NextResponse.json({ checkIn })
  } catch (error: any) {
    console.error('Check-in error:', error)
    return NextResponse.json(
      { error: 'Failed to check in' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session || session.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Set isCheckedIn to false instead of deleting
    await db.virtualOfficeCheckIn.update({
      where: { userId: session.userId },
      data: { isCheckedIn: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Check-out error:', error)
    return NextResponse.json(
      { error: 'Failed to check out' },
      { status: 500 }
    )
  }
}
