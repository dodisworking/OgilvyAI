import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'

// GET all drowning requests (for admin or user's own requests)
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

    // Get all drowning requests - all users can see everyone's submissions
    const drowningRequests = await db.drowningRequest.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ drowningRequests })
  } catch (error) {
    console.error('Get drowning requests error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drowning requests' },
      { status: 500 }
    )
  }
}

// POST new drowning request
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

    const { startDate, endDate, natureOfNeed, dayBreakdown, sendToAll, userIds: selectedUserIds } = await request.json()

    // Validation
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    // Get user info
    const user = await db.user.findUnique({
      where: { id: session.userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Create drowning request
    const formattedDayBreakdown = dayBreakdown && typeof dayBreakdown === 'object' && Object.keys(dayBreakdown).length > 0 
      ? dayBreakdown 
      : null
    
    const newDrowningRequest = await db.drowningRequest.create({
      data: {
        userId: session.userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        natureOfNeed: natureOfNeed || null,
        dayBreakdown: formattedDayBreakdown,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    })

    // If sendToAll is true, send email to all users; if selectedUserIds provided, send only to those users
    const usersToNotify =
      sendToAll
        ? await db.user.findMany({ select: { id: true, name: true, email: true } })
        : Array.isArray(selectedUserIds) && selectedUserIds.length > 0
          ? await db.user.findMany({
              where: { id: { in: selectedUserIds } },
              select: { id: true, name: true, email: true },
            })
          : []

    if (usersToNotify.length > 0) {
      try {
        const { sendDrowningNotificationToUsers } = await import('@/lib/email')
        const host = request.headers.get('host') || 'localhost:3000'
        const protocol = request.headers.get('x-forwarded-proto') || 'http'
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

        await sendDrowningNotificationToUsers({
          drowningUserName: user.name,
          drowningUserEmail: user.email,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          natureOfNeed: natureOfNeed || undefined,
          usersToNotify,
          baseUrl,
        })

        await db.drowningRequest.update({
          where: { id: newDrowningRequest.id },
          data: {
            notifiedUsers: usersToNotify.map(u => u.id),
          },
        })
      } catch (emailError) {
        console.error('Failed to send emails:', emailError)
      }
    }

    return NextResponse.json({ drowningRequest: newDrowningRequest }, { status: 201 })
  } catch (error: any) {
    console.error('Create drowning request error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create drowning request', details: error },
      { status: 500 }
    )
  }
}
