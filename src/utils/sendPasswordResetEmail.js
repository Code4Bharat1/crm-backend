import nodemailer from 'nodemailer';

/**
 * Resolves the frontend URL dynamically from the incoming request or environment settings.
 * Ensures the reset password link directs to the exact origin the user is accessing.
 */
const resolvePortalUrl = (req) => {
  if (req) {
    const origin = req.get('origin');
    if (origin && !origin.includes('undefined')) return origin;
    const referer = req.get('referer');
    if (referer) {
      try {
        const parsed = new URL(referer);
        return parsed.origin;
      } catch (e) {
        // continue to env fallback
      }
    }
  }

  if (process.env.FRONTEND_URL) {
    const urls = process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean);
    // If running in development or localhost requested, favor localhost or first url
    if (urls.length > 0) return urls[0];
  }

  return 'http://localhost:3000';
};

/**
 * Sends a high-deliverability, beautifully styled password reset email.
 * Includes a secure tokenized link with a 60-minute expiration notice.
 *
 * @param {Object} options
 * @param {Object} options.user - User document containing email and name
 * @param {string} options.resetToken - Unhashed random reset token
 * @param {Object} [options.req] - Express request object for origin resolution
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendPasswordResetEmail = async ({ user, resetToken, req }) => {
  try {
    const { email, name } = user;

    if (!email) {
      console.warn('Cannot send password reset email: missing recipient email');
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

    const portalUrl = resolvePortalUrl(req);
    const resetUrl = `${portalUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    const recipientName = name || email.split('@')[0] || 'Valued User';
    const senderEmail = process.env.EMAIL_ID;

    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset Request - CONTECH CRM</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
    <!-- Header -->
    <tr>
      <td align="center" style="background-color: #0f172a; padding: 26px 20px; border-top-left-radius: 8px; border-top-right-radius: 8px;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">CONTECH CRM</h1>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Security &amp; Account Recovery</p>
      </td>
    </tr>
    
    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 24px;">
        <p style="margin: 0 0 14px 0; font-size: 16px; font-weight: bold; color: #0f172a;">Hello ${recipientName},</p>
        <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #334155;">
          We received a request to reset the password for your CONTECH CRM account associated with <strong>${email}</strong>.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
          To choose a new secure password, click the button below:
        </p>
        
        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 24px 0;">
          <tr>
            <td align="center">
              <a href="${resetUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 14px; font-weight: bold; border-radius: 6px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                Reset My Password
              </a>
            </td>
          </tr>
        </table>

        <!-- Security / Expiration Notice Box -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; margin: 0 0 20px 0;">
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #0f172a;">
                Important Security Information
              </p>
              <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #475569; line-height: 1.6;">
                <li>This password reset link will expire in <strong>60 minutes</strong>.</li>
                <li>This link can only be used once. After your password is updated, it becomes invalid.</li>
                <li>If you did not request a password reset, you can safely ignore this email. Your current password remains secure.</li>
              </ul>
            </td>
          </tr>
        </table>

        <p style="margin: 20px 0 6px 0; font-size: 12px; line-height: 1.5; color: #64748b;">
          If the button above does not work, copy and paste this link into your browser:
        </p>
        <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.4; word-break: break-all;">
          <a href="${resetUrl}" style="color: #2563eb; text-decoration: underline;">${resetUrl}</a>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td align="center" style="background-color: #f8fafc; padding: 16px; border-top: 1px solid #e2e8f0; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; font-size: 11px; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} CONTECH Integrated Automation Solutions.<br/>
        Automated system notification. Please do not reply directly to this email.
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const textContent = `Hello ${recipientName},\n\nWe received a request to reset your CONTECH CRM password.\n\nPlease visit the link below to choose a new password (valid for 60 minutes):\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nCONTECH Security Team`;

    const mailOptions = {
      from: `"CONTECH Security" <${senderEmail}>`,
      replyTo: senderEmail,
      to: email.trim(),
      subject: `Password Reset Request - CONTECH CRM`,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Mailer': 'CONTECH CRM Platform',
        'X-Priority': '1', // High priority for security actions
        'Importance': 'high',
      },
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email dispatched to ${email} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${user?.email}:`, error.message);
    return { success: false, error: error.message };
  }
};
