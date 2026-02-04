import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { profilePicture, accountType } = body

    // Build update data - only include fields that were provided
    const updateData: { profilePicture?: string | null; accountType?: string | null } = {}
    
    if (profilePicture !== undefined) {
      updateData.profilePicture = profilePicture
    }
    
    if (accountType !== undefined) {
      const normalizedRole =
        typeof accountType === 'string' ? accountType.trim().toUpperCase() : undefined
      const allowedRoles = ['PRODUCER', 'CREATIVE', 'CLIENT', 'OTHER']

      if (normalizedRole && !allowedRoles.includes(normalizedRole)) {
        return NextResponse.json(
          { error: 'Invalid account type' },
          { status: 400 }
        )
      }

      updateData.accountType = normalizedRole || null
    }

    // Update user in database
    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        accountType: true,
      },
    })

    return NextResponse.json({ 
      message: 'Profile updated successfully',
      user: updatedUser 
    })
  } catch (error: any) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { error: 'Failed to update profile', details: error.message },
      { status: 500 }
    )
  }
}
