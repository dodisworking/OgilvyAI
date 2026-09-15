import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  sendRequestDecisionToEmployee,
  sendApprovedTimeOffCalendarInvite,
  IcsRange,
  NotifyEmailEntry,
} from '@/lib/email'
import { buildIcsRangesFromRequest } from '@/lib/icsRanges'

export type Approver = { name: string; email: string }
export const TIM_APPROVER: Approver = { name: 'Tim Legallo', email: 'tim.legallo@ogilvy.com' }
export const ISAAC_APPROVER: Approver = { name: 'Isaac Boruchowicz', email: 'isaac.boruchowicz@ogilvy.com' }
export const JESS_APPROVER: Approver = { name: 'Jessica Coccaro', email: 'jessica.coccaro@ogilvy.com' }

/**
 * Approve or reject a request: update it, email the employee (Tim + Isaac
 * copied), and on approval send the calendar invites (cancelling any stale
 * ranges from an edit first). Shared by the admin UI route and the
 * integration endpoint Kevin calls when Tim or Isaac approve by email.
 */
export async function decideRequest(opts: {
  requestId: string
  status: 'APPROVED' | 'REJECTED'
  adminNotes?: string | null
  approver: Approver
}): Promise<{ ok: true; request: any } | { ok: false; error: string; code: number }> {
  const requestData = await db.request.findUnique({
    where: { id: opts.requestId },
    include: { user: { select: { name: true, email: true } } },
  })
  if (!requestData) return { ok: false, error: 'Request not found', code: 404 }

  const updatedRequest = await db.request.update({
    where: { id: opts.requestId },
    data: { status: opts.status, adminNotes: opts.adminNotes || null },
    include: { user: { select: { name: true, email: true } } },
  })

  try {
    await sendRequestDecisionToEmployee({
      requestId: opts.requestId,
      employeeName: requestData.user.name,
      employeeEmail: requestData.user.email,
      startDate: requestData.startDate,
      endDate: requestData.endDate,
      requestType: requestData.requestType,
      status: opts.status,
      adminNotes: opts.adminNotes || undefined,
      approvedByName: opts.approver.name,
      approvedByEmail: opts.approver.email,
    })
  } catch (emailError) {
    console.error('Failed to send email notification:', emailError)
  }

  if (opts.status === 'APPROVED') {
    try {
      const baseNotifyEmails = parseNotifyEmails(requestData.notifyEmails)
      const requesterEntry: NotifyEmailEntry = { name: requestData.user.name, email: requestData.user.email }
      const seen = new Set<string>()
      const notifyEmails: NotifyEmailEntry[] = []
      for (const entry of [requesterEntry, ...baseNotifyEmails]) {
        const key = entry.email.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        notifyEmails.push(entry)
      }
      const ranges = buildIcsRangesFromRequest(requestData.dayBreakdown, requestData.startDate, requestData.endDate, requestData.requestType)
      const cancelRanges = parsePendingCancelRanges(requestData.pendingCancelRanges)
      if (cancelRanges.length > 0 && notifyEmails.length > 0) {
        await sendApprovedTimeOffCalendarInvite({
          requestId: opts.requestId, employeeName: requestData.user.name, employeeEmail: requestData.user.email,
          ranges: cancelRanges, notifyEmails, approvedByName: opts.approver.name, approvedByEmail: opts.approver.email,
          method: 'CANCEL', sequence: 1,
        })
      }
      if (notifyEmails.length > 0 && ranges.length > 0) {
        await sendApprovedTimeOffCalendarInvite({
          requestId: opts.requestId, employeeName: requestData.user.name, employeeEmail: requestData.user.email,
          ranges, notifyEmails, approvedByName: opts.approver.name, approvedByEmail: opts.approver.email,
          method: 'REQUEST', sequence: cancelRanges.length > 0 ? 2 : 0,
        })
      }
      if (cancelRanges.length > 0) {
        await db.request.update({ where: { id: opts.requestId }, data: { pendingCancelRanges: Prisma.JsonNull } })
      }
    } catch (inviteError) {
      console.error('Failed to send calendar invites:', inviteError)
    }
  }
  return { ok: true, request: updatedRequest }
}

function parsePendingCancelRanges(raw: unknown): IcsRange[] {
  if (!Array.isArray(raw)) return []
  const out: IcsRange[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const start = (entry as any).startDate
    const end = (entry as any).endDate
    const type = (entry as any).type
    if (typeof start !== 'string' || typeof end !== 'string') continue
    if (type !== 'TIME_OFF' && type !== 'WFH') continue
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue
    out.push({ startDate, endDate, type })
  }
  return out
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
