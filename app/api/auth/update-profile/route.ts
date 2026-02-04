import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'
import { AccountType, Prisma } from '@prisma/client'

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
    const updateData: Prisma.UserUpdateInput = {}
    
    if (profilePicture !== undefined) {
      updateData.profilePicture = profilePicture
    }
    
    if (accountType !== undefined) {
      const normalizedRole =
        typeof accountType === 'string' ? accountType.trim().toLowerCase() : ''
      const roleMap: Record<string, AccountType> = {
        producer: AccountType.PRODUCER,
        creative: AccountType.CREATIVE,
        account: AccountType.CLIENT,
        client: AccountType.CLIENT,
        other: AccountType.OTHER,
      }
      const mappedRole = roleMap[normalizedRole]

      if (normalizedRole && !mappedRole) {
        return NextResponse.json(
          { error: 'Invalid account type' },
          { status: 400 }
        )
      }

      if (mappedRole) {
        updateData.accountType = mappedRole
      }
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
