import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import { sendRescueAcceptedNotification } from '@/lib/email'

// POST - Accept a rescue mission
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

    const { drowningRequestId } = await request.json()

    if (!drowningRequestId) {
      return NextResponse.json(
        { error: 'Drowning request ID is required' },
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

    // Don't allow accepting your own request
    if (drowningRequest.userId === session.userId) {
      return NextResponse.json(
        { error: 'You cannot accept your own rescue request' },
        { status: 400 }
      )
    }

    // Get the rescuer (current user)
    const rescuer = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!rescuer) {
      return NextResponse.json(
        { error: 'Rescuer not found' },
        { status: 404 }
      )
    }

    // Send email notification to the drowning person
    try {
      const host = request.headers.get('host') || 'localhost:3000'
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

      await sendRescueAcceptedNotification({
        drowningUserName: drowningRequest.user.name,
        drowningUserEmail: drowningRequest.user.email,
        rescuerName: rescuer.name,
        rescuerEmail: rescuer.email,
        startDate: drowningRequest.startDate,
        endDate: drowningRequest.endDate,
        natureOfNeed: drowningRequest.natureOfNeed || undefined,
        baseUrl,
      })
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError)
      // Don't fail the accept if email fails
    }

    return NextResponse.json({
      success: true,
      message: `Mission accepted! ${drowningRequest.user.name} has been notified.`,
    })
  } catch (error: any) {
    console.error('Accept mission error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to accept mission' },
      { status: 500 }
    )
  }
}
