import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { decideRequest, ISAAC_APPROVER, JESS_APPROVER, TIM_APPROVER } from '@/lib/decideRequest'

const ADMIN_PORTAL_COOKIE = 'admin_portal_user'

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

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

    // Optional override: act as Isaac for this decision when the shared
    // Isaac-mode code is supplied. A valid code also satisfies the
    // authorization requirement, so non-admin sessions can use it (this is
    // how Isaac Mode lets people approve from inside the Tim view).
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

    if (!isaacOverride && (!session || !session.isAdmin)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const approver = pickApprover(request, isaacOverride)
    const result = await decideRequest({ requestId, status, adminNotes, approver })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code })
    return NextResponse.json({ request: result.request })
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
  return portal === 'jess' ? JESS_APPROVER : TIM_APPROVER
}
