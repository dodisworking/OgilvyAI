import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { buildIcsRangesFromRequest } from '@/lib/icsRanges'
import { getSessionFromCookie } from '@/lib/session'
import { sendRequestSubmissionNotifications } from '@/lib/email'

// DELETE request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: requestId } = await params

    // Find the request and verify ownership (users can only delete their own requests)
    const requestData = await db.request.findUnique({
      where: { id: requestId },
    })

    if (!requestData) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Users can only delete their own requests, admins can delete any
    if (!session.isAdmin && requestData.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - You can only delete your own requests' },
        { status: 403 }
      )
    }

    // Delete the request
    await db.request.delete({
      where: { id: requestId },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Delete request error:', error)
    return NextResponse.json(
      { error: 'Failed to delete request' },
      { status: 500 }
    )
  }
}

// PUT/PATCH - Update request (and resubmit)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: requestId } = await params
    const { startDate, endDate, requestType, title, reason, notifyEmails, dayBreakdown } = await request.json()

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

    // Find the request and verify ownership
    const existingRequest = await db.request.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Users can only edit their own requests
    if (!session.isAdmin && existingRequest.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - You can only edit your own requests' },
        { status: 403 }
      )
    }

    // Parse date with noon time to prevent timezone shifting
    const parseDate = (dateStr: string) => {
      if (typeof dateStr === 'string' && dateStr.length === 10) {
        return new Date(dateStr + 'T12:00:00')
      }
      return new Date(dateStr)
    }

    // Update the request and set status back to PENDING (resubmit for review)
    const parsedStartDate = parseDate(startDate)
    const parsedEndDate = parseDate(endDate)

    const sanitizedNotifyEmails = sanitizeNotifyEmails(notifyEmails)
    const formattedDayBreakdown = dayBreakdown && typeof dayBreakdown === 'object' && Object.keys(dayBreakdown).length > 0
      ? dayBreakdown
      : undefined

    // Snapshot the previous date ranges so on the next approval we can send
    // CANCEL invites for the old days before the new ones go out.
    // Only snapshot when this request was previously approved (and had calendar
    // invites sent) — pending edits don't need cancellation.
    const datesActuallyChanged =
      existingRequest.startDate.getTime() !== parsedStartDate.getTime() ||
      existingRequest.endDate.getTime() !== parsedEndDate.getTime() ||
      JSON.stringify(existingRequest.dayBreakdown) !== JSON.stringify(formattedDayBreakdown ?? existingRequest.dayBreakdown)
    const shouldSnapshot = existingRequest.status === 'APPROVED' && datesActuallyChanged
    const previousRangesSnapshot = shouldSnapshot
      ? snapshotRequestRanges(
          existingRequest.dayBreakdown,
          existingRequest.startDate,
          existingRequest.endDate,
          existingRequest.requestType
        )
      : null

    const updatedRequest = await db.request.update({
      where: { id: requestId },
      data: {
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        requestType,
        title: title || null,
        reason: reason || null,
        ...(formattedDayBreakdown !== undefined ? { dayBreakdown: formattedDayBreakdown } : {}),
        ...(notifyEmails !== undefined
          ? {
              notifyEmails: sanitizedNotifyEmails.length
                ? (sanitizedNotifyEmails as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(previousRangesSnapshot
          ? { pendingCancelRanges: previousRangesSnapshot as unknown as Prisma.InputJsonValue }
          : {}),
        status: 'PENDING', // Reset to PENDING when edited
        adminNotes: null, // Clear admin notes when resubmitted
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // Send resubmission confirmation to employee + notification to Tim and Isaac
    try {
      const host = request.headers.get('host') || 'localhost:3000'
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

      await sendRequestSubmissionNotifications({
        employeeName: existingRequest.user.name,
        employeeEmail: existingRequest.user.email,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        requestType,
        title: title || undefined,
        reason: reason || undefined,
        requestId: updatedRequest.id,
        baseUrl,
      })
    } catch (emailError) {
      console.error('Failed to send resubmission emails:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ request: updatedRequest }, { status: 200 })
  } catch (error: any) {
    console.error('Update request error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update request' },
      { status: 500 }
    )
  }
}

function snapshotRequestRanges(
  dayBreakdown: unknown,
  startDate: Date,
  endDate: Date,
  requestType: string
): Array<{ startDate: string; endDate: string; type: 'TIME_OFF' | 'WFH' }> {
  // Use the same gap-filling logic as the live calendar invite so CANCEL
  // events line up exactly with what was originally sent.
  return buildIcsRangesFromRequest(dayBreakdown, startDate, endDate, requestType).map((r) => ({
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    type: r.type,
  }))
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
