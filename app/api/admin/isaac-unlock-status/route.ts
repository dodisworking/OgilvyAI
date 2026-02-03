import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'isaac_mode_unlock'

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME)
  const unlocked = cookie?.value === '1'
  return NextResponse.json({ unlocked })
}
