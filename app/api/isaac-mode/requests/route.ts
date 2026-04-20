import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Isaac Mode requests endpoint - returns all requests (uses Isaac Mode password on client)
export async function GET(request: NextRequest) {
  try {
    // Get all requests from all users
    const requests = await db.request.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Convert dates to ISO strings for consistency
    const formattedRequests = requests.map(req => ({
      ...req,
      startDate: req.startDate.toISOString(),
      endDate: req.endDate.toISOString(),
      createdAt: req.createdAt.toISOString(),
      updatedAt: req.updatedAt.toISOString(),
    }))

    return NextResponse.json({ requests: formattedRequests })
  } catch (error: any) {
    console.error('Error fetching all requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests', details: error.message },
      { status: 500 }
    )
  }
}
