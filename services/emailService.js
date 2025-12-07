const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

// Create email transporter for sending
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Send email to a vendor
 */
async function sendEmail(to, subject, body, attachments = []) {
  const transporter = createTransporter();
  
  try {
    const mailOptions = {
      from: `"RFP Management System" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
      attachments: attachments.map(att => ({
        filename: att.filename,
        path: att.path
      }))
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send RFP to multiple vendors
 */
async function sendRFPToVendors(vendors, subject, body) {
  const results = [];
  
  for (const vendor of vendors) {
    const result = await sendEmail(vendor.email, subject, body);
    results.push({
      vendorId: vendor._id,
      vendorName: vendor.name,
      email: vendor.email,
      ...result
    });
  }
  
  return results;
}

/**
 * Create IMAP connection for receiving emails
 */
function createImapConnection() {
  return new Imap({
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.EMAIL_HOST || 'imap.gmail.com',
    port: process.env.EMAIL_PORT || 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });
}

/**
 * Fetch new emails from inbox
 */
async function fetchNewEmails(sinceDate = null) {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection();
    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for unseen emails
        const searchCriteria = ['UNSEEN'];
        if (sinceDate) {
          searchCriteria.push(['SINCE', sinceDate]);
        }

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (results.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          const fetch = imap.fetch(results, { 
            bodies: '',
            markSeen: true 
          });

          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              simpleParser(stream, (err, parsed) => {
                if (err) {
                  console.error('Error parsing email:', err);
                  return;
                }

                emails.push({
                  subject: parsed.subject,
                  from: parsed.from?.text || '',
                  fromAddress: parsed.from?.value?.[0]?.address || '',
                  to: parsed.to?.text || '',
                  date: parsed.date,
                  text: parsed.text,
                  html: parsed.html,
                  attachments: parsed.attachments?.map(att => ({
                    filename: att.filename,
                    contentType: att.contentType,
                    size: att.size,
                    content: att.content
                  })) || []
                });
              });
            });
          });

          fetch.once('error', (err) => {
            reject(err);
          });

          fetch.once('end', () => {
            imap.end();
          });
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.once('end', () => {
      // Give time for all emails to be parsed
      setTimeout(() => resolve(emails), 1000);
    });

    imap.connect();
  });
}

/**
 * Check for vendor responses to a specific RFP
 */
async function checkForVendorResponses(rfpId, vendorEmails, sinceDate) {
  try {
    const emails = await fetchNewEmails(sinceDate);
    
    // Filter emails from known vendors
    const vendorResponses = emails.filter(email => {
      const fromEmail = email.fromAddress.toLowerCase();
      return vendorEmails.some(ve => ve.toLowerCase() === fromEmail);
    });

    return {
      success: true,
      responses: vendorResponses
    };
  } catch (error) {
    console.error('Error checking for vendor responses:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendEmail,
  sendRFPToVendors,
  fetchNewEmails,
  checkForVendorResponses
};

