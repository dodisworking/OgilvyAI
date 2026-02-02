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
      include: {
        shots: {
          include: {
            characters: true,
          },
          orderBy: { shotNumber: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all characters across all shots
    const characters = project.shots.flatMap(shot => shot.characters)

    return NextResponse.json({ characters })
  } catch (error: any) {
    console.error('Error fetching characters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch characters', details: error.message },
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
    const { characters } = body // Array of { shotId, characterNumber, ethnicity, description }

    if (!Array.isArray(characters)) {
      return NextResponse.json(
        { error: 'Characters must be an array' },
        { status: 400 }
      )
    }

    // Delete existing characters for the shots being updated
    const shotIds = [...new Set(characters.map((c: any) => c.shotId))]
    await db.character.deleteMany({
      where: {
        shotId: { in: shotIds },
      },
    })

    // Create new characters
    const createdCharacters = await Promise.all(
      characters.map(async (charData: any) => {
        const { shotId, characterNumber, ethnicity, description } = charData
        return db.character.create({
          data: {
            shotId,
            characterNumber,
            ethnicity: ethnicity || null,
            description: description || null,
          },
        })
      })
    )

    return NextResponse.json({ characters: createdCharacters }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating/updating characters:', error)
    return NextResponse.json(
      { error: 'Failed to create/update characters', details: error.message },
      { status: 500 }
    )
  }
}
