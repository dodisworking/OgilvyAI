import { db } from '@/lib/db'

export interface AdminReminderSettings {
  remindersEnabled: boolean
  reminderEveryDays: number
  reminderHour: number
  timezone: string
}

const DEFAULT_SETTINGS: AdminReminderSettings = {
  remindersEnabled: true,
  reminderEveryDays: 3,
  reminderHour: 10,
  timezone: 'America/New_York',
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

async function ensureReminderTables() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS admin_notification_settings (
      id INTEGER PRIMARY KEY,
      reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      reminder_every_days INTEGER NOT NULL DEFAULT 2,
      reminder_hour INTEGER NOT NULL DEFAULT 10,
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS request_reminder_state (
      request_id TEXT PRIMARY KEY,
      last_reminded_at TIMESTAMPTZ NULL
    )
  `)
}

export async function getAdminReminderSettings(): Promise<AdminReminderSettings> {
  await ensureReminderTables()

  const rows = await db.$queryRawUnsafe<Array<{
    reminders_enabled: boolean
    reminder_every_days: number
    reminder_hour: number
    timezone: string
  }>>(
    `SELECT reminders_enabled, reminder_every_days, reminder_hour, timezone
     FROM admin_notification_settings
     WHERE id = 1
     LIMIT 1`
  )

  if (!rows[0]) {
    return DEFAULT_SETTINGS
  }

  return {
    remindersEnabled: rows[0].reminders_enabled,
    reminderEveryDays: clamp(Number(rows[0].reminder_every_days) || 2, 1, 30),
    reminderHour: clamp(Number(rows[0].reminder_hour) || 10, 0, 23),
    timezone: rows[0].timezone || DEFAULT_SETTINGS.timezone,
  }
}

export async function saveAdminReminderSettings(input: Partial<AdminReminderSettings>) {
  await ensureReminderTables()

  const current = await getAdminReminderSettings()
  const next: AdminReminderSettings = {
    remindersEnabled: input.remindersEnabled ?? current.remindersEnabled,
    reminderEveryDays: clamp(input.reminderEveryDays ?? current.reminderEveryDays, 1, 30),
    reminderHour: clamp(input.reminderHour ?? current.reminderHour, 0, 23),
    timezone: input.timezone || current.timezone || DEFAULT_SETTINGS.timezone,
  }

  await db.$executeRawUnsafe(
    `INSERT INTO admin_notification_settings
      (id, reminders_enabled, reminder_every_days, reminder_hour, timezone, updated_at)
     VALUES (1, $1, $2, $3, $4, NOW())
     ON CONFLICT (id)
     DO UPDATE SET
       reminders_enabled = EXCLUDED.reminders_enabled,
       reminder_every_days = EXCLUDED.reminder_every_days,
       reminder_hour = EXCLUDED.reminder_hour,
       timezone = EXCLUDED.timezone,
       updated_at = NOW()`,
    next.remindersEnabled,
    next.reminderEveryDays,
    next.reminderHour,
    next.timezone
  )

  return next
}

export async function getRequestLastReminderAt(requestId: string): Promise<Date | null> {
  await ensureReminderTables()
  const rows = await db.$queryRawUnsafe<Array<{ last_reminded_at: Date | null }>>(
    `SELECT last_reminded_at FROM request_reminder_state WHERE request_id = $1 LIMIT 1`,
    requestId
  )
  return rows[0]?.last_reminded_at ? new Date(rows[0].last_reminded_at) : null
}

export async function markRequestReminderSent(requestId: string, sentAt: Date = new Date()) {
  await ensureReminderTables()
  await db.$executeRawUnsafe(
    `INSERT INTO request_reminder_state (request_id, last_reminded_at)
     VALUES ($1, $2)
     ON CONFLICT (request_id)
     DO UPDATE SET last_reminded_at = EXCLUDED.last_reminded_at`,
    requestId,
    sentAt.toISOString()
  )
}
