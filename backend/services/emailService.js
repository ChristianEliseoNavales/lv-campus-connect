const nodemailer = require('nodemailer');

// Try to load googleapis for Gmail API support (optional dependency)
let google = null;
let OAuth2Client = null;
try {
  // Import googleapis - match the pattern from generateGmailRefreshToken.js
  const { google: googleApi } = require('googleapis');
  google = googleApi;
  // OAuth2Client should be imported from google-auth-library, not googleapis
  const { OAuth2Client: OAuth2 } = require('google-auth-library');
  OAuth2Client = OAuth2;
} catch (error) {
  // googleapis or google-auth-library not installed, will use SMTP only
  // This is fine - SMTP will be used as fallback
  console.warn('⚠️  googleapis or google-auth-library not available:', error.message);
}

/**
 * Email Service for sending system emails
 * Supports Gmail API (OAuth2) for cloud deployments and SMTP for local development
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.gmailClient = null;
    this.oauth2Client = null; // Store OAuth2 client for token refresh
    this.isConfigured = false;
    this.emailMethod = null; // 'gmail-api' or 'smtp'
    this.initializeTransporter();
    // Non-blocking startup verification
    this.verifyGmailAPIConnection().catch(err => {
      // Verification failure doesn't block startup
      console.warn('⚠️  Gmail API verification skipped or failed:', err.message);
    });
  }

  /**
   * Initialize email service - tries Gmail API first, falls back to SMTP
   * Gmail API works on Render (uses HTTPS, no blocked ports)
   * SMTP works locally but may fail on Render due to port blocking
   */
  initializeTransporter() {
    const timestamp = new Date().toISOString();
    const isRender = process.env.RENDER || process.env.RENDER_EXTERNAL_URL;

    console.log(`[EMAIL_DEBUG] ${timestamp} - Initializing email service...`);
    console.log(`[EMAIL_DEBUG]   - Environment: ${isRender ? 'Render (Cloud)' : 'Local'}`);

    // Try Gmail API first (works on Render)
    const gmailApiResult = this.initializeGmailAPI();
    if (gmailApiResult) {
      this.emailMethod = 'gmail-api';
      this.isConfigured = true;
      console.log('✅ Email service configured successfully (Gmail API)');
      return;
    }

    // If on Render and Gmail API env vars exist but init failed, don't use SMTP
    if (isRender) {
      const hasGmailVars = process.env.GMAIL_CLIENT_ID || process.env.GMAIL_CLIENT_SECRET || process.env.GMAIL_REFRESH_TOKEN;
      if (hasGmailVars) {
        console.error('❌ Gmail API initialization failed on Render, but Gmail API environment variables are set!');
        console.error('   This indicates a configuration issue. Please check:');
        console.error('   1. All Gmail API env vars are set: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, EMAIL_USER');
        console.error('   2. The refresh token is valid (regenerate if needed using scripts/generateGmailRefreshToken.js)');
        console.error('   3. Gmail API is enabled in Google Cloud Console');
        console.error('   4. OAuth2 scopes include: https://www.googleapis.com/auth/gmail.send');
        console.error('   SMTP will NOT be used on Render due to blocked ports.');
        this.isConfigured = false;
        this.emailMethod = null;
        return;
      }
    }

    // Fallback to SMTP (works locally, may fail on Render)
    if (this.initializeSMTP()) {
      this.emailMethod = 'smtp';
      this.isConfigured = true;
      console.log('✅ Email service configured successfully (SMTP)');
      if (isRender) {
        console.error('⚠️  WARNING: Using SMTP on Render will likely fail due to blocked ports (25, 587, 465)');
        console.error('   Please configure Gmail API by setting: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, EMAIL_USER');
      } else {
        console.warn('⚠️  Note: SMTP may fail on cloud providers like Render due to blocked ports (25, 587, 465)');
        console.warn('   Consider using Gmail API by setting GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
      }
      return;
    }

    // Neither method configured
    this.isConfigured = false;
    this.emailMethod = null;
    console.warn('⚠️  Email service not configured: No valid configuration found');
  }

  /**
   * Initialize Gmail API using OAuth2 (works on Render)
   * Requires: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
   */
  initializeGmailAPI() {
    const timestamp = new Date().toISOString();

    try {
      if (!google || !OAuth2Client) {
        // googleapis or google-auth-library not installed
        console.warn(`[EMAIL_DEBUG] ${timestamp} - Gmail API initialization failed: Required packages not installed`);
        console.warn('   Install with: npm install googleapis google-auth-library');
        console.warn(`   - googleapis: ${google ? 'INSTALLED' : 'NOT INSTALLED'}`);
        console.warn(`   - google-auth-library: ${OAuth2Client ? 'INSTALLED' : 'NOT INSTALLED'}`);
        return false;
      }

      const gmailClientId = process.env.GMAIL_CLIENT_ID;
      const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
      const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
      const emailUser = process.env.EMAIL_USER;

      // Diagnostic logging - show what we found
      console.log(`[EMAIL_DEBUG] ${timestamp} - Checking Gmail API environment variables:`);
      console.log(`[EMAIL_DEBUG]   - GMAIL_CLIENT_ID: ${gmailClientId ? `SET (${gmailClientId.length} chars, starts with ${gmailClientId.substring(0, 10)}...)` : 'NOT SET'}`);
      console.log(`[EMAIL_DEBUG]   - GMAIL_CLIENT_SECRET: ${gmailClientSecret ? `SET (${gmailClientSecret.length} chars)` : 'NOT SET'}`);
      console.log(`[EMAIL_DEBUG]   - GMAIL_REFRESH_TOKEN: ${gmailRefreshToken ? `SET (${gmailRefreshToken.length} chars, starts with ${gmailRefreshToken.substring(0, 10)}...)` : 'NOT SET'}`);
      console.log(`[EMAIL_DEBUG]   - EMAIL_USER: ${emailUser ? `SET (${emailUser})` : 'NOT SET'}`);

      // Detailed logging for missing environment variables
      const missingVars = [];
      if (!gmailClientId) missingVars.push('GMAIL_CLIENT_ID');
      if (!gmailClientSecret) missingVars.push('GMAIL_CLIENT_SECRET');
      if (!gmailRefreshToken) missingVars.push('GMAIL_REFRESH_TOKEN');
      if (!emailUser) missingVars.push('EMAIL_USER');

      if (missingVars.length > 0) {
        console.warn(`[EMAIL_DEBUG] ${timestamp} - Gmail API initialization failed: Missing required environment variables`);
        console.warn(`   Missing variables: ${missingVars.join(', ')}`);
        console.warn('   To enable Gmail API on Render:');
        console.warn('   1. Go to Render Dashboard > Your Service > Environment');
        console.warn('   2. Add GMAIL_CLIENT_ID (from Google Cloud Console)');
        console.warn('   3. Add GMAIL_CLIENT_SECRET (from Google Cloud Console)');
        console.warn('   4. Add GMAIL_REFRESH_TOKEN (generate using: node scripts/generateGmailRefreshToken.js)');
        console.warn('   5. Add EMAIL_USER (your Gmail address, e.g., lvcampusconnect@gmail.com)');
        console.warn('   6. RESTART the Render service after adding environment variables');
        return false;
      }

      // Set up OAuth2 client
      if (!OAuth2Client) {
        console.error(`[EMAIL_DEBUG] ${timestamp} - OAuth2Client not available. google-auth-library may not be installed.`);
        return false;
      }

      const oauth2Client = new OAuth2Client(
        gmailClientId,
        gmailClientSecret,
        'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for installed apps
      );

      // Set refresh token with error handling
      try {
        console.log(`[EMAIL_DEBUG] ${timestamp} - Setting OAuth2 credentials...`);
        oauth2Client.setCredentials({
          refresh_token: gmailRefreshToken
        });
        console.log(`[EMAIL_DEBUG] ${timestamp} - OAuth2 credentials set successfully`);
      } catch (tokenError) {
        console.error(`[EMAIL_DEBUG] ${timestamp} - Error setting OAuth2 credentials:`, tokenError.message);
        console.error('   This may indicate an invalid refresh token. Regenerate using scripts/generateGmailRefreshToken.js');
        if (tokenError.stack) {
          console.error(`[EMAIL_DEBUG]   - Stack: ${tokenError.stack}`);
        }
        return false;
      }

      // Store OAuth2 client for token refresh operations
      this.oauth2Client = oauth2Client;

      // Create Gmail API client
      try {
        console.log(`[EMAIL_DEBUG] ${timestamp} - Creating Gmail API client...`);
        this.gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
        console.log(`[EMAIL_DEBUG] ${timestamp} - Gmail API client created successfully`);
      } catch (clientError) {
        console.error(`[EMAIL_DEBUG] ${timestamp} - Error creating Gmail API client:`, clientError.message);
        if (clientError.stack) {
          console.error(`[EMAIL_DEBUG]   - Stack: ${clientError.stack}`);
        }
        return false;
      }

      // [EMAIL_DEBUG] Log Gmail API configuration
      console.log(`[EMAIL_DEBUG] ${timestamp} - Gmail API Configuration:`);
      console.log(`[EMAIL_DEBUG]   - Method: Gmail API (OAuth2)`);
      console.log(`[EMAIL_DEBUG]   - From Email: ${emailUser}`);
      console.log(`[EMAIL_DEBUG]   - From Name: ${process.env.EMAIL_FROM_NAME || 'LVCampusConnect System'}`);
      console.log(`[EMAIL_DEBUG]   - Client ID: ***SET***`);
      console.log(`[EMAIL_DEBUG]   - Client Secret: ***SET***`);
      console.log(`[EMAIL_DEBUG]   - Refresh Token: ***SET***`);
      console.log(`[EMAIL_DEBUG]   - Note: Uses HTTPS, works on Render (no blocked ports)`);

      return true;
    } catch (error) {
      console.error(`[EMAIL_DEBUG] ${timestamp} - Error initializing Gmail API:`, error.message);
      if (error.stack) {
        console.error(`[EMAIL_DEBUG]   - Stack trace:`, error.stack);
      }
      return false;
    }
  }

  /**
   * Verify Gmail API connection by testing authentication
   * @returns {Promise<boolean>} True if Gmail API is working
   */
  async verifyGmailAPIConnection() {
    if (this.emailMethod !== 'gmail-api' || !this.gmailClient) {
      return false;
    }

    try {
      const timestamp = new Date().toISOString();
      console.log(`[EMAIL_DEBUG] ${timestamp} - Verifying Gmail API connection...`);

      // Test by getting user profile
      const profile = await this.gmailClient.users.getProfile({ userId: 'me' });

      console.log(`[EMAIL_DEBUG] ${timestamp} - ✅ Gmail API verification successful`);
      console.log(`[EMAIL_DEBUG]   - Authenticated as: ${profile.data.emailAddress}`);
      console.log(`[EMAIL_DEBUG]   - Messages total: ${profile.data.messagesTotal || 'N/A'}`);

      return true;
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`[EMAIL_DEBUG] ${timestamp} - ❌ Gmail API verification failed`);
      console.error(`[EMAIL_DEBUG]   - Error message: ${error.message}`);
      console.error(`[EMAIL_DEBUG]   - Error code: ${error.code || 'N/A'}`);

      if (error.response) {
        console.error(`[EMAIL_DEBUG]   - Response status: ${error.response.status}`);
        console.error(`[EMAIL_DEBUG]   - Response data:`, JSON.stringify(error.response.data));

        // Provide helpful guidance for common errors
        if (error.response.status === 401) {
          console.error(`[EMAIL_DEBUG]   - Recommendation: Refresh token may be invalid or expired. Regenerate using scripts/generateGmailRefreshToken.js`);
        } else if (error.response.status === 403) {
          console.error(`[EMAIL_DEBUG]   - Recommendation: Check that Gmail API is enabled in Google Cloud Console and OAuth2 scopes are correct`);
        }
      }

      return false;
    }
  }

  /**
   * Initialize SMTP transporter (works locally, may fail on Render)
   * Requires: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS
   */
  initializeSMTP() {
    try {
      const emailHost = process.env.EMAIL_HOST;
      const emailPort = process.env.EMAIL_PORT;
      const emailSecure = process.env.EMAIL_SECURE === 'true';
      const emailUser = process.env.EMAIL_USER;
      const emailPass = process.env.EMAIL_PASS;

      // Check if all required environment variables are present
      if (!emailHost || !emailPort || !emailUser || !emailPass) {
        return false;
      }

      // Create transporter with timeout configuration
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort, 10),
        secure: emailSecure, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPass
        },
        connectionTimeout: 5000, // 5 seconds to establish connection
        socketTimeout: 10000 // 10 seconds for socket operations
      });

      // [EMAIL_DEBUG] Log SMTP configuration
      const timestamp = new Date().toISOString();
      console.log(`[EMAIL_DEBUG] ${timestamp} - SMTP Configuration:`);
      console.log(`[EMAIL_DEBUG]   - Method: SMTP`);
      console.log(`[EMAIL_DEBUG]   - Host: ${emailHost}`);
      console.log(`[EMAIL_DEBUG]   - Port: ${emailPort}`);
      console.log(`[EMAIL_DEBUG]   - Secure: ${emailSecure}`);
      console.log(`[EMAIL_DEBUG]   - From Email: ${emailUser}`);
      console.log(`[EMAIL_DEBUG]   - From Name: ${process.env.EMAIL_FROM_NAME || 'LVCampusConnect System'}`);
      console.log(`[EMAIL_DEBUG]   - Connection Timeout: 5000ms`);
      console.log(`[EMAIL_DEBUG]   - Socket Timeout: 10000ms`);
      console.log(`[EMAIL_DEBUG]   - Password: ${emailPass ? '***SET***' : '***NOT SET***'}`);
      console.log(`[EMAIL_DEBUG]   - Warning: May fail on Render due to blocked SMTP ports (25, 587, 465)`);

      return true;
    } catch (error) {
      console.error('❌ Error initializing SMTP:', error.message);
      return false;
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
   * Uses Gmail API if available, falls back to SMTP
   * @param {Object} userData - User data object
   * @param {string} userData.name - User's full name
   * @param {string} userData.email - User's email address
   * @param {string} userData.office - User's office
   * @param {string} userData.accessLevel - User's access level
   * @returns {Promise<Object>} Email sending result
   */
  async sendWelcomeEmail(userData) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // [EMAIL_DEBUG] Log email sending attempt start
    console.log(`[EMAIL_DEBUG] ${timestamp} - Starting welcome email send`);
    console.log(`[EMAIL_DEBUG]   - Method: ${this.emailMethod || 'unknown'}`);

    // Check if email service is configured
    if (!this.isConfigured) {
      console.warn('⚠️  Email service not configured. Skipping welcome email.');
      console.log(`[EMAIL_DEBUG] ${timestamp} - Email service not configured. isConfigured: ${this.isConfigured}`);
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { name, email, office, accessLevel } = userData;

      // [EMAIL_DEBUG] Log user data
      console.log(`[EMAIL_DEBUG] ${timestamp} - User data:`, {
        name,
        email,
        office,
        accessLevel
      });

      // Validate required user data
      if (!name || !email || !office || !accessLevel) {
        const missingFields = [];
        if (!name) missingFields.push('name');
        if (!email) missingFields.push('email');
        if (!office) missingFields.push('office');
        if (!accessLevel) missingFields.push('accessLevel');
        throw new Error(`Missing required user data for welcome email: ${missingFields.join(', ')}`);
      }

      const fromName = process.env.EMAIL_FROM_NAME || 'LVCampusConnect System';
      const fromEmail = process.env.EMAIL_USER;

      // [EMAIL_DEBUG] Log email configuration
      console.log(`[EMAIL_DEBUG] ${timestamp} - Email configuration:`, {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Welcome to LVCampusConnect System'
      });

      // Generate HTML email template
      const htmlContent = this.generateWelcomeEmailTemplate(userData);
      const textContent = `Welcome to LVCampusConnect System\n\nDear ${name},\n\nYour account has been successfully created.\n\nAccount Details:\n- Full Name: ${name}\n- Email: ${email}\n- Office: ${office}\n- Access Level: ${this.formatAccessLevel(accessLevel)}\n\nPlease visit https://lv-campus-connect.pages.dev/login to access the admin portal.\n\nUse your Google account (${email}) to sign in.\n\nThis is an automated message. Please do not reply.`;

      // Use Gmail API if available, otherwise use SMTP
      if (this.emailMethod === 'gmail-api' && this.gmailClient) {
        return await this.sendViaGmailAPI({
          from: fromEmail,
          fromName,
          to: email,
          subject: 'Welcome to LVCampusConnect System',
          html: htmlContent,
          text: textContent
        }, startTime, timestamp);
      } else if (this.emailMethod === 'smtp' && this.transporter) {
        return await this.sendViaSMTP({
          from: `"${fromName}" <${fromEmail}>`,
          to: email,
          subject: 'Welcome to LVCampusConnect System',
          html: htmlContent,
          text: textContent
        }, startTime, timestamp);
      } else {
        throw new Error(`Email method "${this.emailMethod}" not properly initialized`);
      }
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error('❌ Error sending welcome email:', error.message);

      // [EMAIL_DEBUG] Log detailed error information
      console.error(`[EMAIL_DEBUG] ${new Date().toISOString()} - Email sending failed`);
      console.error(`[EMAIL_DEBUG]   - Method: ${this.emailMethod || 'unknown'}`);
      console.error(`[EMAIL_DEBUG]   - Error message: ${error.message}`);
      console.error(`[EMAIL_DEBUG]   - Error code: ${error.code || 'N/A'}`);
      console.error(`[EMAIL_DEBUG]   - Total duration: ${totalDuration}ms`);
      if (error.stack) {
        console.error(`[EMAIL_DEBUG]   - Stack trace:`, error.stack);
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Send email via Gmail API (works on Render)
   * Includes automatic token refresh retry logic
   */
  async sendViaGmailAPI(mailOptions, startTime, timestamp) {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const connectionStartTime = Date.now();
        if (attempt > 0) {
          console.log(`[EMAIL_DEBUG] ${new Date().toISOString()} - Retrying Gmail API send (attempt ${attempt + 1}/${maxRetries + 1})`);
        } else {
          console.log(`[EMAIL_DEBUG] ${timestamp} - Attempting Gmail API send`);
        }

        // Create email message in RFC 2822 format
        const message = [
          `From: ${mailOptions.fromName} <${mailOptions.from}>`,
          `To: ${mailOptions.to}`,
          `Subject: ${mailOptions.subject}`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/alternative; boundary="boundary123"`,
          ``,
          `--boundary123`,
          `Content-Type: text/plain; charset=UTF-8`,
          ``,
          mailOptions.text,
          ``,
          `--boundary123`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          mailOptions.html,
          ``,
          `--boundary123--`
        ].join('\n');

        // Encode message in base64url format
        const encodedMessage = Buffer.from(message)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        // Send email via Gmail API
        const response = await this.gmailClient.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedMessage
          }
        });

        const connectionEndTime = Date.now();
        const connectionDuration = connectionEndTime - connectionStartTime;
        const totalDuration = Date.now() - startTime;

        console.log('✅ Welcome email sent successfully via Gmail API to:', mailOptions.to);
        console.log(`[EMAIL_DEBUG] ${new Date().toISOString()} - Email sent successfully via Gmail API`);
        console.log(`[EMAIL_DEBUG]   - Connection duration: ${connectionDuration}ms`);
        console.log(`[EMAIL_DEBUG]   - Total duration: ${totalDuration}ms`);
        console.log(`[EMAIL_DEBUG]   - Message ID: ${response.data.id}`);

        return { success: true, messageId: response.data.id };
      } catch (error) {
        const totalDuration = Date.now() - startTime;
        const errorTimestamp = new Date().toISOString();

        // Check if error is due to expired/invalid token (401 Unauthorized)
        const isUnauthorized = error.response && error.response.status === 401;
        const canRetry = attempt < maxRetries && isUnauthorized && this.oauth2Client;

        if (isUnauthorized && canRetry) {
          console.warn(`[EMAIL_DEBUG] ${errorTimestamp} - Gmail API authentication failed (401), attempting token refresh...`);

          try {
            // Force token refresh by getting a new access token
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            this.oauth2Client.setCredentials(credentials);

            // Update Gmail client with refreshed credentials
            this.gmailClient = google.gmail({ version: 'v1', auth: this.oauth2Client });

            console.log(`[EMAIL_DEBUG] ${errorTimestamp} - Token refreshed successfully, retrying...`);
            attempt++;
            continue; // Retry the send
          } catch (refreshError) {
            console.error(`[EMAIL_DEBUG] ${errorTimestamp} - Token refresh failed:`, refreshError.message);
            // Fall through to error handling
          }
        }

        // Log detailed error information
        console.error(`[EMAIL_DEBUG] ${errorTimestamp} - Gmail API send failed`);
        console.error(`[EMAIL_DEBUG]   - Error message: ${error.message}`);
        console.error(`[EMAIL_DEBUG]   - Error code: ${error.code || 'N/A'}`);
        console.error(`[EMAIL_DEBUG]   - Total duration: ${totalDuration}ms`);
        console.error(`[EMAIL_DEBUG]   - Attempt: ${attempt + 1}/${maxRetries + 1}`);

        if (error.response) {
          console.error(`[EMAIL_DEBUG]   - Response status: ${error.response.status}`);
          console.error(`[EMAIL_DEBUG]   - Response data:`, JSON.stringify(error.response.data));

          // Provide helpful error messages
          if (error.response.status === 401) {
            const helpfulMessage = 'Gmail API authentication failed. The refresh token may be invalid or expired. Regenerate using scripts/generateGmailRefreshToken.js';
            console.error(`[EMAIL_DEBUG]   - Recommendation: ${helpfulMessage}`);
            throw new Error(helpfulMessage);
          } else if (error.response.status === 403) {
            const helpfulMessage = 'Gmail API access denied. Check that Gmail API is enabled in Google Cloud Console and OAuth2 scopes include gmail.send';
            console.error(`[EMAIL_DEBUG]   - Recommendation: ${helpfulMessage}`);
            throw new Error(helpfulMessage);
          } else if (error.response.status === 400) {
            const helpfulMessage = `Gmail API request invalid: ${error.response.data?.error?.message || error.message}`;
            console.error(`[EMAIL_DEBUG]   - Recommendation: ${helpfulMessage}`);
            throw new Error(helpfulMessage);
          }
        }

        throw error;
      }
    }
  }

  /**
   * Send email via SMTP (works locally, may fail on Render)
   */
  async sendViaSMTP(mailOptions, startTime, timestamp) {
    try {
      const connectionStartTime = Date.now();
      console.log(`[EMAIL_DEBUG] ${timestamp} - Attempting SMTP connection to ${this.transporter.options.host}:${this.transporter.options.port}`);

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      const connectionEndTime = Date.now();
      const connectionDuration = connectionEndTime - connectionStartTime;
      const totalDuration = Date.now() - startTime;

      console.log('✅ Welcome email sent successfully via SMTP to:', mailOptions.to);
      console.log('   Message ID:', info.messageId);
      console.log(`[EMAIL_DEBUG] ${new Date().toISOString()} - Email sent successfully via SMTP`);
      console.log(`[EMAIL_DEBUG]   - Connection duration: ${connectionDuration}ms`);
      console.log(`[EMAIL_DEBUG]   - Total duration: ${totalDuration}ms`);
      console.log(`[EMAIL_DEBUG]   - Message ID: ${info.messageId}`);
      console.log(`[EMAIL_DEBUG]   - Response: ${JSON.stringify(info.response || 'N/A')}`);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error(`[EMAIL_DEBUG] ${new Date().toISOString()} - SMTP send failed`);
      console.error(`[EMAIL_DEBUG]   - Error message: ${error.message}`);
      console.error(`[EMAIL_DEBUG]   - Error code: ${error.code || 'N/A'}`);
      console.error(`[EMAIL_DEBUG]   - Error responseCode: ${error.responseCode || 'N/A'}`);
      console.error(`[EMAIL_DEBUG]   - Error command: ${error.command || 'N/A'}`);
      console.error(`[EMAIL_DEBUG]   - Error response: ${error.response || 'N/A'}`);
      console.error(`[EMAIL_DEBUG]   - Total duration: ${totalDuration}ms`);
      if (error.errno) {
        console.error(`[EMAIL_DEBUG]   - System errno: ${error.errno}`);
      }
      if (error.syscall) {
        console.error(`[EMAIL_DEBUG]   - System call: ${error.syscall}`);
      }
      if (error.hostname) {
        console.error(`[EMAIL_DEBUG]   - Hostname: ${error.hostname}`);
      }
      if (error.port) {
        console.error(`[EMAIL_DEBUG]   - Port: ${error.port}`);
      }

      // Provide helpful error message for Render deployments
      if (error.code === 'ETIMEDOUT' && error.command === 'CONN') {
        const helpfulMessage = `${error.message}. This is likely because Render blocks SMTP ports (25, 587, 465). Consider using Gmail API by setting GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN environment variables.`;
        console.error(`[EMAIL_DEBUG]   - Recommendation: ${helpfulMessage}`);
        throw new Error(helpfulMessage);
      }

      throw error;
    }
  }

  /**
   * Get diagnostic information about email service configuration
   * @returns {Object} Diagnostic information
   */
  getDiagnostics() {
    const timestamp = new Date().toISOString();
    const isRender = process.env.RENDER || process.env.RENDER_EXTERNAL_URL;

    return {
      timestamp,
      environment: isRender ? 'Render (Cloud)' : 'Local',
      isConfigured: this.isConfigured,
      emailMethod: this.emailMethod,
      hasGmailClient: !!this.gmailClient,
      hasOAuth2Client: !!this.oauth2Client,
      hasTransporter: !!this.transporter,
      envVars: {
        GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ? `SET (${process.env.GMAIL_CLIENT_ID.length} chars)` : 'NOT SET',
        GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ? `SET (${process.env.GMAIL_CLIENT_SECRET.length} chars)` : 'NOT SET',
        GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ? `SET (${process.env.GMAIL_REFRESH_TOKEN.length} chars)` : 'NOT SET',
        EMAIL_USER: process.env.EMAIL_USER || 'NOT SET',
        EMAIL_HOST: process.env.EMAIL_HOST || 'NOT SET',
        EMAIL_PORT: process.env.EMAIL_PORT || 'NOT SET',
        EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET'
      },
      googleapisInstalled: !!google
    };
  }

  /**
   * Verify email service configuration
   * @returns {Promise<boolean>} True if configuration is valid
   */
  async verifyConfiguration() {
    if (!this.isConfigured) {
      return false;
    }

    try {
      if (this.emailMethod === 'gmail-api' && this.gmailClient) {
        // Verify Gmail API connection
        return await this.verifyGmailAPIConnection();
      } else if (this.emailMethod === 'smtp' && this.transporter) {
        // Verify SMTP connection
        await this.transporter.verify();
        console.log('✅ Email service configuration verified (SMTP)');
        return true;
      } else {
        console.error('❌ Email service configuration verification failed: Method not properly initialized');
        return false;
      }
    } catch (error) {
      console.error('❌ Email service configuration verification failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
console.log('📧 Initializing Email Service...');
const emailService = new EmailService();
console.log(`📧 Email Service initialized - Method: ${emailService.emailMethod || 'NONE'}, Configured: ${emailService.isConfigured}`);

module.exports = emailService;

