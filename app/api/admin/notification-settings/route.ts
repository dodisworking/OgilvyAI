import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { getAdminReminderSettings, saveAdminReminderSettings } from '@/lib/adminReminderSettings'

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await getAdminReminderSettings()
    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Get notification settings error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const settings = await saveAdminReminderSettings({
      remindersEnabled: Boolean(body.remindersEnabled),
      reminderEveryDays: Number(body.reminderEveryDays) || 2,
      reminderHour: 10,
      timezone: typeof body.timezone === 'string' ? body.timezone : 'America/New_York',
    })

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Save notification settings error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
