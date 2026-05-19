import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Public-ish read-only feed of APPROVED time-off requests. Designed to be
// polled by another app (e.g. a project management dashboard) on whatever
// cadence it likes. Use `since` to fetch only entries changed after a
// previous poll for cheap incremental sync.
//
// Auth: send `Authorization: Bearer <INTEGRATION_API_KEY>` OR
//       `X-API-Key: <INTEGRATION_API_KEY>` OR
//       `?apiKey=<INTEGRATION_API_KEY>` (least preferred — visible in logs).
//
// CORS: allows the origin listed in INTEGRATION_ALLOWED_ORIGIN (defaults to
// `*`). Configure that env var on Railway to restrict access in production.
//
// Query params:
//   from   ISO date (YYYY-MM-DD) — only entries whose endDate >= from
//   to     ISO date (YYYY-MM-DD) — only entries whose startDate <= to
//   since  ISO timestamp        — only entries updated after this time
//                                 (use for incremental polling)
//   include  comma list: "wfh" to include WFH entries (default: only
//            actual TIME_OFF days appear; WFH is omitted from `entries` but
//            still counted in `dayBreakdown`).

const corsHeaders = () => {
  const allowed = process.env.INTEGRATION_ALLOWED_ORIGIN || '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, X-API-Key, Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

const json = (body: any, init?: ResponseInit) =>
  new NextResponse(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

function checkAuth(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  const expected = process.env.INTEGRATION_API_KEY
  if (!expected) {
    return { ok: false, reason: 'Server missing INTEGRATION_API_KEY env var' }
  }

  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const headerKey = request.headers.get('x-api-key') || ''
  const queryKey = request.nextUrl.searchParams.get('apiKey') || ''
  const provided = bearer || headerKey || queryKey

  if (!provided) return { ok: false, reason: 'Missing API key' }
  if (provided !== expected) return { ok: false, reason: 'Invalid API key' }
  return { ok: true }
}

function parseDateOnly(input: string | null) {
  if (!input) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
}

export async function GET(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth.ok) {
    return json({ error: auth.reason }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const from = parseDateOnly(sp.get('from'))
  const to = parseDateOnly(sp.get('to'))
  const sinceRaw = sp.get('since')
  const since = sinceRaw ? new Date(sinceRaw) : null
  const include = (sp.get('include') || '').toLowerCase().split(',').map((s) => s.trim())
  const includeWfh = include.includes('wfh')

  if (sinceRaw && (!since || isNaN(since.getTime()))) {
    return json({ error: 'Invalid `since` timestamp' }, { status: 400 })
  }

  try {
    const where: any = { status: 'APPROVED' }
    if (from) where.endDate = { gte: from }
    if (to) where.startDate = { ...(where.startDate || {}), lte: to }
    if (since) where.updatedAt = { gt: since }

    const requests = await db.request.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    // Expand each request into one entry per contiguous range. If a single
    // request has both TIME_OFF and WFH days mixed, they're returned as
    // separate entries so the consumer can color/label them differently.
    interface Entry {
      id: string
      requestId: string
      batchId: string | null
      batchLabel: string | null
      userName: string
      userEmail: string
      title: string | null
      reason: string | null
      type: 'TIME_OFF' | 'WFH'
      startDate: string
      endDate: string
      allDay: true
      updatedAt: string
    }

    const entries: Entry[] = []

    for (const r of requests) {
      const breakdown =
        r.dayBreakdown && typeof r.dayBreakdown === 'object' && !Array.isArray(r.dayBreakdown)
          ? (r.dayBreakdown as Record<string, string>)
          : null

      type SubRange = { type: 'TIME_OFF' | 'WFH'; start: Date; end: Date }
      const ranges: SubRange[] = []

      if (breakdown && Object.keys(breakdown).length > 0) {
        // Group contiguous same-type days into ranges
        const sorted = Object.entries(breakdown)
          .map(([k, t]) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k)
            if (!m) return null
            const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
            const type = t === 'TIME_OFF' || t === 'WFH' ? (t as 'TIME_OFF' | 'WFH') : null
            return type ? { date: d, type } : null
          })
          .filter((e): e is { date: Date; type: 'TIME_OFF' | 'WFH' } => e !== null)
          .sort((a, b) => a.date.getTime() - b.date.getTime())

        let cur: SubRange | null = null
        for (const { date, type } of sorted) {
          if (
            cur &&
            cur.type === type &&
            (date.getTime() - cur.end.getTime()) / 86400000 === 1
          ) {
            cur.end = date
          } else {
            if (cur) ranges.push(cur)
            cur = { type, start: date, end: date }
          }
        }
        if (cur) ranges.push(cur)
      } else {
        const fallbackType: 'TIME_OFF' | 'WFH' = r.requestType === 'WFH' ? 'WFH' : 'TIME_OFF'
        ranges.push({ type: fallbackType, start: r.startDate, end: r.endDate })
      }

      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i]
        if (range.type === 'WFH' && !includeWfh) continue
        entries.push({
          id: `${r.id}_${i}`,
          requestId: r.id,
          batchId: r.batchId ?? null,
          batchLabel: r.batchLabel ?? null,
          userName: r.user.name,
          userEmail: r.user.email,
          title: r.title ?? null,
          reason: r.reason ?? null,
          type: range.type,
          startDate: dateOnlyString(range.start),
          endDate: dateOnlyString(range.end),
          allDay: true,
          updatedAt: r.updatedAt.toISOString(),
        })
      }
    }

    // generatedAt is what the consumer should pass back as `since` on the
    // next poll to get only what's new.
    return json({
      generatedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    })
  } catch (error: any) {
    console.error('Integration time-off error:', error)
    return json({ error: 'Failed to load approved time off' }, { status: 500 })
  }
}

const dateOnlyString = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
