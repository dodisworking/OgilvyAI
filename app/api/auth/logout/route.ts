import { NextRequest, NextResponse } from 'next/server'
import { getCookieValue, deleteSession, COOKIE_NAME } from '@/lib/session'

const ADMIN_PORTAL_COOKIE = 'admin_portal_user'

export async function POST(request: NextRequest) {
  try {
    const token = getCookieValue(request, COOKIE_NAME)
    
    if (token) {
      await deleteSession(token)
    }

    const response = NextResponse.json({ message: 'Logged out successfully' })
    response.cookies.delete(COOKIE_NAME)
    response.cookies.delete(ADMIN_PORTAL_COOKIE)
    
    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    )
  }
}