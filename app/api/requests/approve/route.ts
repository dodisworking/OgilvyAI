import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import { sendRequestDecisionToEmployee } from '@/lib/email'

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

    // Send email notification to employee
    try {
      await sendRequestDecisionToEmployee({
        employeeName: requestData.user.name,
        employeeEmail: requestData.user.email,
        startDate: requestData.startDate,
        endDate: requestData.endDate,
        requestType: requestData.requestType,
        status: status as 'APPROVED' | 'REJECTED',
        adminNotes: adminNotes || undefined,
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