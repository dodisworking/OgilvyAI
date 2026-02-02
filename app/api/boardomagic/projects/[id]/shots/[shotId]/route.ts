import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; shotId: string } }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project belongs to user
    const project = await db.boardomaticProject.findFirst({
      where: {
        id: params.id,
        userId: session.userId,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const shot = await db.shot.findFirst({
      where: {
        id: params.shotId,
        projectId: params.id,
      },
      include: {
        characters: true,
        motionReview: true,
      },
    })

    if (!shot) {
      return NextResponse.json({ error: 'Shot not found' }, { status: 404 })
    }

    return NextResponse.json({ shot })
  } catch (error: any) {
    console.error('Error fetching shot:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shot', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; shotId: string } }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project belongs to user
    const project = await db.boardomaticProject.findFirst({
      where: {
        id: params.id,
        userId: session.userId,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { shotNumber, sceneDescription, motionDescription, duration } = body

    const updateData: any = {}
    if (shotNumber !== undefined) updateData.shotNumber = shotNumber
    if (sceneDescription !== undefined) updateData.sceneDescription = sceneDescription
    if (motionDescription !== undefined) updateData.motionDescription = motionDescription
    if (duration !== undefined) updateData.duration = duration

    const shot = await db.shot.update({
      where: { id: params.shotId },
      data: updateData,
      include: {
        characters: true,
        motionReview: true,
      },
    })

    return NextResponse.json({ shot })
  } catch (error: any) {
    console.error('Error updating shot:', error)
    return NextResponse.json(
      { error: 'Failed to update shot', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; shotId: string } }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project belongs to user
    const project = await db.boardomaticProject.findFirst({
      where: {
        id: params.id,
        userId: session.userId,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    await db.shot.delete({
      where: { id: params.shotId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting shot:', error)
    return NextResponse.json(
      { error: 'Failed to delete shot', details: error.message },
      { status: 500 }
    )
  }
}
