import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import { sendDrowningNotificationToUsers } from '@/lib/email'

// POST - Send drowning request notification to selected users
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session || !session.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const { drowningRequestId, userIds } = await request.json()

    if (!drowningRequestId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Drowning request ID and user IDs array are required' },
        { status: 400 }
      )
    }

    // Get the drowning request
    const drowningRequest = await db.drowningRequest.findUnique({
      where: { id: drowningRequestId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!drowningRequest) {
      return NextResponse.json(
        { error: 'Drowning request not found' },
        { status: 404 }
      )
    }

    // Get the users to notify
    const usersToNotify = await db.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (usersToNotify.length === 0) {
      return NextResponse.json(
        { error: 'No valid users found to notify' },
        { status: 400 }
      )
    }

    // Update the drowning request with notified users
    await db.drowningRequest.update({
      where: { id: drowningRequestId },
      data: {
        notifiedUsers: usersToNotify.map(u => u.id),
      },
    })

    // Send email notifications
    try {
      const host = request.headers.get('host') || 'localhost:3000'
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

      await sendDrowningNotificationToUsers({
        drowningUserName: drowningRequest.user.name,
        drowningUserEmail: drowningRequest.user.email,
        startDate: drowningRequest.startDate,
        endDate: drowningRequest.endDate,
        natureOfNeed: drowningRequest.natureOfNeed || undefined,
        usersToNotify: usersToNotify,
        baseUrl,
      })
    } catch (emailError) {
      console.error('Failed to send email notifications:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: `Notifications sent to ${usersToNotify.length} user(s)`,
      notifiedUsers: usersToNotify.map(u => ({ id: u.id, name: u.name, email: u.email })),
    })
  } catch (error: any) {
    console.error('Notify users error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to notify users' },
      { status: 500 }
    )
  }
}
