import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'

// Tim/Admin calendar edits (date/type/status) without resubmission flow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session || !session.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const { id: requestId } = await params
    const { startDate, endDate, requestType, status } = await request.json()

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

    if (status && !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const parseDate = (dateStr: string) => {
      if (typeof dateStr === 'string' && dateStr.length === 10) {
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
        ...(status ? { status } : {}),
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

    return NextResponse.json({ request: updatedRequest }, { status: 200 })
  } catch (error: any) {
    console.error('Admin update request error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update request' },
      { status: 500 }
    )
  }
}
