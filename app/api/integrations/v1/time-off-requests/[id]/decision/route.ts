import { NextRequest } from 'next/server'
import { checkIntegrationAuth, integrationJson, integrationOptions } from '@/lib/integrationAuth'
import { decideRequest, ISAAC_APPROVER, TIM_APPROVER } from '@/lib/decideRequest'

// POST /api/integrations/v1/time-off-requests/[id]/decision
// Body: { status: "APPROVED" | "REJECTED", approverEmail, adminNotes? }
// Only Tim or Isaac may decide — Kevin calls this when one of them replies
// "approve" / "reject" on the email thread. Same emails and calendar
// invites as a decision made in the admin UI.

export function OPTIONS() {
  return integrationOptions()
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = checkIntegrationAuth(request)
  if (!auth.ok) return integrationJson({ error: auth.reason }, { status: 401 })
  let body: any
  try { body = await request.json() } catch { return integrationJson({ error: 'invalid_json' }, { status: 400 }) }
  const status = body.status === 'APPROVED' || body.status === 'REJECTED' ? body.status : null
  if (!status) return integrationJson({ error: 'status must be APPROVED or REJECTED' }, { status: 400 })
  const email = typeof body.approverEmail === 'string' ? body.approverEmail.trim().toLowerCase() : ''
  const approver = email === TIM_APPROVER.email ? TIM_APPROVER : email === ISAAC_APPROVER.email ? ISAAC_APPROVER : null
  if (!approver) return integrationJson({ error: 'approver_not_allowed' }, { status: 403 })
  const result = await decideRequest({ requestId: params.id, status, adminNotes: typeof body.adminNotes === 'string' ? body.adminNotes : null, approver })
  if (!result.ok) return integrationJson({ error: result.error }, { status: result.code })
  return integrationJson({ request: result.request, decidedBy: approver.name })
}
