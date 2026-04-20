import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import { sendRequestDecisionToEmployee } from '@/lib/email'

const ADMIN_PORTAL_COOKIE = 'admin_portal_user'

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

    const { requestId, status, adminNotes } = await request.json()

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
      const portal = request.cookies.get(ADMIN_PORTAL_COOKIE)?.value === 'jess' ? 'jess' : 'tim'
      const approver =
        portal === 'jess'
          ? { name: 'Jessica Coccaro', email: 'jessica.coccaro@ogilvy.com' }
          : { name: 'Tim Legallo', email: 'tim.legallo@ogilvy.com' }

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

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    console.error('Approve/reject request error:', error)
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}