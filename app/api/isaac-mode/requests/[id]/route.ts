import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Isaac Mode - Edit request without notifications or status change
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params
    const { startDate, endDate, requestType, title, reason, status, dayBreakdown } = await request.json()

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

    // Find the request
    const existingRequest = await db.request.findUnique({
      where: { id: requestId },
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Update the request - NO status change, NO notifications (Isaac Mode stealth edit)
    // Add T12:00:00 to dates to prevent timezone shifting (noon instead of midnight)
    const parseDate = (dateStr: string) => {
      // If it's just a date (YYYY-MM-DD), add noon time to prevent timezone issues
      if (dateStr.length === 10) {
        return new Date(dateStr + 'T12:00:00')
      }
      return new Date(dateStr)
    }
    
    const updatedRequest = await db.request.update({
      where: { id: requestId },
      data: {
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        requestType,
        title: title || null,
        reason: reason || null,
        // Keep the same status unless explicitly provided
        ...(status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? { status } : {}),
        // Update dayBreakdown if provided
        ...(dayBreakdown ? { dayBreakdown } : {}),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    })

    // NO email notification sent - Isaac Mode stealth edit!

    return NextResponse.json({ request: updatedRequest }, { status: 200 })
  } catch (error: any) {
    console.error('Isaac Mode update request error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update request' },
      { status: 500 }
    )
  }
}

// Isaac Mode - Delete request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params

    // Find the request
    const existingRequest = await db.request.findUnique({
      where: { id: requestId },
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Delete the request
    await db.request.delete({
      where: { id: requestId },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Isaac Mode delete request error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete request' },
      { status: 500 }
    )
  }
}
