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

// OAuth2 redirect URI - must match the one used in generateGmailRefreshToken.js
const GMAIL_OAUTH2_REDIRECT_URI = 'http://localhost:3000/oauth2callback';

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
    // Non-blocking startup verification (silent failure)
    this.verifyGmailAPIConnection().catch(() => {
      // Verification failure doesn't block startup
    });
  }

  /**
   * Initialize email service - tries Gmail API first, falls back to SMTP
   * Gmail API works on Render (uses HTTPS, no blocked ports)
   * SMTP works locally but may fail on Render due to port blocking
   */
  initializeTransporter() {
    const isRender = process.env.RENDER || process.env.RENDER_EXTERNAL_URL;

    // Try Gmail API first (works on Render)
    const gmailApiResult = this.initializeGmailAPI();
    if (gmailApiResult) {
      this.emailMethod = 'gmail-api';
      this.isConfigured = true;
      console.log('✅ Email service configured (Gmail API)');
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

      // Check for missing environment variables
      const missingVars = [];
      if (!gmailClientId) missingVars.push('GMAIL_CLIENT_ID');
      if (!gmailClientSecret) missingVars.push('GMAIL_CLIENT_SECRET');
      if (!gmailRefreshToken) missingVars.push('GMAIL_REFRESH_TOKEN');
      if (!emailUser) missingVars.push('EMAIL_USER');

      if (missingVars.length > 0) {
        console.warn(`⚠️  Gmail API initialization failed: Missing environment variables: ${missingVars.join(', ')}`);
        return false;
      }

      // Set up OAuth2 client
      if (!OAuth2Client) {
        console.error(`[EMAIL_DEBUG] ${timestamp} - OAuth2Client not available. google-auth-library may not be installed.`);
        return false;
      }

      // Validate redirect URI consistency
      const expectedRedirectUri = GMAIL_OAUTH2_REDIRECT_URI;
      console.log(`[EMAIL_DEBUG] ${timestamp} - Using redirect URI: ${expectedRedirectUri}`);
      console.log(`[EMAIL_DEBUG] ${timestamp} - ⚠️  IMPORTANT: Ensure this redirect URI matches the one used in generateGmailRefreshToken.js`);
      console.log(`[EMAIL_DEBUG] ${timestamp} - ⚠️  IMPORTANT: Ensure this redirect URI is added to Google Cloud Console OAuth2 credentials`);

      const oauth2Client = new OAuth2Client(
        gmailClientId,
        gmailClientSecret,
        expectedRedirectUri // Must match redirect URI used during token generation
      );

      // Set refresh token with error handling
      try {
        oauth2Client.setCredentials({
          refresh_token: gmailRefreshToken
        });
      } catch (tokenError) {
        console.error(`❌ Error setting OAuth2 credentials: ${tokenError.message}`);
        console.error('   Invalid refresh token. Regenerate using scripts/generateGmailRefreshToken.js');
        if (tokenError.stack) {
          console.error(`   Stack: ${tokenError.stack}`);
        }
        return false;
      }

      // Store OAuth2 client for token refresh operations
      this.oauth2Client = oauth2Client;

      // Create Gmail API client
      try {
        this.gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
      } catch (clientError) {
        console.error(`❌ Error creating Gmail API client: ${clientError.message}`);
        if (clientError.stack) {
          console.error(`   Stack: ${clientError.stack}`);
        }
        return false;
      }

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
      // Test by getting user profile
      await this.gmailClient.users.getProfile({ userId: 'me' });
      return true;
    } catch (error) {
      console.error(`❌ Gmail API verification failed: ${error.message}`);

      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        const errorMessage = errorData?.error?.message || error.message;
        const errorCode = errorData?.error?.code;

        if (status === 401) {
          console.error('   Authentication failed (401 Unauthorized)');

          // Check for specific OAuth2 errors
          if (errorMessage.includes('invalid_grant')) {
            console.error('   ❌ Invalid grant error detected. Common causes:');
            console.error('      1. Redirect URI mismatch - ensure emailService.js uses the same redirect URI as generateGmailRefreshToken.js');
            console.error('      2. Refresh token was generated with different OAuth2 credentials (Client ID/Secret)');
            console.error('      3. Refresh token has been revoked or expired');
            console.error('      4. OAuth2 client credentials were regenerated in Google Cloud Console');
            console.error('   💡 Solution: Regenerate refresh token using scripts/generateGmailRefreshToken.js');
            console.error(`   📋 Current redirect URI: http://localhost:3000/oauth2callback`);
          } else if (errorMessage.includes('invalid_token')) {
            console.error('   ❌ Invalid token - refresh token may be corrupted or revoked');
            console.error('   💡 Solution: Regenerate refresh token using scripts/generateGmailRefreshToken.js');
          } else {
            console.error('   ❌ Refresh token may be invalid or expired');
            console.error('   💡 Solution: Regenerate refresh token using scripts/generateGmailRefreshToken.js');
          }

          if (errorCode) {
            console.error(`   📋 Error code: ${errorCode}`);
          }
        } else if (status === 403) {
          console.error('   ❌ Access denied (403 Forbidden)');
          console.error('   Common causes:');
          console.error('      1. Gmail API is not enabled in Google Cloud Console');
          console.error('      2. OAuth2 scopes do not include: https://www.googleapis.com/auth/gmail.send');
          console.error('      3. OAuth consent screen is not properly configured');
          console.error('   💡 Solution: Check Google Cloud Console API settings and OAuth2 scopes');
        } else if (status === 400) {
          console.error(`   ❌ Bad request (400): ${errorMessage}`);
          console.error('   💡 Check that all OAuth2 credentials are correctly configured');
        } else {
          console.error(`   ❌ HTTP ${status}: ${errorMessage}`);
        }
      } else {
        // Network or other errors
        console.error('   ❌ Network or connection error');
        console.error(`   📋 Error details: ${error.message}`);
        if (error.code) {
          console.error(`   📋 Error code: ${error.code}`);
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

    // Check if email service is configured
    if (!this.isConfigured) {
      console.warn('⚠️  Email service not configured. Skipping welcome email.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { name, email, office, accessLevel } = userData;

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
        }, startTime);
      } else if (this.emailMethod === 'smtp' && this.transporter) {
        return await this.sendViaSMTP({
          from: `"${fromName}" <${fromEmail}>`,
          to: email,
          subject: 'Welcome to LVCampusConnect System',
          html: htmlContent,
          text: textContent
        }, startTime);
      } else {
        throw new Error(`Email method "${this.emailMethod}" not properly initialized`);
      }
    } catch (error) {
      console.error(`❌ Error sending welcome email: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email via Gmail API (works on Render)
   * Includes automatic token refresh retry logic
   */
  async sendViaGmailAPI(mailOptions, startTime) {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Retrying Gmail API send (attempt ${attempt + 1}/${maxRetries + 1})`);
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

        console.log(`✅ Welcome email sent via Gmail API to: ${mailOptions.to}`);

        return { success: true, messageId: response.data.id };
      } catch (error) {
        // Check if error is due to expired/invalid token (401 Unauthorized)
        const isUnauthorized = error.response && error.response.status === 401;
        const canRetry = attempt < maxRetries && isUnauthorized && this.oauth2Client;

        if (isUnauthorized && canRetry) {
          console.warn('🔄 Gmail API authentication failed (401), refreshing token...');

          try {
            // Force token refresh by getting a new access token
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            this.oauth2Client.setCredentials(credentials);

            // Update Gmail client with refreshed credentials
            this.gmailClient = google.gmail({ version: 'v1', auth: this.oauth2Client });

            attempt++;
            continue; // Retry the send
          } catch (refreshError) {
            console.error(`❌ Token refresh failed: ${refreshError.message}`);

            // Provide detailed diagnostics for refresh errors
            if (refreshError.response) {
              const refreshStatus = refreshError.response.status;
              const refreshData = refreshError.response.data;
              const refreshMessage = refreshData?.error?.message || refreshError.message;
              const refreshCode = refreshData?.error?.code;

              if (refreshMessage.includes('invalid_grant')) {
                console.error('   ❌ Invalid grant error during token refresh:');
                console.error('      This usually means:');
                console.error('      1. Redirect URI mismatch - ensure emailService.js uses: http://localhost:3000/oauth2callback');
                console.error('      2. Refresh token was generated with different OAuth2 credentials');
                console.error('      3. Refresh token has been revoked or expired');
                console.error('      4. OAuth2 client credentials were regenerated in Google Cloud Console');
                console.error('   💡 Solution: Regenerate refresh token using scripts/generateGmailRefreshToken.js');
              } else {
                console.error(`   📋 Refresh error details: ${refreshMessage}`);
                if (refreshCode) {
                  console.error(`   📋 Error code: ${refreshCode}`);
                }
              }
            }
            // Fall through to error handling
          }
        }

        // Log error information
        console.error(`❌ Gmail API send failed: ${error.message}`);
        if (error.response) {
          const status = error.response.status;
          const errorData = error.response.data;
          const errorMessage = errorData?.error?.message || error.message;
          const errorCode = errorData?.error?.code;

          if (status === 401) {
            let errorMsg = 'Gmail API authentication failed. ';
            if (errorMessage.includes('invalid_grant')) {
              errorMsg += 'Invalid grant error - redirect URI mismatch or refresh token issue. ';
              errorMsg += 'Ensure emailService.js uses redirect URI: http://localhost:3000/oauth2callback. ';
            }
            errorMsg += 'Regenerate refresh token using scripts/generateGmailRefreshToken.js';
            throw new Error(errorMsg);
          } else if (status === 403) {
            throw new Error('Gmail API access denied. Check Gmail API is enabled and OAuth2 scopes include gmail.send');
          } else if (status === 400) {
            const detailedMsg = errorMessage || error.message;
            throw new Error(`Gmail API request invalid: ${detailedMsg}`);
          } else {
            throw new Error(`Gmail API error (${status}): ${errorMessage || error.message}`);
          }
        }

        throw error;
      }
    }
  }

  /**
   * Send email via SMTP (works locally, may fail on Render)
   */
  async sendViaSMTP(mailOptions, startTime) {
    try {
      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      console.log(`✅ Welcome email sent via SMTP to: ${mailOptions.to}`);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ SMTP send failed: ${error.message}`);

      // Provide helpful error message for Render deployments
      if (error.code === 'ETIMEDOUT' && error.command === 'CONN') {
        const helpfulMessage = `${error.message}. Render blocks SMTP ports (25, 587, 465). Use Gmail API instead.`;
        console.error(`   ${helpfulMessage}`);
        throw new Error(helpfulMessage);
      }

      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
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
const emailService = new EmailService();

module.exports = emailService;

