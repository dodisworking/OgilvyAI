import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import {
  sendApprovedTimeOffCalendarInvite,
  IcsRange,
  NotifyEmailEntry,
} from '@/lib/email'
import { buildIcsRangesFromRequest } from '@/lib/icsRanges'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: requestId } = await params
    const body = await request.json().catch(() => ({}))
    const incoming = sanitizeNotifyEmails(body?.notifyEmails)

    if (incoming.length === 0) {
      return NextResponse.json(
        { error: 'Pick at least one person to share with.' },
        { status: 400 }
      )
    }

    const requestData = await db.request.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { name: true, email: true } },
      },
    })

    if (!requestData) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Owner-only — admins should approve through the normal flow, not share
    // someone else's invite from this endpoint.
    if (requestData.userId !== session.userId) {
      return NextResponse.json(
        { error: "You can only share invites for your own requests." },
        { status: 403 }
      )
    }

    if (requestData.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'You can only share invites for approved time off.' },
        { status: 400 }
      )
    }

    // Merge with anyone already on the invite, then send only to the NEW
    // recipients so we don't spam people who already accepted.
    const existing = parseExistingNotifyEmails(requestData.notifyEmails)
    const existingSet = new Set(existing.map((e) => e.email.toLowerCase()))
    const truly_new = incoming.filter((e) => !existingSet.has(e.email.toLowerCase()))

    if (truly_new.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        message: 'Those people already have the invite.',
      })
    }

    const ranges = buildIcsRanges(
      requestData.dayBreakdown,
      requestData.startDate,
      requestData.endDate,
      requestData.requestType
    )

    if (ranges.length === 0) {
      return NextResponse.json(
        { error: 'Could not build calendar ranges for this request.' },
        { status: 500 }
      )
    }

    try {
      await sendApprovedTimeOffCalendarInvite({
        requestId,
        employeeName: requestData.user.name,
        employeeEmail: requestData.user.email,
        ranges,
        notifyEmails: truly_new,
      })
    } catch (sendErr) {
      console.error('Failed to send share invites:', sendErr)
      return NextResponse.json(
        { error: 'Could not send invites right now. Try again in a minute.' },
        { status: 500 }
      )
    }

    // Persist the merged list so future shares dedupe correctly.
    const merged = [...existing, ...truly_new]
    await db.request.update({
      where: { id: requestId },
      data: { notifyEmails: merged as unknown as Prisma.InputJsonValue },
    })

    return NextResponse.json({ ok: true, sent: truly_new.length, addedEmails: truly_new })
  } catch (error) {
    console.error('Share invite error:', error)
    return NextResponse.json({ error: 'Failed to share invite' }, { status: 500 })
  }
}

function sanitizeNotifyEmails(raw: unknown): NotifyEmailEntry[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: NotifyEmailEntry[] = []
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

function parseExistingNotifyEmails(raw: unknown): NotifyEmailEntry[] {
  if (!raw || !Array.isArray(raw)) return []
  const out: NotifyEmailEntry[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const email = typeof (entry as any).email === 'string' ? (entry as any).email.trim() : ''
    if (!email) continue
    const name = typeof (entry as any).name === 'string' ? (entry as any).name : undefined
    out.push({ email, name })
  }
  return out
}

const buildIcsRanges = buildIcsRangesFromRequest
