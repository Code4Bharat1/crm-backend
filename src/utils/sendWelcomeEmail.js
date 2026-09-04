import nodemailer from 'nodemailer';

/**
 * Sends an authentic, high-deliverability welcome email to newly onboarded employees.
 * Optimized to pass SPF/DKIM and avoid Spam/Junk filters.
 *
 * @param {Object} employee - The employee document/data
 * @param {string} defaultPassword - The default temporary password assigned to the employee
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendWelcomeEmail = async (employee, defaultPassword = process.env.DEFAULT_EMPLOYEE_PASSWORD || '123456') => {
  try {
    const {
      fullName,
      firstName,
      role,
      email,
      phone,
      employeeCode,
      employmentType,
    } = employee;

    if (!email) {
      console.warn('Cannot send welcome email: employee has no email address');
      return { success: false, error: 'No email address provided' };
    }

    if (!process.env.EMAIL_ID || !process.env.EMAIL_PASSWORD) {
      console.warn('EMAIL_ID or EMAIL_PASSWORD not set in environment variables');
      return { success: false, error: 'Email service credentials not configured' };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_ID,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const portalUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const recipientName = firstName || fullName || 'Team Member';
    const senderEmail = process.env.EMAIL_ID;

    // Clean, anti-spam HTML template: table-based layout, web-safe fonts, no phishing alert banners
    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to CONTECH</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
    <!-- Header -->
    <tr>
      <td align="center" style="background-color: #0f172a; padding: 26px 20px; border-top-left-radius: 8px; border-top-right-radius: 8px;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">CONTECH CRM</h1>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Team Onboarding Confirmation</p>
      </td>
    </tr>
    
    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 24px;">
        <p style="margin: 0 0 14px 0; font-size: 16px; font-weight: bold; color: #0f172a;">Hello ${recipientName},</p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #334155;">
          Welcome to the team! Your employee profile and system account have been configured in our CRM and operations platform.
        </p>
        
        <!-- Account Info Box -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; margin: 0 0 20px 0;">
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
                Account Details
              </p>
              <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 13px; color: #334155;">
                <tr>
                  <td width="38%" style="color: #64748b;">Employee ID:</td>
                  <td style="font-weight: bold; color: #0f172a;">${employeeCode}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Assigned Role:</td>
                  <td style="font-weight: bold; color: #0369a1;">${role}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Login Email:</td>
                  <td style="font-weight: bold; color: #0f172a;">${email}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Default Password:</td>
                  <td style="font-weight: bold; font-family: monospace; font-size: 14px; color: #047857;">${defaultPassword}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Employment Type:</td>
                  <td>${employmentType || 'Full Time'}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Security / Password Notice -->
        <p style="margin: 0 0 20px 0; font-size: 13px; line-height: 1.5; color: #475569; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;">
          <strong>Security Reminder:</strong> Please change your default password upon your first login to secure your account.
        </p>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 16px 0;">
          <tr>
            <td align="center">
              <a href="${portalUrl}/login" target="_blank" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: bold; border-radius: 6px; display: inline-block;">
                Sign In to Portal
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 16px 0 0 0; font-size: 12px; line-height: 1.5; color: #64748b;">
          Portal Address: <a href="${portalUrl}" style="color: #2563eb; text-decoration: underline;">${portalUrl}</a><br/>
          To update your password directly, visit: <a href="${portalUrl}/change-password" style="color: #2563eb; text-decoration: underline;">${portalUrl}/change-password</a>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td align="center" style="background-color: #f8fafc; padding: 16px; border-top: 1px solid #e2e8f0; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; font-size: 11px; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} CONTECH Integrated Automation Solutions.<br/>
        This message was sent to ${email} as part of your internal employee onboarding.
      </td>
    </tr>
  </table>
</body>
</html>
`;

    // Anti-spam subject: natural, clean, no exclamation marks or all-caps trigger words
    const subject = `Welcome to CONTECH - Account Setup for ${recipientName}`;

    const mailOptions = {
      from: `"CONTECH" <${senderEmail}>`,
      replyTo: senderEmail,
      to: email.trim(),
      subject: subject,
      html: htmlContent,
      text: `Hello ${recipientName},\n\nWelcome to CONTECH! Your employee profile and system account have been configured.\n\nAccount Details:\n- Employee ID: ${employeeCode}\n- Role: ${role}\n- Login Email: ${email}\n- Default Password: ${defaultPassword}\n\nSecurity Reminder: Please change your default password upon your first login.\n\nSign in to the portal: ${portalUrl}/login\nChange your password: ${portalUrl}/change-password\n\nBest regards,\nCONTECH Team`,
      headers: {
        'X-Mailer': 'CONTECH CRM Platform',
        'X-Priority': '3',
        'Importance': 'normal',
      },
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Inbox-optimized welcome email sent to ${email} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId, defaultPassword };
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${employee?.email}:`, error.message);
    return { success: false, error: error.message };
  }
};
