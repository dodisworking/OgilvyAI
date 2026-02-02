import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import { sendRequestNotificationToAdmin } from '@/lib/email'

// GET all requests (for admin or user's own requests)
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

    // If admin, get all requests; otherwise get user's own requests
    const requests = await db.request.findMany({
      where: session.isAdmin ? {} : { userId: session.userId },
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

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Get requests error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}

// POST new request
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

    const { startDate, endDate, requestType, title, reason, dayBreakdown } = await request.json()

    // Validation
    if (!startDate || !endDate || !requestType) {
      return NextResponse.json(
        { error: 'Start date, end date, and request type are required' },
        { status: 400 }
      )
    }

    if (!['WFH', 'TIME_OFF', 'BOTH'].includes(requestType)) {
      return NextResponse.json(
        { error: 'Invalid request type' },
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

    // Create request
    // Ensure dayBreakdown is properly formatted (object with date keys)
    const formattedDayBreakdown = dayBreakdown && typeof dayBreakdown === 'object' && Object.keys(dayBreakdown).length > 0 
      ? dayBreakdown 
      : null
    
    const newRequest = await db.request.create({
      data: {
        userId: session.userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        requestType,
        title: title || null,
        reason: reason || null,
        dayBreakdown: formattedDayBreakdown,
        status: 'PENDING',
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

    // Send email notification to admin
    try {
      // Get base URL from request headers or environment
      const host = request.headers.get('host') || 'localhost:3000'
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
      
      await sendRequestNotificationToAdmin({
        employeeName: user.name,
        employeeEmail: user.email,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        requestType,
        title: title || undefined,
        reason: reason || undefined,
        requestId: newRequest.id,
        baseUrl,
      })
    } catch (emailError: any) {
      console.error('Failed to send email notification:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ request: newRequest }, { status: 201 })
  } catch (error: any) {
    console.error('Create request error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create request', details: error },
      { status: 500 }
    )
  }
}