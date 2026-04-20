import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Isaac Mode master calendar endpoint - no auth required (uses Isaac Mode password on client)
export async function GET(request: NextRequest) {
  try {
    // Get all users with their approved and pending requests
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        profilePicture: true,
        requests: {
          where: {
            status: {
              in: ['APPROVED', 'PENDING'],
            },
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            requestType: true,
            status: true,
            dayBreakdown: true,
          },
        },
      },
    })

    const schedules = users.map(user => ({
      userId: user.id,
      userName: user.name,
      profilePicture: user.profilePicture,
      requests: user.requests.map(req => ({
        id: req.id,
        startDate: req.startDate.toISOString(),
        endDate: req.endDate.toISOString(),
        requestType: req.requestType,
        status: req.status,
        dayBreakdown: req.dayBreakdown as Record<string, string> | undefined,
      })),
    }))

    return NextResponse.json({ schedules })
  } catch (error: any) {
    console.error('Error fetching master calendar:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedules', details: error.message },
      { status: 500 }
    )
  }
}
