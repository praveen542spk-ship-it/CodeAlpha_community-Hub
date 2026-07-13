const nodemailer = require('nodemailer');

const sendInviteEmail = async (toEmail, roomLink, scheduledAt, hostName) => {
  // Create reusable transporter object using Gmail/SMTP
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Communication Hub" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Meeting Invite: Collaboration Space with ${hostName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background: #fafafa; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea;">
        <h2 style="color: #7c3aed; margin-top: 0;">Workspace Invitation ⚡</h2>
        <p>Hello,</p>
        <p>You have been invited to join a real-time collaborative workspace session.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p><strong>Host:</strong> ${hostName}</p>
        <p><strong>Scheduled Time:</strong> ${new Date(scheduledAt).toLocaleString()}</p>
        <p>Click the button below to join the space directly:</p>
        <a href="${roomLink}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 15px 0; box-shadow: 0 4px 10px rgba(124, 58, 237, 0.25);">Join Workspace</a>
        <p style="font-size: 12px; color: #666; margin-top: 20px;">If the button above does not work, copy and paste this URL into your browser:</p>
        <p style="font-size: 12px; color: #7c3aed; word-break: break-all;">${roomLink}</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="font-size: 11px; color: #999;">This email was sent automatically by Communication Hub. Please do not reply directly.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

const sendVideoMessageNotification = async (toEmail, hostName, senderName, roomId) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Communication Hub" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Video Message Viewed in Space ${roomId} 🎥`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background: #fafafa; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea;">
        <h2 style="color: #7c3aed; margin-top: 0;">Video Message Viewed! 🎥</h2>
        <p>Hello ${hostName},</p>
        <p>This is to notify you that the video message left by <strong>${senderName}</strong> in your Room <strong>${roomId}</strong> was just viewed.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="font-size: 11px; color: #999;">This email was sent automatically by Communication Hub. Please do not reply directly.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendInviteEmail, sendVideoMessageNotification };
