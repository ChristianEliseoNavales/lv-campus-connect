const nodemailer = require('nodemailer');

/**
 * Email Service for sending system emails
 * Provides centralized email functionality using nodemailer
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  /**
   * Initialize nodemailer transporter with environment variables
   */
  initializeTransporter() {
    try {
      const emailHost = process.env.EMAIL_HOST;
      const emailPort = process.env.EMAIL_PORT;
      const emailSecure = process.env.EMAIL_SECURE === 'true';
      const emailUser = process.env.EMAIL_USER;
      const emailPass = process.env.EMAIL_PASS;

      // Check if all required environment variables are present
      if (!emailHost || !emailPort || !emailUser || !emailPass) {
        console.warn('⚠️  Email service not configured: Missing required environment variables');
        console.warn('   Required: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS');
        this.isConfigured = false;
        return;
      }

      // Create transporter
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort, 10),
        secure: emailSecure, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });

      this.isConfigured = true;
      console.log('✅ Email service configured successfully');
    } catch (error) {
      console.error('❌ Error initializing email service:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Format access level for display
   * @param {string} accessLevel - Access level value
   * @returns {string} Formatted access level
   */
  formatAccessLevel(accessLevel) {
    const formatMap = {
      'super_admin': 'Super Admin',
      'admin': 'Admin',
      'admin_staff': 'Admin Staff'
    };
    return formatMap[accessLevel] || accessLevel;
  }

  /**
   * Generate HTML email template for welcome email
   * @param {Object} userData - User data object
   * @param {string} userData.name - User's full name
   * @param {string} userData.email - User's email address
   * @param {string} userData.office - User's office
   * @param {string} userData.accessLevel - User's access level
   * @returns {string} HTML email template
   */
  generateWelcomeEmailTemplate(userData) {
    const { name, email, office, accessLevel } = userData;
    const formattedAccessLevel = this.formatAccessLevel(accessLevel);
    const loginUrl = 'https://lv-campus-connect.pages.dev/login';
    const fromName = process.env.EMAIL_FROM_NAME || 'LVCampusConnect System';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to LVCampusConnect</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background: linear-gradient(135deg, #1F3463 0%, #3044BB 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .email-header h1 {
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .email-body {
      padding: 40px 30px;
    }
    .welcome-message {
      font-size: 18px;
      color: #1F3463;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .intro-text {
      font-size: 16px;
      color: #555555;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .user-details {
      background-color: #f8f9fa;
      border-left: 4px solid #1F3463;
      padding: 25px;
      margin: 30px 0;
      border-radius: 8px;
    }
    .detail-row {
      display: flex;
      margin-bottom: 15px;
      align-items: flex-start;
    }
    .detail-row:last-child {
      margin-bottom: 0;
    }
    .detail-label {
      font-weight: 600;
      color: #1F3463;
      min-width: 120px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-value {
      color: #333333;
      font-size: 15px;
      flex: 1;
    }
    .cta-section {
      text-align: center;
      margin: 40px 0;
    }
    .cta-button {
      display: inline-block;
      background-color: #1F3463;
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      transition: background-color 0.3s ease;
      box-shadow: 0 4px 6px rgba(31, 52, 99, 0.2);
    }
    .cta-button:hover {
      background-color: #3044BB;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
    }
    .footer-text {
      font-size: 13px;
      color: #666666;
      line-height: 1.6;
    }
    .footer-text a {
      color: #1F3463;
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background-color: #e0e0e0;
      margin: 30px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-body {
        padding: 30px 20px;
      }
      .email-header {
        padding: 30px 20px;
      }
      .email-header h1 {
        font-size: 24px;
      }
      .detail-row {
        flex-direction: column;
      }
      .detail-label {
        margin-bottom: 5px;
        min-width: auto;
      }
      .cta-button {
        padding: 14px 30px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="email-header">
      <h1>LVCampusConnect</h1>
    </div>

    <!-- Body -->
    <div class="email-body">
      <div class="welcome-message">
        Welcome, ${name}!
      </div>

      <div class="intro-text">
        Your account has been successfully created in the LVCampusConnect System. You now have access to the admin portal with the following credentials and permissions.
      </div>

      <!-- User Details -->
      <div class="user-details">
        <div class="detail-row">
          <div class="detail-label">Full Name:</div>
          <div class="detail-value">${name}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Email:</div>
          <div class="detail-value">${email}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Office:</div>
          <div class="detail-value">${office}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Access Level:</div>
          <div class="detail-value">${formattedAccessLevel}</div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Call to Action -->
      <div class="cta-section">
        <p style="font-size: 15px; color: #555555; margin-bottom: 20px;">
          Click the button below to access the admin portal:
        </p>
        <a href="${loginUrl}" class="cta-button">Access Admin Portal</a>
      </div>

      <div class="intro-text" style="margin-top: 30px; font-size: 14px; color: #666666;">
        <strong>Note:</strong> Please use your Google account (${email}) to sign in. If you encounter any issues, please contact your system administrator.
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">
        <p>This is an automated message from <strong>${fromName}</strong>.</p>
        <p style="margin-top: 10px;">
          Please do not reply to this email. For support, contact your system administrator.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Send welcome email to newly created user
   * @param {Object} userData - User data object
   * @param {string} userData.name - User's full name
   * @param {string} userData.email - User's email address
   * @param {string} userData.office - User's office
   * @param {string} userData.accessLevel - User's access level
   * @returns {Promise<Object>} Email sending result
   */
  async sendWelcomeEmail(userData) {
    // Check if email service is configured
    if (!this.isConfigured || !this.transporter) {
      console.warn('⚠️  Email service not configured. Skipping welcome email.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { name, email, office, accessLevel } = userData;

      // Validate required user data
      if (!name || !email || !office || !accessLevel) {
        throw new Error('Missing required user data for welcome email');
      }

      const fromName = process.env.EMAIL_FROM_NAME || 'LVCampusConnect System';
      const fromEmail = process.env.EMAIL_USER;

      // Generate HTML email template
      const htmlContent = this.generateWelcomeEmailTemplate(userData);

      // Email options
      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Welcome to LVCampusConnect System',
        html: htmlContent,
        text: `Welcome to LVCampusConnect System\n\nDear ${name},\n\nYour account has been successfully created.\n\nAccount Details:\n- Full Name: ${name}\n- Email: ${email}\n- Office: ${office}\n- Access Level: ${this.formatAccessLevel(accessLevel)}\n\nPlease visit https://lv-campus-connect.pages.dev/login to access the admin portal.\n\nUse your Google account (${email}) to sign in.\n\nThis is an automated message. Please do not reply.`
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent successfully to:', email);
      console.log('   Message ID:', info.messageId);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending welcome email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify email service configuration
   * @returns {Promise<boolean>} True if configuration is valid
   */
  async verifyConfiguration() {
    if (!this.isConfigured || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email service configuration verified');
      return true;
    } catch (error) {
      console.error('❌ Email service configuration verification failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = emailService;

