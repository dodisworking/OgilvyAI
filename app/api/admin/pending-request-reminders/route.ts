import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import {
  getAdminReminderSettings,
  getRequestLastReminderAt,
  markRequestReminderSent,
} from '@/lib/adminReminderSettings'
import { sendPendingRequestReportToTim } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET

const getHourInTimezone = (date: Date, timeZone: string) => {
  const hour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone,
  }).format(date)
  return Number(hour)
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null
    const secretFromQuery = request.nextUrl.searchParams.get('secret')
    const forceRun = request.nextUrl.searchParams.get('force') === '1'

    const isCronAuthorized = Boolean(CRON_SECRET) && (bearerToken === CRON_SECRET || secretFromQuery === CRON_SECRET)

    let isAdminAuthorized = false
    if (!isCronAuthorized) {
      const cookieHeader = request.headers.get('cookie')
      const session = await getSessionFromCookie(cookieHeader)
      isAdminAuthorized = Boolean(session?.isAdmin)
    }

    if (!isCronAuthorized && !isAdminAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await getAdminReminderSettings()
    if (!settings.remindersEnabled) {
      return NextResponse.json({ ok: true, skipped: 'reminders disabled', sent: 0 })
    }

    const now = new Date()
    const hourInTimezone = getHourInTimezone(now, settings.timezone)
    if (!forceRun && hourInTimezone !== settings.reminderHour) {
      return NextResponse.json({
        ok: true,
        skipped: `outside reminder hour (${settings.reminderHour}:00 ${settings.timezone})`,
        sent: 0,
      })
    }

    const pendingRequests = await db.request.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

    const dueRequests: typeof pendingRequests = []

    for (const pending of pendingRequests) {
      const lastReminderAt = await getRequestLastReminderAt(pending.id)
      const referenceDate = lastReminderAt || pending.createdAt
      const msSinceReference = now.getTime() - new Date(referenceDate).getTime()
      const daysSinceReference = Math.floor(msSinceReference / (1000 * 60 * 60 * 24))

      if (daysSinceReference < settings.reminderEveryDays) {
        continue
      }

      dueRequests.push(pending)
    }

    if (dueRequests.length > 0) {
      await sendPendingRequestReportToTim(
        dueRequests.map((pending) => ({
          employeeName: pending.user.name,
          employeeEmail: pending.user.email,
          requestId: pending.id,
          requestType: pending.requestType,
          startDate: pending.startDate,
          endDate: pending.endDate,
          createdAt: pending.createdAt,
        })),
        baseUrl
      )

      for (const pending of dueRequests) {
        await markRequestReminderSent(pending.id, now)
      }
    }

    return NextResponse.json({
      ok: true,
      sent: dueRequests.length > 0 ? 1 : 0,
      includedRequests: dueRequests.length,
      pendingCount: pendingRequests.length,
      reminderEveryDays: settings.reminderEveryDays,
      reminderHour: settings.reminderHour,
      timezone: settings.timezone,
    })
  } catch (error: any) {
    console.error('Pending request reminders error:', error)
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 })
  }
}
