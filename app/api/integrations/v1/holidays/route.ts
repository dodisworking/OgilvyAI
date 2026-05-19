import { NextRequest, NextResponse } from 'next/server'

// US federal holidays computed on demand for a year (or year range). Returned
// in the same shape as approved-time-off entries so a consumer dashboard can
// render both feeds together.
//
// Auth + CORS: same setup as /api/integrations/v1/approved-time-off.
//
// Query params:
//   year   single year (default = current year)
//   from   ISO date — pulls all holidays whose date >= from
//   to     ISO date — pulls all holidays whose date <= to
//          (if from/to are provided they take precedence over year)

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
  if (!expected) return { ok: false, reason: 'Server missing INTEGRATION_API_KEY env var' }
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const headerKey = request.headers.get('x-api-key') || ''
  const queryKey = request.nextUrl.searchParams.get('apiKey') || ''
  const provided = bearer || headerKey || queryKey
  if (!provided) return { ok: false, reason: 'Missing API key' }
  if (provided !== expected) return { ok: false, reason: 'Invalid API key' }
  return { ok: true }
}

// ---- US federal holiday calculation ----

const dateKey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Nth weekday of a given month/year. weekday: 0=Sun, 1=Mon, …, 6=Sat.
const nthWeekday = (year: number, monthIndex: number, weekday: number, n: number) => {
  const first = new Date(year, monthIndex, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return new Date(year, monthIndex, 1 + offset + (n - 1) * 7)
}

// Last weekday of a given month/year.
const lastWeekday = (year: number, monthIndex: number, weekday: number) => {
  const last = new Date(year, monthIndex + 1, 0) // last day of month
  const offset = (last.getDay() - weekday + 7) % 7
  return new Date(year, monthIndex, last.getDate() - offset)
}

// When a fixed-date federal holiday falls on Sat/Sun, the observed day moves
// to Fri/Mon respectively. We return both `date` (actual) and `observed`.
const observedFor = (d: Date) => {
  const day = d.getDay()
  if (day === 6) {
    // Saturday → observed Friday
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
  }
  if (day === 0) {
    // Sunday → observed Monday
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  return d
}

interface Holiday {
  id: string
  name: string
  date: string // YYYY-MM-DD — actual date
  observed: string // YYYY-MM-DD — observed date (= date if it's a weekday)
  source: 'us-federal'
}

function usFederalHolidays(year: number): Holiday[] {
  const items: { name: string; date: Date }[] = [
    { name: "New Year's Day", date: new Date(year, 0, 1) },
    { name: 'Martin Luther King Jr. Day', date: nthWeekday(year, 0, 1, 3) },
    { name: "Presidents' Day", date: nthWeekday(year, 1, 1, 3) },
    { name: 'Memorial Day', date: lastWeekday(year, 4, 1) },
    { name: 'Juneteenth', date: new Date(year, 5, 19) },
    { name: 'Independence Day', date: new Date(year, 6, 4) },
    { name: 'Labor Day', date: nthWeekday(year, 8, 1, 1) },
    { name: 'Columbus Day', date: nthWeekday(year, 9, 1, 2) },
    { name: 'Veterans Day', date: new Date(year, 10, 11) },
    { name: 'Thanksgiving Day', date: nthWeekday(year, 10, 4, 4) },
    { name: 'Christmas Day', date: new Date(year, 11, 25) },
  ]
  return items.map((h, i) => ({
    id: `us-${year}-${i}`,
    name: h.name,
    date: dateKey(h.date),
    observed: dateKey(observedFor(h.date)),
    source: 'us-federal',
  }))
}

function parseDateOnly(input: string | null) {
  if (!input) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
}

export function GET(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth.ok) {
    return json({ error: auth.reason }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const from = parseDateOnly(sp.get('from'))
  const to = parseDateOnly(sp.get('to'))
  const yearParam = sp.get('year')

  let years: number[]
  if (from && to) {
    years = []
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) years.push(y)
  } else if (from) {
    years = [from.getFullYear()]
  } else if (to) {
    years = [to.getFullYear()]
  } else if (yearParam) {
    const y = Number(yearParam)
    if (!Number.isInteger(y) || y < 1900 || y > 3000) {
      return json({ error: 'Invalid year' }, { status: 400 })
    }
    years = [y]
  } else {
    years = [new Date().getFullYear()]
  }

  let holidays: Holiday[] = years.flatMap(usFederalHolidays)

  if (from) holidays = holidays.filter((h) => h.observed >= dateKey(from))
  if (to) holidays = holidays.filter((h) => h.observed <= dateKey(to))

  return json({
    generatedAt: new Date().toISOString(),
    source: 'us-federal-computed',
    count: holidays.length,
    holidays,
  })
}
