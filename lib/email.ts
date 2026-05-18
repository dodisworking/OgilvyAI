import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || GMAIL_USER
const TIM_EMAIL = process.env.TIM_EMAIL || 'tim.legallo@ogilvy.com'
const ISAAC_NOTIFICATION_EMAIL = process.env.ISAAC_EMAIL || 'isaac.boruchowicz@ogilvy.com'
const EMAIL_DEDUPE_WINDOW_MS = 60 * 1000
const recentEmailSends = new Map<string, number>()

const shouldSkipDuplicateEmail = (key: string) => {
  const now = Date.now()
  const lastSentAt = recentEmailSends.get(key)
  if (lastSentAt && now - lastSentAt < EMAIL_DEDUPE_WINDOW_MS) {
    return true
  }
  recentEmailSends.set(key, now)
  return false
}

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
})

export interface RequestNotificationData {
  employeeName: string
  employeeEmail: string
  startDate: Date
  endDate: Date
  requestType: string
  title?: string
  reason?: string
  requestId?: string
  baseUrl?: string
}

export async function sendRequestNotificationToAdmin(data: RequestNotificationData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured - GMAIL_USER or GMAIL_APP_PASSWORD missing')
    throw new Error('Gmail credentials not configured')
  }
  
  if (!ADMIN_EMAIL) {
    console.error('ADMIN_EMAIL is not set - cannot send notification')
    throw new Error('ADMIN_EMAIL is not configured')
  }

  const requestTypeText = data.requestType === 'WFH' ? 'Work From Home' : 
                          data.requestType === 'TIME_OFF' ? 'Time Off' : 
                          'Work From Home & Time Off'

  // Get base URL from env or use default
  const baseUrl = data.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const adminDashboardUrl = `${baseUrl}/admin`

  const dateRange = data.startDate.toLocaleDateString() === data.endDate.toLocaleDateString()
    ? data.startDate.toLocaleDateString()
    : `${data.startDate.toLocaleDateString()} - ${data.endDate.toLocaleDateString()}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; margin-bottom: 20px;">New Time Off/WFH Request</h2>
      <p style="font-size: 16px; margin-bottom: 20px;">
        <strong>${data.employeeName}</strong> (${data.employeeEmail}) submitted a <strong>${requestTypeText}</strong> request.
      </p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Dates:</strong> ${dateRange}</p>
        ${data.title ? `<p style="margin: 5px 0;"><strong>Title:</strong> ${data.title}</p>` : ''}
        ${data.reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${data.reason}</p>` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${adminDashboardUrl}" 
           style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); 
                  color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          Click here to Accept or Reject
        </a>
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        Or visit the admin dashboard: <a href="${adminDashboardUrl}" style="color: #9333ea;">${adminDashboardUrl}</a>
      </p>
    </div>
  `

  try {
    const result = await transporter.sendMail({
      from: GMAIL_USER,
      to: ADMIN_EMAIL,
      subject: `Time off submission from ${data.employeeName}`,
      html,
    })
    console.log(`✅ Email notification successfully sent to ${ADMIN_EMAIL} for request from ${data.employeeName}`)
    return result
  } catch (error: any) {
    console.error('❌ Error sending email:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response,
    })
    throw error
  }
}

export interface RequestSubmissionNotificationData extends RequestNotificationData {}

const toDateOnlyString = (date: Date) => {
  return new Date(date).toLocaleDateString()
}

const getInclusiveDayCount = (startDate: Date, endDate: Date) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays + 1)
}

export async function sendRequestSubmissionNotifications(data: RequestSubmissionNotificationData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured - GMAIL_USER or GMAIL_APP_PASSWORD missing')
    throw new Error('Gmail credentials not configured')
  }

  const requestTypeText = data.requestType === 'WFH'
    ? 'Work From Home'
    : data.requestType === 'TIME_OFF'
      ? 'Time Off'
      : 'Work From Home & Time Off'

  const dateRange = toDateOnlyString(data.startDate) === toDateOnlyString(data.endDate)
    ? toDateOnlyString(data.startDate)
    : `${toDateOnlyString(data.startDate)} - ${toDateOnlyString(data.endDate)}`
  const dayCount = getInclusiveDayCount(data.startDate, data.endDate)
  const daysText = `${dayCount} day${dayCount === 1 ? '' : 's'}`
  const threadTag = data.requestId ? `[Request ${data.requestId}]` : '[Request]'
  if (data.requestId && shouldSkipDuplicateEmail(`submission:${data.requestId}`)) {
    console.log(`⚠️ Skipping duplicate submission emails for request ${data.requestId}`)
    return
  }

  const baseUrl = data.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const adminDashboardUrl = `${baseUrl}/admin`

  const employeeHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; margin-bottom: 16px;">Request Submitted</h2>
      <p>Hi ${data.employeeName},</p>
      <p>Your <strong>${requestTypeText}</strong> request was submitted successfully and is now <strong>waiting on Tim&apos;s approval</strong>.</p>
      <div style="background-color: #f9f9f9; padding: 14px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Dates:</strong> ${dateRange}</p>
        <p style="margin: 4px 0;"><strong>Duration:</strong> ${daysText}</p>
        ${data.title ? `<p style="margin: 4px 0;"><strong>Title:</strong> ${data.title}</p>` : ''}
        ${data.reason ? `<p style="margin: 4px 0;"><strong>Reason:</strong> ${data.reason}</p>` : ''}
      </div>
      <p style="color: #666; font-size: 14px;">You will receive another email once Tim approves or rejects this request.</p>
    </div>
  `

  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; margin-bottom: 20px;">New Time Off/WFH Request</h2>
      <p style="font-size: 16px; margin-bottom: 20px;">
        <strong>${data.employeeName}</strong> (${data.employeeEmail}) submitted a <strong>${requestTypeText}</strong> request for <strong>${daysText}</strong>.
      </p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Dates:</strong> ${dateRange}</p>
        <p style="margin: 5px 0;"><strong>Duration:</strong> ${daysText}</p>
        ${data.title ? `<p style="margin: 5px 0;"><strong>Title:</strong> ${data.title}</p>` : ''}
        ${data.reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${data.reason}</p>` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${adminDashboardUrl}" 
           style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); 
                  color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          Review Request
        </a>
      </div>
    </div>
  `

  const employeeEmailResult = await transporter.sendMail({
      from: GMAIL_USER,
      to: data.employeeEmail,
      subject: `Time off submission confirmation`,
      html: employeeHtml,
      headers: data.requestId
        ? {
            'X-Request-ID': data.requestId,
            'X-Thread-Key': `request-${data.requestId}`,
          }
        : undefined,
    })

  const timThreadResult = await transporter.sendMail({
      from: GMAIL_USER,
      to: 'tim.legallo@ogilvy.com',
      cc: 'isaac.boruchowicz@ogilvy.com',
      subject: `Time off submission from ${data.employeeName}`,
      html: adminHtml,
      headers: data.requestId
        ? {
            'X-Request-ID': data.requestId,
            'X-Thread-Key': `request-${data.requestId}`,
          }
        : undefined,
    })

  console.log('✅ Submission emails sent', {
    requestId: data.requestId,
    employeeEmail: data.employeeEmail,
    timThreadTo: 'tim.legallo@ogilvy.com',
    timThreadCc: 'isaac.boruchowicz@ogilvy.com',
    employeeAccepted: employeeEmailResult.accepted,
    timThreadAccepted: timThreadResult.accepted,
  })
}

export interface RequestDecisionData {
  requestId?: string
  employeeName: string
  employeeEmail: string
  startDate: Date
  endDate: Date
  requestType: string
  status: 'APPROVED' | 'REJECTED'
  adminNotes?: string
  approvedByName?: string
  approvedByEmail?: string
}

export interface PendingApprovalReminderData {
  employeeName: string
  employeeEmail: string
  requestId: string
  requestType: string
  startDate: Date
  endDate: Date
  createdAt: Date
  baseUrl?: string
}

export interface PendingRequestReportRow {
  employeeName: string
  employeeEmail: string
  requestId: string
  requestType: string
  startDate: Date
  endDate: Date
  createdAt: Date
  title?: string | null
  reason?: string | null
  /** Per-day map: yyyy-mm-dd -> 'TIME_OFF' | 'WFH'. Lets us show the split. */
  dayBreakdown?: Record<string, string> | null
}

export async function sendRequestDecisionToEmployee(data: RequestDecisionData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured')
    return
  }

  const requestTypeText = data.requestType === 'WFH' ? 'Work From Home' : 
                          data.requestType === 'TIME_OFF' ? 'Time Off' : 
                          'Work From Home & Time Off'

  const statusColor = data.status === 'APPROVED' ? '#28a745' : '#dc3545'
  const statusText = data.status === 'APPROVED' ? 'Approved' : 'Rejected'
  const dateRange = data.startDate.toLocaleDateString() === data.endDate.toLocaleDateString()
    ? data.startDate.toLocaleDateString()
    : `${data.startDate.toLocaleDateString()} - ${data.endDate.toLocaleDateString()}`
  const approvedByName = data.approvedByName || 'Tim Legallo'
  const approvedByEmail = data.approvedByEmail || TIM_EMAIL
  const threadTag = data.requestId ? `[Request ${data.requestId}]` : '[Request]'
  if (data.requestId && shouldSkipDuplicateEmail(`decision:${data.requestId}:${data.status}`)) {
    console.log(`⚠️ Skipping duplicate decision email for request ${data.requestId} (${data.status})`)
    return
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Request ${statusText}</h2>
      <p>Hi ${data.employeeName},</p>
      <p>Your ${requestTypeText} request has been <strong style="color: ${statusColor};">${statusText.toLowerCase()}</strong> by <strong>${approvedByName}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Request Type:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${requestTypeText}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Start Date:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.startDate.toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>End Date:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.endDate.toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Date Range:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${dateRange}</td>
        </tr>
        ${data.adminNotes ? `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Notes:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.adminNotes}</td>
        </tr>
        ` : ''}
      </table>
      <p>You can view all your requests in your dashboard.</p>
    </div>
  `

  try {
    const ccRecipients = Array.from(
      new Set(
        [TIM_EMAIL, ISAAC_NOTIFICATION_EMAIL, approvedByEmail].filter(
          (email): email is string => Boolean(email) && email !== data.employeeEmail
        )
      )
    )

    await transporter.sendMail({
      from: `"${approvedByName}" <${GMAIL_USER}>`,
      to: data.employeeEmail,
      cc: ccRecipients.length > 0 ? ccRecipients.join(',') : undefined,
      replyTo: approvedByEmail,
      subject: data.status === 'APPROVED' ? 'Time off approved' : 'Time off rejected',
      html,
      headers: data.requestId
        ? {
            'X-Request-ID': data.requestId,
            'X-Thread-Key': `request-${data.requestId}`,
          }
        : undefined,
    })
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

export async function sendPendingApprovalReminderToTim(data: PendingApprovalReminderData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured')
    return
  }

  const requestTypeText = data.requestType === 'WFH'
    ? 'Work From Home'
    : data.requestType === 'TIME_OFF'
      ? 'Time Off'
      : 'Work From Home & Time Off'
  const dateRange = data.startDate.toLocaleDateString() === data.endDate.toLocaleDateString()
    ? data.startDate.toLocaleDateString()
    : `${data.startDate.toLocaleDateString()} - ${data.endDate.toLocaleDateString()}`
  const baseUrl = data.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const approveUrl = `${baseUrl}/admin`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; margin-bottom: 14px;">Friendly Reminder: Pending Request</h2>
      <p>Hey Tim,</p>
      <p>
        This is a reminder that <strong>${data.employeeName}</strong> (${data.employeeEmail}) submitted a
        <strong> ${requestTypeText}</strong> request and it is still pending approval.
      </p>
      <div style="background-color: #f9f9f9; padding: 14px; border-radius: 8px; margin: 18px 0;">
        <p style="margin: 4px 0;"><strong>Submitted:</strong> ${new Date(data.createdAt).toLocaleDateString()}</p>
        <p style="margin: 4px 0;"><strong>Dates:</strong> ${dateRange}</p>
        <p style="margin: 4px 0;"><strong>Request ID:</strong> ${data.requestId}</p>
      </div>
      <div style="text-align: center; margin: 26px 0;">
        <a href="${approveUrl}"
           style="display: inline-block; padding: 12px 22px; background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%);
                  color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Click here to review and approve/reject
        </a>
      </div>
    </div>
  `

  await transporter.sendMail({
    from: GMAIL_USER,
    to: TIM_EMAIL,
    subject: `Tim's reminder: pending request from ${data.employeeName}`,
    html,
  })
}

export async function sendPendingRequestReportToTim(rows: PendingRequestReportRow[], baseUrl?: string) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured')
    return
  }

  if (!rows.length) return

  const appBaseUrl = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const reviewUrl = `${appBaseUrl}/admin`

  const dateOnly = (d: Date | string) => new Date(d).toLocaleDateString()
  const inclusiveDayCount = (start: Date, end: Date) => {
    const a = new Date(start); a.setHours(0, 0, 0, 0)
    const b = new Date(end); b.setHours(0, 0, 0, 0)
    const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, diff + 1)
  }

  // Pull TIME_OFF/WFH counts from the per-day breakdown if we have one;
  // otherwise fall back to whole-range counts based on the request type.
  const splitFor = (row: PendingRequestReportRow) => {
    const breakdown = row.dayBreakdown && typeof row.dayBreakdown === 'object'
      ? row.dayBreakdown
      : null

    if (breakdown && Object.keys(breakdown).length > 0) {
      let timeOff = 0
      let wfh = 0
      for (const v of Object.values(breakdown)) {
        if (v === 'TIME_OFF') timeOff++
        else if (v === 'WFH') wfh++
      }
      return { timeOff, wfh }
    }

    const total = inclusiveDayCount(row.startDate, row.endDate)
    if (row.requestType === 'WFH') return { timeOff: 0, wfh: total }
    if (row.requestType === 'TIME_OFF') return { timeOff: total, wfh: 0 }
    // BOTH but no breakdown — best effort: call them all time off so the prompt
    // pushes Tim toward the headline category.
    return { timeOff: total, wfh: 0 }
  }

  const cardsHtml = rows
    .map((row) => {
      const { timeOff, wfh } = splitFor(row)
      const sameDay = dateOnly(row.startDate) === dateOnly(row.endDate)
      const dateRange = sameDay ? dateOnly(row.startDate) : `${dateOnly(row.startDate)} – ${dateOnly(row.endDate)}`
      const submittedAgo = (() => {
        const days = Math.floor((Date.now() - new Date(row.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        if (days <= 0) return 'today'
        if (days === 1) return '1 day ago'
        return `${days} days ago`
      })()

      // Time off is the headline; WFH is a small subline so Tim's eye lands on
      // the day(s) that actually need coverage planning.
      const timeOffLabel = timeOff > 0
        ? `<span style="display:inline-block; padding: 4px 10px; background: linear-gradient(135deg,#ef4444,#ec4899); color:white; border-radius:999px; font-weight:700; font-size:13px;">${timeOff} day${timeOff === 1 ? '' : 's'} time off</span>`
        : `<span style="display:inline-block; padding: 4px 10px; background:#f3f4f6; color:#6b7280; border-radius:999px; font-weight:600; font-size:13px;">No time off — WFH only</span>`

      const wfhSub = wfh > 0
        ? `<div style="font-size:11px; color:#6b7280; margin-top:6px;">+ ${wfh} day${wfh === 1 ? '' : 's'} working from home</div>`
        : ''

      const titleLine = row.title
        ? `<p style="margin:6px 0 0 0; font-size:13px; color:#374151;"><em>${escapeHtml(row.title)}</em></p>`
        : ''

      return `
        <div style="border:1px solid #e5e7eb; border-radius:14px; padding:16px; margin:14px 0; background:white; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <p style="margin:0; font-weight:700; color:#111827; font-size:15px;">${escapeHtml(row.employeeName)}</p>
              <p style="margin:2px 0 0 0; font-size:12px; color:#6b7280;">${escapeHtml(row.employeeEmail)}</p>
            </div>
            <div style="text-align:right; flex-shrink:0;">${timeOffLabel}${wfhSub}</div>
          </div>
          <div style="margin-top:10px; padding:10px 12px; background:#fafafa; border-radius:10px;">
            <p style="margin:0; font-size:13px; color:#111827;"><strong>📅 ${dateRange}</strong></p>
            ${titleLine}
            <p style="margin:6px 0 0 0; font-size:11px; color:#9ca3af;">Submitted ${submittedAgo}</p>
          </div>
        </div>
      `
    })
    .join('')

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background:#f9fafb;">
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%); padding: 18px 20px; border-radius: 14px 14px 0 0; color: white;">
        <p style="margin:0; font-size:13px; opacity:0.9;">🥷 Aisaac assistant</p>
        <h2 style="margin:4px 0 0 0; font-size:22px;">Hey Tim — heads up</h2>
      </div>

      <div style="background: white; padding: 20px; border-radius: 0 0 14px 14px; border:1px solid #e5e7eb; border-top:none;">
        <p style="margin:0 0 10px 0; color:#374151;">
          Hi Tim, how are you doing? This is your handy-dandy <strong>Aisaac agent</strong>, just here to remind you that
          <strong>${rows.length} ${rows.length === 1 ? 'person has' : 'people have'}</strong> submitted time-off requests
          that are still waiting on your approval (or rejection).
        </p>

        ${cardsHtml}

        <div style="text-align: center; margin: 24px 0 8px;">
          <a href="${reviewUrl}"
             style="display: inline-block; padding: 14px 26px; background: linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%);
                    color: white; text-decoration: none; border-radius: 10px; font-weight: 700; font-size:15px; box-shadow: 0 4px 10px rgba(147,51,234,0.25);">
            Click here to approve or reject →
          </a>
        </div>

        <p style="margin:18px 0 0; font-size:11px; color:#9ca3af; text-align:center;">
          You'll get this nudge every few days while requests sit unactioned. It's been at least 3 days for at least one of these.
        </p>
      </div>
    </div>
  `

  const subject = rows.length === 1
    ? `🥷 Aisaac: ${rows[0].employeeName} is still waiting on your approval`
    : `🥷 Aisaac: ${rows.length} time-off requests waiting on you`

  await transporter.sendMail({
    from: `"Aisaac assistant" <${GMAIL_USER}>`,
    to: TIM_EMAIL,
    subject,
    html,
  })
}

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export async function sendRequestDecisionNotificationToTim(data: RequestDecisionData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured')
    return
  }

  if (!TIM_EMAIL) {
    console.error('TIM_EMAIL is not configured')
    return
  }

  const requestTypeText = data.requestType === 'WFH'
    ? 'Work From Home'
    : data.requestType === 'TIME_OFF'
      ? 'Time Off'
      : 'Work From Home & Time Off'
  const statusText = data.status === 'APPROVED' ? 'approved' : 'rejected'
  const dateRange = data.startDate.toLocaleDateString() === data.endDate.toLocaleDateString()
    ? data.startDate.toLocaleDateString()
    : `${data.startDate.toLocaleDateString()} - ${data.endDate.toLocaleDateString()}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Request Decision Logged</h2>
      <p><strong>${data.employeeName}</strong> (${data.employeeEmail}) was <strong>${statusText}</strong> for:</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 5px 0;"><strong>Type:</strong> ${requestTypeText}</p>
        <p style="margin: 5px 0;"><strong>Dates:</strong> ${dateRange}</p>
        ${data.adminNotes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${data.adminNotes}</p>` : ''}
      </div>
    </div>
  `

  try {
    await transporter.sendMail({
      from: GMAIL_USER,
      to: TIM_EMAIL,
      subject: data.status === 'APPROVED'
        ? `Time off approved: ${data.employeeName}`
        : `Time off rejected: ${data.employeeName}`,
      html,
    })
  } catch (error) {
    console.error('Error sending decision notification to Tim:', error)
    throw error
  }
}

export interface PasswordResetCodeEmailData {
  toName: string
  toEmail: string
  code: string
  expiresInMinutes: number
}

export async function sendPasswordResetCodeEmail(data: PasswordResetCodeEmailData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured - cannot send reset code')
    throw new Error('Email service not configured')
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #333; margin-bottom: 12px;">Your password reset code</h2>
      <p>Hi ${data.toName || 'there'},</p>
      <p>Use the code below to reset your TimTheMan password. It expires in <strong>${data.expiresInMinutes} minutes</strong>.</p>
      <div style="margin: 24px 0; padding: 16px 20px; background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); border-radius: 12px; text-align: center;">
        <div style="font-family: 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 36px; letter-spacing: 8px; color: white; font-weight: bold;">
          ${data.code}
        </div>
      </div>
      <p style="color: #666; font-size: 13px;">If you didn't ask to reset your password, you can safely ignore this email — your current password still works.</p>
    </div>
  `

  await transporter.sendMail({
    from: `"Tim's Production Wizard" <${GMAIL_USER}>`,
    to: data.toEmail,
    subject: `Your TimTheMan password reset code: ${data.code}`,
    html,
  })
}

// ----- Calendar invite (.ics) helpers -----

const pad = (n: number) => n.toString().padStart(2, '0')

const formatIcsDate = (date: Date) => {
  // Local-date format YYYYMMDD (used with VALUE=DATE for all-day events)
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

const formatIcsUtcStamp = (date: Date) => {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

const escapeIcsText = (text: string) => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export interface IcsRange {
  startDate: Date // inclusive
  endDate: Date // inclusive
  type: 'TIME_OFF' | 'WFH'
}

interface BuildIcsOptions {
  organizerName: string
  organizerEmail: string
  attendees: Array<{ name?: string; email: string }>
  ranges: IcsRange[]
  subjectPersonName: string
  uidSeed: string
  method?: 'REQUEST' | 'CANCEL'
  sequence?: number
}

const stableUidFor = (uidSeed: string, attendeeEmail: string, rangeIndex: number) =>
  `timtheman-${uidSeed}-${attendeeEmail.toLowerCase()}-r${rangeIndex}@timtheman`

export function buildIcsCalendarInvite({
  organizerName,
  organizerEmail,
  attendees,
  ranges,
  subjectPersonName,
  uidSeed,
  method = 'REQUEST',
  sequence = 0,
}: BuildIcsOptions) {
  const dtstamp = formatIcsUtcStamp(new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tim The Man//Time Off Calendar//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
  ]

  ranges.forEach((range, idx) => {
    const summary =
      range.type === 'TIME_OFF'
        ? `${subjectPersonName} Time Off`
        : `${subjectPersonName} Work Remote`

    // DTEND for VALUE=DATE is exclusive — add one day to the inclusive end date.
    const inclusiveEnd = new Date(range.endDate)
    inclusiveEnd.setHours(0, 0, 0, 0)
    const exclusiveEnd = new Date(inclusiveEnd)
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1)

    const start = new Date(range.startDate)
    start.setHours(0, 0, 0, 0)

    // Stable UID per (request, attendee, range index). Same UID across edits
    // so a follow-up CANCEL or REQUEST with bumped SEQUENCE actually targets
    // the existing event in Outlook.
    const primaryAttendee = attendees[0]?.email || 'noattendee'
    const uid = stableUidFor(uidSeed, primaryAttendee, idx)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`CREATED:${dtstamp}`)
    lines.push(`LAST-MODIFIED:${dtstamp}`)
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(start)}`)
    lines.push(`DTEND;VALUE=DATE:${formatIcsDate(exclusiveEnd)}`)
    lines.push(`SUMMARY:${escapeIcsText(summary)}`)
    lines.push('TRANSP:TRANSPARENT') // appears as Free
    lines.push('X-MICROSOFT-CDO-BUSYSTATUS:FREE')
    lines.push('X-MICROSOFT-CDO-INTENDEDSTATUS:FREE')
    lines.push('X-MICROSOFT-CDO-ALLDAYEVENT:TRUE')
    lines.push('X-MICROSOFT-CDO-IMPORTANCE:1')
    lines.push(method === 'CANCEL' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED')
    lines.push('CLASS:PUBLIC')
    lines.push(`SEQUENCE:${sequence}`)
    lines.push(
      `ORGANIZER;CN=${escapeIcsText(organizerName)}:mailto:${organizerEmail}`
    )
    attendees.forEach((a) => {
      const cn = a.name ? `;CN=${escapeIcsText(a.name)}` : ''
      lines.push(
        `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE${cn}:mailto:${a.email}`
      )
    })
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')

  // RFC5545 wants CRLF line endings
  return lines.join('\r\n')
}

export interface NotifyEmailEntry {
  name?: string
  email: string
}

export interface SendApprovedTimeOffInviteData {
  requestId: string
  employeeName: string
  employeeEmail: string
  ranges: IcsRange[]
  notifyEmails: NotifyEmailEntry[]
  approvedByName?: string
  approvedByEmail?: string
  sequence?: number
  method?: 'REQUEST' | 'CANCEL'
}

export async function sendApprovedTimeOffCalendarInvite(
  data: SendApprovedTimeOffInviteData
) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured - cannot send calendar invite')
    return
  }
  if (!data.ranges.length) return
  if (!data.notifyEmails.length) return

  const organizerEmail = GMAIL_USER
  const organizerName = data.employeeName

  // Dedupe attendees (case-insensitive on email)
  const seen = new Set<string>()
  const attendees = data.notifyEmails
    .map((a) => ({ name: a.name, email: a.email.trim() }))
    .filter((a) => {
      if (!a.email) return false
      const key = a.email.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  if (!attendees.length) return

  const rangeSummary = data.ranges
    .map((r) => {
      const sameDay = r.startDate.toDateString() === r.endDate.toDateString()
      const label = r.type === 'TIME_OFF' ? 'Time Off' : 'Work Remote'
      return sameDay
        ? `${label}: ${r.startDate.toLocaleDateString()}`
        : `${label}: ${r.startDate.toLocaleDateString()} – ${r.endDate.toLocaleDateString()}`
    })
    .join('<br/>')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; margin-bottom: 14px;">Heads up — ${data.employeeName} is out</h2>
      <p>Hi,</p>
      <p>
        <strong>${data.employeeName}</strong> has had time off approved by ${data.approvedByName || 'Tim'}.
        A calendar invite is attached so you have it on your calendar (it will appear as <strong>Free</strong>, not Busy).
      </p>
      <div style="background:#f9f9f9; padding:14px; border-radius:8px; margin:16px 0;">
        ${rangeSummary}
      </div>
      <p style="color:#666; font-size:13px;">You don't need to do anything — this is just so you know.</p>
    </div>
  `

  // One invite-style email per attendee with a personal ICS — addresses only
  // them as the ATTENDEE, which is what Outlook expects for an inline invite.
  const subject = `${data.employeeName} — Time off`

  const method = data.method ?? 'REQUEST'
  const sequence = data.sequence ?? 0

  const sendPromises = attendees.map(async (a) => {
    try {
      const ics = buildIcsCalendarInvite({
        organizerName,
        organizerEmail,
        attendees: [a],
        ranges: data.ranges,
        subjectPersonName: data.employeeName,
        uidSeed: data.requestId,
        method,
        sequence,
      })

      const cancelSubject = `Cancelled: ${subject}`
      const cancelHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Plans changed — cancelling these days</h2>
          <p>${data.employeeName}'s previously scheduled time off has been replaced. Outlook should remove the old event from your calendar automatically. A fresh invite for the new dates will follow.</p>
          <div style="background:#f9f9f9; padding:14px; border-radius:8px; margin:16px 0;">${rangeSummary}</div>
        </div>
      `

      await transporter.sendMail({
        from: `"${organizerName}" <${GMAIL_USER}>`,
        to: a.email,
        subject: method === 'CANCEL' ? cancelSubject : subject,
        html: method === 'CANCEL' ? cancelHtml : html,
        alternatives: [
          {
            contentType: `text/calendar; charset="UTF-8"; method=${method}`,
            content: ics,
            contentTransferEncoding: '7bit',
          },
        ],
        attachments: [
          {
            filename: method === 'CANCEL' ? 'cancel.ics' : 'invite.ics',
            content: ics,
            contentType: `application/ics; name="${method === 'CANCEL' ? 'cancel' : 'invite'}.ics"`,
            contentDisposition: 'attachment',
          },
        ],
        headers: {
          'Content-Class': 'urn:content-classes:calendarmessage',
        },
      } as any)
      return { email: a.email, success: true }
    } catch (error: any) {
      console.error(`Failed to send calendar invite to ${a.email}:`, error)
      return { email: a.email, success: false, error: error.message }
    }
  })

  const results = await Promise.all(sendPromises)
  console.log('Calendar invites sent', { requestId: data.requestId, results })
  return results
}

export interface DrowningNotificationData {
  drowningUserName: string
  drowningUserEmail: string
  startDate: Date
  endDate: Date
  natureOfNeed?: string
  usersToNotify: Array<{ id: string; name: string; email: string }>
  baseUrl?: string
}

export async function sendDrowningNotificationToUsers(data: DrowningNotificationData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured')
    throw new Error('Gmail credentials not configured')
  }

  const dateRange = data.startDate.toLocaleDateString() === data.endDate.toLocaleDateString()
    ? data.startDate.toLocaleDateString()
    : `${data.startDate.toLocaleDateString()} - ${data.endDate.toLocaleDateString()}`

  const baseUrl = data.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const dashboardUrl = `${baseUrl}/dashboard`

  // Send email to each user
  const emailPromises = data.usersToNotify.map(async (user) => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="font-size: 64px; margin: 0;">🆘</h1>
        </div>
        <h2 style="color: #1e90ff; margin-bottom: 20px; text-align: center; font-size: 28px;">
          🚨 RESCUE MISSION ALERT! 🚨
        </h2>
        <p style="font-size: 18px; margin-bottom: 20px; text-align: center;">
          Hi <strong>${user.name}</strong>! 👋
        </p>
        <p style="font-size: 18px; margin-bottom: 20px; line-height: 1.6; background: #f0f8ff; padding: 20px; border-radius: 12px; border-left: 4px solid #1e90ff;">
          <strong>${data.drowningUserName}</strong> is drowning right now in some work and is in <strong>desperate need of a rescue</strong>! 🌊🆘
        </p>
        <p style="font-size: 16px; margin-bottom: 25px; text-align: center; color: #333;">
          Are you up for the <strong>super task</strong>? 💪
        </p>
        
        <div style="background: linear-gradient(135deg, #87ceeb 0%, #4682b4 100%); padding: 25px; border-radius: 12px; margin: 25px 0; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="margin: 8px 0; font-size: 16px;"><strong>📅 They need help during these days:</strong> ${dateRange}</p>
          ${data.natureOfNeed ? `<p style="margin: 8px 0; font-size: 16px; margin-top: 15px;"><strong>💬 They say it&apos;s this that they need:</strong><br/>${data.natureOfNeed}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 35px 0;">
          <a href="${dashboardUrl}" 
             style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); 
                    color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 18px;
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15); transition: transform 0.2s;">
            🚑 Click Here to Accept This Mission
          </a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 25px; text-align: center; font-style: italic;">
          Time to be a hero! The department needs you! 🦸‍♂️🦸‍♀️
        </p>
      </div>
    `

    try {
      await transporter.sendMail({
        from: GMAIL_USER,
        to: user.email,
        subject: `🆘 RESCUE MISSION: ${data.drowningUserName} is drowning in work! Are you up for the task?`,
        html,
      })
      return { success: true, email: user.email }
    } catch (error: any) {
      console.error(`Failed to send email to ${user.email}:`, error)
      return { success: false, email: user.email, error: error.message }
    }
  })

  const results = await Promise.all(emailPromises)
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  console.log(`Drowning notifications sent: ${successful} successful, ${failed} failed`)

  return {
    successful,
    failed,
    results,
  }
}

export interface RescueAcceptedData {
  drowningUserName: string
  drowningUserEmail: string
  rescuerName: string
  rescuerEmail: string
  startDate: Date
  endDate: Date
  natureOfNeed?: string
  baseUrl?: string
}

export async function sendRescueAcceptedNotification(data: RescueAcceptedData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured')
    throw new Error('Gmail credentials not configured')
  }

  const dateRange = data.startDate.toLocaleDateString() === data.endDate.toLocaleDateString()
    ? data.startDate.toLocaleDateString()
    : `${data.startDate.toLocaleDateString()} - ${data.endDate.toLocaleDateString()}`

  const baseUrl = data.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const dashboardUrl = `${baseUrl}/dashboard`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-size: 64px; margin: 0;">🚑</h1>
      </div>
      <h2 style="color: #10b981; margin-bottom: 20px; text-align: center; font-size: 28px;">
        🎉 RESCUE MISSION ACCEPTED! 🎉
      </h2>
      <p style="font-size: 18px; margin-bottom: 20px; text-align: center;">
        Hi <strong>${data.drowningUserName}</strong>! 👋
      </p>
      <p style="font-size: 18px; margin-bottom: 20px; line-height: 1.6; background: #d1fae5; padding: 20px; border-radius: 12px; border-left: 4px solid #10b981;">
        Great news! <strong>${data.rescuerName}</strong> is coming to the rescue! 🦸‍♂️🦸‍♀️
      </p>
      
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px; border-radius: 12px; margin: 25px 0; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="margin: 8px 0; font-size: 16px;"><strong>👤 Your Rescuer:</strong> ${data.rescuerName}</p>
        <p style="margin: 8px 0; font-size: 16px;"><strong>📧 Contact:</strong> ${data.rescuerEmail}</p>
        <p style="margin: 8px 0; font-size: 16px; margin-top: 15px;"><strong>📅 Help During:</strong> ${dateRange}</p>
        ${data.natureOfNeed ? `<p style="margin: 8px 0; font-size: 16px; margin-top: 15px;"><strong>💬 What You Need:</strong><br/>${data.natureOfNeed}</p>` : ''}
      </div>

      <div style="text-align: center; margin: 35px 0;">
        <a href="${dashboardUrl}" 
           style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                  color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 18px;
                  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15); transition: transform 0.2s;">
          🚑 View in Dashboard
        </a>
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 25px; text-align: center; font-style: italic;">
        Your hero is on the way! Time to celebrate! 🎊
      </p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: GMAIL_USER,
      to: data.drowningUserEmail,
      subject: `🚑 ${data.rescuerName} is coming to your rescue!`,
      html,
    })
    console.log(`✅ Rescue acceptance notification sent to ${data.drowningUserEmail}`)
  } catch (error: any) {
    console.error('Error sending rescue acceptance email:', error)
    throw error
  }
}