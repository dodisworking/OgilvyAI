import { NextResponse } from 'next/server'
import { sendRequestNotificationToAdmin } from '@/lib/email'

// Test endpoint to check email configuration and send a test email
export async function GET() {
  const GMAIL_USER = process.env.GMAIL_USER
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL

  const config = {
    gmail_user_set: !!GMAIL_USER,
    gmail_user: GMAIL_USER || 'NOT SET',
    app_password_set: !!GMAIL_APP_PASSWORD,
    admin_email: ADMIN_EMAIL || 'NOT SET',
  }

  return NextResponse.json({
    message: 'Email configuration status',
    config,
    note: 'Visit /api/test-email/send to send a test email',
  })
}

export async function POST() {
  try {
    // Send a test email
    await sendRequestNotificationToAdmin({
      employeeName: 'Test User',
      employeeEmail: 'test@example.com',
      startDate: new Date(),
      endDate: new Date(),
      requestType: 'TIME_OFF',
      title: 'Test Request',
      reason: 'This is a test email to verify the email system is working.',
    })

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully!',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send test email',
        details: error,
      },
      { status: 500 }
    )
  }
}
