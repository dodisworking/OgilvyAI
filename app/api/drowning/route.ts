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

    const { startDate, endDate, natureOfNeed, dayBreakdown, sendToAll, selectedUserIds, customEmails } = await request.json()

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

    // Sanitize any custom emails — these are people who haven't signed up.
    const sanitizedCustomEmails: { email: string; name?: string }[] = []
    if (Array.isArray(customEmails)) {
      for (const entry of customEmails) {
        const email = typeof entry?.email === 'string' ? entry.email.trim() : ''
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
        const name = typeof entry?.name === 'string' ? entry.name : undefined
        sanitizedCustomEmails.push({ email, name })
      }
    }

    // Send notifications if requested
    const hasSelected = Array.isArray(selectedUserIds) && selectedUserIds.length > 0
    if (sendToAll || hasSelected || sanitizedCustomEmails.length > 0) {
      try {
        let usersToNotify: { id: string; name: string; email: string }[]

        if (sendToAll) {
          // Get all users
          usersToNotify = await db.user.findMany({
            select: {
              id: true,
              name: true,
              email: true,
            },
          })
        } else if (hasSelected) {
          // Get only selected users
          usersToNotify = await db.user.findMany({
            where: {
              id: { in: selectedUserIds }
            },
            select: {
              id: true,
              name: true,
              email: true,
            },
          })
        } else {
          usersToNotify = []
        }

        // Merge in custom emails (for people who don't have accounts yet),
        // de-duplicating against the user list.
        const known = new Set(usersToNotify.map((u) => u.email.toLowerCase()))
        const customRecipients = sanitizedCustomEmails
          .filter((e) => !known.has(e.email.toLowerCase()))
          .map((e) => ({
            id: `custom:${e.email.toLowerCase()}`,
            name: e.name || e.email,
            email: e.email,
          }))
        usersToNotify = [...usersToNotify, ...customRecipients]

        if (usersToNotify.length > 0) {
          // Import email function
          const { sendDrowningNotificationToUsers } = await import('@/lib/email')
          
          // Get base URL
          const host = request.headers.get('host') || 'localhost:3000'
          const protocol = request.headers.get('x-forwarded-proto') || 'http'
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

          // Send emails
          await sendDrowningNotificationToUsers({
            drowningUserName: user.name,
            drowningUserEmail: user.email,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            natureOfNeed: natureOfNeed || undefined,
            usersToNotify,
            baseUrl,
          })

          // Update the request with notified users — only real user IDs;
          // custom emails are people without accounts yet.
          await db.drowningRequest.update({
            where: { id: newDrowningRequest.id },
            data: {
              notifiedUsers: usersToNotify
                .map((u) => u.id)
                .filter((id) => !id.startsWith('custom:')),
            },
          })
        }
      } catch (emailError) {
        console.error('Failed to send emails:', emailError)
        // Don't fail the request if email fails
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
