import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

// GET all timelines for user
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const timelineId = url.searchParams.get('id')

    if (timelineId) {
      // Get specific timeline
      const schedule = await db.productionSchedule.findFirst({
        where: {
          id: timelineId,
          userId: session.userId,
        },
      })

      if (!schedule) {
        return NextResponse.json({ error: 'Timeline not found' }, { status: 404 })
      }

      return NextResponse.json({
        id: schedule.id,
        title: schedule.title,
        schedule: schedule.schedule || {},
        brushes: schedule.brushes || [],
        glueGroups: schedule.glueGroups || {},
      })
    } else {
      // Get all timelines for user
      const timelines = await db.productionSchedule.findMany({
        where: { userId: session.userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json({ timelines })
    }
  } catch (error: any) {
    console.error('Error fetching production schedules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedules', details: error.message },
      { status: 500 }
    )
  }
}

// POST - create new timeline
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      const text = await request.text()
      if (!text || text.trim() === '') {
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 })
      }
      body = JSON.parse(text)
    } catch (parseError: any) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json({ error: 'Invalid JSON in request body', details: parseError.message }, { status: 400 })
    }
    
    const { title, brushes, schedule, glueGroups } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    console.log('Creating timeline with data:', {
      userId: session.userId,
      title: title.trim(),
      brushesCount: Array.isArray(brushes) ? brushes.length : 0,
      scheduleKeys: Object.keys(schedule || {}).length,
      glueGroupsKeys: Object.keys(glueGroups || {}).length,
    })

    const productionSchedule = await db.productionSchedule.create({
      data: {
        userId: session.userId,
        title: title.trim(),
        brushes: brushes || [],
        schedule: schedule || {},
        glueGroups: glueGroups || {},
      },
    })

    console.log('Timeline created successfully:', productionSchedule.id)
    return NextResponse.json({ success: true, timeline: productionSchedule })
  } catch (error: any) {
    console.error('Error creating production schedule:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    })
    return NextResponse.json(
      { error: 'Failed to create schedule', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - update existing timeline
export async function PUT(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      const text = await request.text()
      if (!text || text.trim() === '') {
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 })
      }
      body = JSON.parse(text)
    } catch (parseError: any) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json({ error: 'Invalid JSON in request body', details: parseError.message }, { status: 400 })
    }
    
    const { id, title, brushes, schedule, glueGroups } = body

    if (!id) {
      return NextResponse.json({ error: 'Timeline ID is required' }, { status: 400 })
    }

    // Verify timeline belongs to user
    const existing = await db.productionSchedule.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 })
    }

    const productionSchedule = await db.productionSchedule.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(brushes !== undefined && { brushes }),
        ...(schedule !== undefined && { schedule }),
        ...(glueGroups !== undefined && { glueGroups }),
      },
    })

    return NextResponse.json({ success: true, timeline: productionSchedule })
  } catch (error: any) {
    console.error('Error updating production schedule:', error)
    return NextResponse.json(
      { error: 'Failed to update schedule', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - delete timeline
export async function DELETE(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Timeline ID is required' }, { status: 400 })
    }

    // Verify timeline belongs to user
    const existing = await db.productionSchedule.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 })
    }

    await db.productionSchedule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting production schedule:', error)
    return NextResponse.json(
      { error: 'Failed to delete schedule', details: error.message },
      { status: 500 }
    )
  }
}
