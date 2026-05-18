import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import { sendRequestSubmissionNotifications } from '@/lib/email'
import { resolveSubmitterUser } from '@/lib/portalUser'

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

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { startDate, endDate, requestType, title, reason, dayBreakdown, notifyEmails, batchId, batchLabel } = await request.json()

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

    // Resolve which User the request should be filed under. Regular users
    // file as themselves. Admin sessions submit as the portal owner (Tim or
    // Jess each have a real User row, auto-created on portal login), so they
    // get the same approval flow + calendar invites as anyone else.
    const user = await resolveSubmitterUser(request, session)

    if (!user) {
      return NextResponse.json(
        { error: 'Could not resolve which user to file the request under.' },
        { status: 400 }
      )
    }

    // Create request
    // Ensure dayBreakdown is properly formatted (object with date keys)
    const formattedDayBreakdown = dayBreakdown && typeof dayBreakdown === 'object' && Object.keys(dayBreakdown).length > 0
      ? dayBreakdown
      : null

    const sanitizedNotifyEmails = sanitizeNotifyEmails(notifyEmails)
    
    // Parse date with noon time to prevent timezone shifting
    const parseDate = (dateStr: string) => {
      if (typeof dateStr === 'string' && dateStr.length === 10) {
        return new Date(dateStr + 'T12:00:00')
      }
      return new Date(dateStr)
    }
    
    const parsedStartDate = parseDate(startDate)
    const parsedEndDate = parseDate(endDate)

    const newRequest = await db.request.create({
      data: {
        userId: user.id,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        requestType,
        title: title || null,
        reason: reason || null,
        dayBreakdown: formattedDayBreakdown,
        notifyEmails: sanitizedNotifyEmails.length ? sanitizedNotifyEmails : undefined,
        batchId: typeof batchId === 'string' && batchId.length > 0 ? batchId : null,
        batchLabel: typeof batchLabel === 'string' && batchLabel.length > 0 ? batchLabel : null,
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

    // Send submission confirmation to employee + notification to Tim and Isaac
    try {
      // Get base URL from request headers or environment
      const host = request.headers.get('host') || 'localhost:3000'
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
      
      await sendRequestSubmissionNotifications({
        employeeName: user.name,
        employeeEmail: user.email,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        requestType,
        title: title || undefined,
        reason: reason || undefined,
        requestId: newRequest.id,
        baseUrl,
      })
    } catch (emailError: any) {
      console.error('Failed to send submission emails:', emailError)
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

function sanitizeNotifyEmails(raw: unknown): { name?: string; email: string }[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: { name?: string; email: string }[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const email = typeof (entry as any).email === 'string' ? (entry as any).email.trim() : ''
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const name = typeof (entry as any).name === 'string' ? (entry as any).name : undefined
    out.push({ email, name })
  }
  return out
}