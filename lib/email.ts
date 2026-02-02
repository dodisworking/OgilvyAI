import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || GMAIL_USER

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
      subject: `${data.employeeName} submitted ${requestTypeText} - ${dateRange}`,
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

export interface RequestDecisionData {
  employeeName: string
  employeeEmail: string
  startDate: Date
  endDate: Date
  requestType: string
  status: 'APPROVED' | 'REJECTED'
  adminNotes?: string
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

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Request ${statusText}</h2>
      <p>Hi ${data.employeeName},</p>
      <p>Your ${requestTypeText} request has been <strong style="color: ${statusColor};">${statusText.toLowerCase()}</strong>.</p>
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
    await transporter.sendMail({
      from: GMAIL_USER,
      to: data.employeeEmail,
      subject: `Your ${requestTypeText} Request has been ${statusText}`,
      html,
    })
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
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