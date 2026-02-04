import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all users with their approved requests
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        profilePicture: true,
        requests: {
          where: {
            status: 'APPROVED',
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
