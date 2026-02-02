import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import { sendRequestNotificationToAdmin } from '@/lib/email'

// DELETE request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: requestId } = await params

    // Find the request and verify ownership (users can only delete their own requests)
    const requestData = await db.request.findUnique({
      where: { id: requestId },
    })

    if (!requestData) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Users can only delete their own requests, admins can delete any
    if (!session.isAdmin && requestData.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - You can only delete your own requests' },
        { status: 403 }
      )
    }

    // Delete the request
    await db.request.delete({
      where: { id: requestId },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Delete request error:', error)
    return NextResponse.json(
      { error: 'Failed to delete request' },
      { status: 500 }
    )
  }
}

// PUT/PATCH - Update request (and resubmit)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: requestId } = await params
    const { startDate, endDate, requestType, title, reason } = await request.json()

    // Validation
    if (!startDate || !endDate || !requestType) {
      return NextResponse.json(
        { error: 'Start date, end date, and request type are required' },
        { status: 400 }
      )
    }

    if (!['WFH', 'TIME_OFF', 'BOTH'].includes(requestType)) {
      return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
      )
    }

    // Find the request and verify ownership
    const existingRequest = await db.request.findUnique({
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

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Users can only edit their own requests
    if (!session.isAdmin && existingRequest.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - You can only edit your own requests' },
        { status: 403 }
      )
    }

    // Update the request and set status back to PENDING (resubmit for review)
    const updatedRequest = await db.request.update({
      where: { id: requestId },
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        requestType,
        title: title || null,
        reason: reason || null,
        status: 'PENDING', // Reset to PENDING when edited
        adminNotes: null, // Clear admin notes when resubmitted
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

    // Send email notification to admin about the updated/resubmitted request
    try {
      await sendRequestNotificationToAdmin({
        employeeName: existingRequest.user.name,
        employeeEmail: existingRequest.user.email,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        requestType,
        title: title || undefined,
        reason: reason || undefined,
      })
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ request: updatedRequest }, { status: 200 })
  } catch (error: any) {
    console.error('Update request error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update request' },
      { status: 500 }
    )
  }
}
