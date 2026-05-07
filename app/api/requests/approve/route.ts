import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import {
  sendRequestDecisionToEmployee,
  sendApprovedTimeOffCalendarInvite,
  IcsRange,
  NotifyEmailEntry,
} from '@/lib/email'

const ADMIN_PORTAL_COOKIE = 'admin_portal_user'
const ISAAC_APPROVER = { name: 'Isaac Boruchowicz', email: 'isaac.boruchowicz@ogilvy.com' }

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

    const { requestId, status, adminNotes, approveAsIsaacCode } = await request.json()

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Request ID and status are required' },
        { status: 400 }
      )
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be APPROVED or REJECTED' },
        { status: 400 }
      )
    }

    // Optional override: act as Isaac for this single decision when the
    // shared Isaac-mode code is supplied. Validated server-side.
    let isaacOverride = false
    if (approveAsIsaacCode != null) {
      const expected = process.env.ISAAC_MODE_PASSWORD ?? '123'
      if (String(approveAsIsaacCode) !== expected) {
        return NextResponse.json(
          { error: 'Invalid Isaac code' },
          { status: 401 }
        )
      }
      isaacOverride = true
    }

    // Get the request with user info
    const requestData = await db.request.findUnique({
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

    if (!requestData) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Update request
    const updatedRequest = await db.request.update({
      where: { id: requestId },
      data: {
        status,
        adminNotes: adminNotes || null,
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

    // Send one threaded confirmation email to employee, with Tim + Isaac copied
    try {
      const approver = pickApprover(request, isaacOverride)

      await sendRequestDecisionToEmployee({
        requestId: requestId,
        employeeName: requestData.user.name,
        employeeEmail: requestData.user.email,
        startDate: requestData.startDate,
        endDate: requestData.endDate,
        requestType: requestData.requestType,
        status: status as 'APPROVED' | 'REJECTED',
        adminNotes: adminNotes || undefined,
        approvedByName: approver.name,
        approvedByEmail: approver.email,
      })
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError)
      // Don't fail the update if email fails
    }

    // On approval, send calendar invites to anyone the requester chose to notify
    if (status === 'APPROVED') {
      try {
        const notifyEmails = parseNotifyEmails(requestData.notifyEmails)
        const ranges = buildIcsRanges(
          requestData.dayBreakdown,
          requestData.startDate,
          requestData.endDate,
          requestData.requestType
        )
        if (notifyEmails.length > 0 && ranges.length > 0) {
          const approver = pickApprover(request, isaacOverride)

          await sendApprovedTimeOffCalendarInvite({
            requestId: requestId,
            employeeName: requestData.user.name,
            employeeEmail: requestData.user.email,
            ranges,
            notifyEmails,
            approvedByName: approver.name,
            approvedByEmail: approver.email,
          })
        }
      } catch (inviteError) {
        console.error('Failed to send calendar invites:', inviteError)
        // Don't fail the approval if invite send fails
      }
    }

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    console.error('Approve/reject request error:', error)
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}

function pickApprover(request: NextRequest, isaacOverride: boolean) {
  if (isaacOverride) return ISAAC_APPROVER
  const portal = request.cookies.get(ADMIN_PORTAL_COOKIE)?.value === 'jess' ? 'jess' : 'tim'
  return portal === 'jess'
    ? { name: 'Jessica Coccaro', email: 'jessica.coccaro@ogilvy.com' }
    : { name: 'Tim Legallo', email: 'tim.legallo@ogilvy.com' }
}

function parseNotifyEmails(raw: unknown): NotifyEmailEntry[] {
  if (!raw || !Array.isArray(raw)) return []
  const out: NotifyEmailEntry[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const email = typeof (entry as any).email === 'string' ? (entry as any).email.trim() : ''
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    const name = typeof (entry as any).name === 'string' ? (entry as any).name : undefined
    out.push({ email, name })
  }
  return out
}

function parseLocalDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
}

function buildIcsRanges(
  dayBreakdown: unknown,
  startDate: Date,
  endDate: Date,
  requestType: string
): IcsRange[] {
  // If we have a per-day breakdown, group consecutive same-type days into ranges.
  // Skips WFH days unless explicitly recorded — time off is the priority.
  const breakdown =
    dayBreakdown && typeof dayBreakdown === 'object' && !Array.isArray(dayBreakdown)
      ? (dayBreakdown as Record<string, string>)
      : null

  if (breakdown && Object.keys(breakdown).length > 0) {
    const entries = Object.entries(breakdown)
      .map(([key, type]) => {
        const date = parseLocalDateKey(key)
        if (!date) return null
        const t = type === 'TIME_OFF' || type === 'WFH' ? type : null
        if (!t) return null
        return { date, type: t as 'TIME_OFF' | 'WFH' }
      })
      .filter((e): e is { date: Date; type: 'TIME_OFF' | 'WFH' } => e !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const ranges: IcsRange[] = []
    let current: IcsRange | null = null
    for (const { date, type } of entries) {
      if (
        current &&
        current.type === type &&
        (date.getTime() - current.endDate.getTime()) / (1000 * 60 * 60 * 24) === 1
      ) {
        current.endDate = date
      } else {
        if (current) ranges.push(current)
        current = { startDate: date, endDate: date, type }
      }
    }
    if (current) ranges.push(current)
    return ranges
  }

  // Fallback: single range covering the whole request
  const type: 'TIME_OFF' | 'WFH' =
    requestType === 'WFH' ? 'WFH' : 'TIME_OFF'
  return [
    {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type,
    },
  ]
}