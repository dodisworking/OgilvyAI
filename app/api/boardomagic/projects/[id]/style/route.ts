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

    const drawingStyle = await db.drawing_styles.findUnique({
      where: { projectId: params.id },
      include: {
        style_references: true,
      },
    })

    return NextResponse.json({ drawingStyle })
  } catch (error: any) {
    console.error('Error fetching drawing style:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drawing style', details: error.message },
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
    const { imageUrl, description } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    // Get or create drawing style
    let drawingStyle = await db.drawing_styles.findUnique({
      where: { projectId: params.id },
    })

    if (!drawingStyle) {
      drawingStyle = await db.drawing_styles.create({
        data: {
          id: `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectId: params.id,
          updatedAt: new Date(),
        },
      })
    }

    // Create style reference
    const reference = await db.style_references.create({
      data: {
        id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        drawingStyleId: drawingStyle.id,
        imageUrl,
        description: description || null,
        isSelected: false,
      },
    })

    return NextResponse.json({ reference }, { status: 201 })
  } catch (error: any) {
    console.error('Error uploading style reference:', error)
    return NextResponse.json(
      { error: 'Failed to upload style reference', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const { selectedStyleId, description } = body

    // Get or create drawing style
    let drawingStyle = await db.drawing_styles.findUnique({
      where: { projectId: params.id },
    })

    if (!drawingStyle) {
      drawingStyle = await db.drawing_styles.create({
        data: {
          id: `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectId: params.id,
          selectedStyleId: selectedStyleId || null,
          description: description || null,
          updatedAt: new Date(),
        },
      })
    } else {
      // Update drawing style
      const updateData: any = {}
      if (selectedStyleId !== undefined) {
        updateData.selectedStyleId = selectedStyleId
        
        // Unselect all other references
        await db.style_references.updateMany({
          where: {
            drawingStyleId: drawingStyle.id,
            id: { not: selectedStyleId },
          },
          data: { isSelected: false },
        })

        // Select the chosen reference
        if (selectedStyleId) {
          await db.style_references.update({
            where: { id: selectedStyleId },
            data: { isSelected: true },
          })
        }
      }
      if (description !== undefined) updateData.description = description

      drawingStyle = await db.drawing_styles.update({
        where: { id: drawingStyle.id },
        data: updateData,
      })
    }

    const updatedStyle = await db.drawing_styles.findUnique({
      where: { id: drawingStyle.id },
      include: {
        style_references: true,
      },
    })

    return NextResponse.json({ drawingStyle: updatedStyle })
  } catch (error: any) {
    console.error('Error updating drawing style:', error)
    return NextResponse.json(
      { error: 'Failed to update drawing style', details: error.message },
      { status: 500 }
    )
  }
}
