import nodemailer from 'nodemailer';

/**
 * Sends an authentic, high-deliverability profile update notification to the employee.
 * Optimized to pass SPF/DKIM and avoid Spam/Junk filters.
 *
 * @param {Object} employee - The updated employee document/data
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendEmployeeUpdateEmail = async (employee) => {
  try {
    const {
      fullName,
      firstName,
      role,
      email,
      phone,
      employeeCode,
      status,
      employmentType,
    } = employee;

    if (!email) {
      console.warn('Cannot send update notification: employee has no email address');
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

    // Clean, anti-spam HTML template: table-based layout, web-safe fonts
    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Profile Update Confirmation</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
    <!-- Header -->
    <tr>
      <td align="center" style="background-color: #0f172a; padding: 24px 20px; border-top-left-radius: 8px; border-top-right-radius: 8px;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">CONTECH CRM</h1>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Employee Profile Update Notification</p>
      </td>
    </tr>
    
    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 24px;">
        <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: bold; color: #0f172a;">Hello ${recipientName},</p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #334155;">
          This is a confirmation that your employee profile and role settings have been updated in the CONTECH CRM platform.
        </p>

        <!-- Overview Box -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; margin: 0 0 20px 0;">
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
                Updated Profile Information
              </p>
              <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 13px; color: #334155;">
                <tr>
                  <td width="38%" style="color: #64748b;">Employee ID:</td>
                  <td style="font-weight: bold; color: #0f172a;">${employeeCode}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Full Name:</td>
                  <td style="font-weight: bold; color: #0f172a;">${fullName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Assigned Role:</td>
                  <td style="font-weight: bold; color: #0369a1;">${role}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Work Email:</td>
                  <td style="font-weight: bold; color: #0f172a;">${email}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Phone:</td>
                  <td>${phone || '—'}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Status:</td>
                  <td style="color: #059669; font-weight: bold;">${status || 'Active'}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Employment Type:</td>
                  <td>${employmentType || 'Full Time'}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 16px 0;">
          <tr>
            <td align="center">
              <a href="${portalUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: bold; border-radius: 6px; display: inline-block;">
                Access CRM Portal
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 16px 0 0 0; font-size: 12px; line-height: 1.5; color: #64748b;">
          If you have any questions regarding this change, please contact your human resources administrator.
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td align="center" style="background-color: #f8fafc; padding: 16px; border-top: 1px solid #e2e8f0; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; font-size: 11px; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} CONTECH Integrated Automation Solutions.<br/>
        This confirmation was sent to ${email} as part of your internal account management.
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const subject = `CONTECH Profile Update Confirmation - ${recipientName}`;

    const mailOptions = {
      from: `"CONTECH" <${senderEmail}>`,
      replyTo: senderEmail,
      to: email.trim(),
      subject: subject,
      html: htmlContent,
      text: `Hello ${recipientName},\n\nYour employee profile has been updated in CONTECH CRM.\n\nUpdated Profile Details:\n- Employee ID: ${employeeCode}\n- Full Name: ${fullName}\n- Role: ${role}\n- Email: ${email}\n- Phone: ${phone || '—'}\n- Status: ${status || 'Active'}\n\nAccess CRM Portal: ${portalUrl}\n\nBest regards,\nCONTECH Team`,
      headers: {
        'X-Mailer': 'CONTECH CRM Platform',
        'X-Priority': '3',
        'Importance': 'normal',
      },
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Inbox-optimized update email sent to ${email} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send employee update email to ${employee?.email}:`, error.message);
    return { success: false, error: error.message };
  }
};
