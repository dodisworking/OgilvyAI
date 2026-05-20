// Build the IcsRange[] for a request's calendar invite.
//
// IMPORTANT bug-fix context (the one that motivated this helper):
// The earlier per-route implementations grouped only the days that appeared
// in `dayBreakdown`. If a request had e.g. startDate 2026-10-23 and endDate
// 2026-10-30 but the per-day breakdown was sparse (only 2026-10-23 was
// present, or the breakdown was missing some days because the request was
// edited / submitted via the simple date-picker path), the invite would
// span only the days present in the breakdown — leaving recipients with a
// one-day "out of office" event for a week-long absence.
//
// Behaviour now: startDate..endDate is authoritative for the OUTER bounds.
// Every calendar day inside that span gets classified:
//   - If it's in `dayBreakdown` with a valid type, that type wins.
//   - Otherwise it falls back to the request's primary type (WFH or
//     TIME_OFF; BOTH defaults to TIME_OFF since that's the more
//     coverage-relevant signal).
// Consecutive same-type days are then grouped into ranges so Outlook shows
// one all-day event per contiguous block.

export interface IcsRange {
  startDate: Date
  endDate: Date
  type: 'TIME_OFF' | 'WFH'
}

const startOfLocalDay = (d: Date) => {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

const dateKey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const nextDay = (d: Date) => {
  const out = new Date(d)
  out.setDate(out.getDate() + 1)
  return out
}

const sameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export function buildIcsRangesFromRequest(
  dayBreakdown: unknown,
  startDate: Date,
  endDate: Date,
  requestType: string
): IcsRange[] {
  const breakdown =
    dayBreakdown && typeof dayBreakdown === 'object' && !Array.isArray(dayBreakdown)
      ? (dayBreakdown as Record<string, string>)
      : null

  const defaultType: 'TIME_OFF' | 'WFH' = requestType === 'WFH' ? 'WFH' : 'TIME_OFF'

  const start = startOfLocalDay(new Date(startDate))
  const end = startOfLocalDay(new Date(endDate))

  if (end.getTime() < start.getTime()) return []

  const ranges: IcsRange[] = []
  let current: IcsRange | null = null

  let cursor = start
  // Walk inclusive; guard with sameCalendarDay so DST transitions don't
  // accidentally over- or under-shoot the boundary.
  // Upper bound on iterations: 2 years, which is generous for any request.
  for (let i = 0; i < 366 * 2; i++) {
    const key = dateKey(cursor)
    const raw = breakdown ? breakdown[key] : undefined
    const dayType: 'TIME_OFF' | 'WFH' =
      raw === 'TIME_OFF' || raw === 'WFH' ? (raw as 'TIME_OFF' | 'WFH') : defaultType

    if (current && current.type === dayType) {
      current.endDate = cursor
    } else {
      if (current) ranges.push(current)
      current = { startDate: cursor, endDate: cursor, type: dayType }
    }

    if (sameCalendarDay(cursor, end)) break
    cursor = nextDay(cursor)
  }
  if (current) ranges.push(current)

  return ranges
}
