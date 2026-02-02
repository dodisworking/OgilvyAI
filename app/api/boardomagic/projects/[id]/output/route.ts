import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const output = await db.boardomaticOutput.findUnique({
      where: { projectId: params.id },
    })

    return NextResponse.json({ output })
  } catch (error: any) {
    console.error('Error fetching output:', error)
    return NextResponse.json(
      { error: 'Failed to fetch output', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const { videoUrl, thumbnailUrl, status } = body

    // Get or create output
    let output = await db.boardomaticOutput.findUnique({
      where: { projectId: params.id },
    })

    if (!output) {
      output = await db.boardomaticOutput.create({
        data: {
          projectId: params.id,
          videoUrl: videoUrl || null,
          thumbnailUrl: thumbnailUrl || null,
          status: status || 'PENDING',
        },
      })
    } else {
      const updateData: any = {}
      if (videoUrl !== undefined) updateData.videoUrl = videoUrl
      if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
      if (status !== undefined) updateData.status = status

      output = await db.boardomaticOutput.update({
        where: { id: output.id },
        data: updateData,
      })
    }

    // Update project status if video is ready
    if (status === 'COMPLETED' && videoUrl) {
      await db.boardomaticProject.update({
        where: { id: params.id },
        data: { status: 'COMPLETED' },
      })
    }

    return NextResponse.json({ output })
  } catch (error: any) {
    console.error('Error updating output:', error)
    return NextResponse.json(
      { error: 'Failed to update output', details: error.message },
      { status: 500 }
    )
  }
}
