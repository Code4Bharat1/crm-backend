import nodemailer from 'nodemailer';

/**
 * Sends a project assignment notification email to the assigned Project Manager.
 *
 * @param {Object} project - The assigned project document
 * @param {Object} employee - The employee document (Project Manager)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendProjectAssignmentEmail = async (project, employee) => {
  try {
    const email = employee?.email;
    const pmName = employee?.fullName || project.manager || 'Project Manager';

    if (!email) {
      console.warn(`[Notification] PM ${pmName} has no email address. Skipping email dispatch.`);
      return { success: false, error: 'No email address found for Project Manager' };
    }

    if (!process.env.EMAIL_ID || !process.env.EMAIL_PASSWORD) {
      console.warn('[Notification] EMAIL_ID or EMAIL_PASSWORD not configured. Skipping email dispatch.');
      return { success: false, error: 'Email credentials not configured' };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_ID,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const portalUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const projectUrl = `${portalUrl}/projects/${project.projectId || project._id}`;
    const formattedRevenue = Number(project.revenue || 0).toLocaleString('en-IN');
    const formattedBudget = Number(project.estimatedCost || 0).toLocaleString('en-IN');
    const startDate = project.start ? new Date(project.start).toLocaleDateString('en-IN') : 'Immediate';
    const endDate = project.end ? new Date(project.end).toLocaleDateString('en-IN') : 'TBD';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>New Project Assignment</title>
</head>
<body style="margin:0; padding:20px; font-family: Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">CONTECH CRM</h1>
        <p style="margin: 6px 0 0 0; color: #bfdbfe; font-size: 13px;">New Project Assignment Notification</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 28px;">
        <p style="font-size: 15px; margin-top: 0;">Dear <strong>${pmName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          You have been formally assigned as the <strong>Project Manager</strong> for the following engineering project in the CRM:
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #1e293b;">${project.name}</h2>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; font-family: monospace;">Project Code: <strong>${project.projectId || 'PRJ'}</strong></p>
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #334155;">Client: <strong>${project.customer?.name || 'Customer'}</strong></p>
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #334155;">Contract Value: <strong>₹${formattedRevenue}</strong></p>
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #334155;">Estimated Budget: <strong>₹${formattedBudget}</strong></p>
          <p style="margin: 0; font-size: 13px; color: #334155;">Timeline: <strong>${startDate}</strong> to <strong>${endDate}</strong></p>
        </div>

        ${project.description ? `
        <p style="font-size: 13px; line-height: 1.5; color: #475569; background: #fdfdfd; border: 1px dashed #cbd5e1; padding: 12px; border-radius: 6px;">
          <strong>Scope of Work:</strong> ${project.description}
        </p>` : ''}

        <div style="text-align: center; margin: 28px 0;">
          <a href="${projectUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block;">
            Open Project Execution Details ➔
          </a>
        </div>

        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 0;">
          Please review the project milestones, team allocation, and procurement schedules upon login.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        &copy; ${new Date().getFullYear()} CONTECH Industrial Engineering &amp; Automation CRM. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const mailOptions = {
      from: `"CONTECH Project Desk" <${process.env.EMAIL_ID}>`,
      to: email,
      subject: `[Assignment] You are assigned as Project Manager for: ${project.name} (${project.projectId || 'PRJ'})`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Notification] Project assignment email dispatched to ${email}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`⚠️ [Notification] Failed to send assignment email:`, error.message);
    return { success: false, error: error.message };
  }
};
