import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { checkIntegrationAuth, integrationJson, integrationOptions } from '@/lib/integrationAuth'
import { sendRequestSubmissionNotifications } from '@/lib/email'

// POST /api/integrations/v1/time-off-requests
//
// The write side of the integration: another app (Kevin, in Mel / WPPP MI)
// files a time-off request ON BEHALF OF a user, after that user confirmed
// the dates by email. It lands exactly like a request typed into the form:
// PENDING, the same submission emails, the same approval flow for Tim.
//
// Body: { userEmail, startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD",
//         requestType?: "TIME_OFF" | "WFH" | "BOTH" (default TIME_OFF),
//         title?, reason?, dayBreakdown?, source?: "kevin" }
// Bearer auth via the shared INTEGRATION_API_KEY.

export function OPTIONS() {
  return integrationOptions()
}

export async function POST(request: NextRequest) {
  const auth = checkIntegrationAuth(request)
  if (!auth.ok) return integrationJson({ error: auth.reason }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return integrationJson({ error: 'invalid_json' }, { status: 400 }) }

  const userEmail = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : ''
  const startDate = typeof body.startDate === 'string' ? body.startDate : ''
  const endDate = typeof body.endDate === 'string' ? body.endDate : ''
  const requestType = ['WFH', 'TIME_OFF', 'BOTH'].includes(body.requestType) ? body.requestType : 'TIME_OFF'
  const ymd = /^\d{4}-\d{2}-\d{2}$/
  if (!userEmail || !ymd.test(startDate) || !ymd.test(endDate)) {
    return integrationJson({ error: 'userEmail, startDate and endDate (YYYY-MM-DD) are required' }, { status: 400 })
  }
  if (endDate < startDate) return integrationJson({ error: 'endDate before startDate' }, { status: 400 })

  const user = await db.user.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } })
  if (!user) return integrationJson({ error: 'user_not_found', userEmail }, { status: 404 })

  // Same-day duplicate guard: an identical pending/approved range for this
  // user is returned, not created twice (Kevin may retry a send).
  const parse = (d: string) => new Date(d + 'T12:00:00')
  const existing = await db.request.findFirst({
    where: { userId: user.id, startDate: parse(startDate), endDate: parse(endDate), status: { in: ['PENDING', 'APPROVED'] } },
  })
  if (existing) return integrationJson({ request: existing, duplicate: true }, { status: 200 })

  const dayBreakdown = body.dayBreakdown && typeof body.dayBreakdown === 'object' && Object.keys(body.dayBreakdown).length > 0 ? body.dayBreakdown : null
  const created = await db.request.create({
    data: {
      userId: user.id,
      startDate: parse(startDate),
      endDate: parse(endDate),
      requestType,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : null,
      reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 2000) : null,
      dayBreakdown,
      status: 'PENDING',
    },
    include: { user: { select: { name: true, email: true } } },
  })

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ogilvyai-production.up.railway.app'
    await sendRequestSubmissionNotifications({
      employeeName: user.name,
      employeeEmail: user.email,
      startDate: parse(startDate),
      endDate: parse(endDate),
      requestType,
      title: created.title || undefined,
      reason: created.reason || undefined,
      requestId: created.id,
      baseUrl,
    })
  } catch (e) {
    console.error('[integrations/time-off-requests] notification failed', e)
  }

  return integrationJson({ request: created, duplicate: false }, { status: 201 })
}
