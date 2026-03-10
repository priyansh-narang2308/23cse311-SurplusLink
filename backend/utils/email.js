import { EmailClient } from "@azure/communication-email";

/**
 * Sends an email using Azure Email Communication Services.
 * @param {Object} options - Email options (email, subject, message, html)
 */
const sendEmail = async (options) => {
  // Check for configuration
  if (process.env.NODE_ENV === 'test' || !process.env.AZURE_EMAIL_CONNECTION_STRING) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Email Service] AZURE_EMAIL_CONNECTION_STRING is not defined. Skipping real email send.');
    }
    console.log(`[Email Mock] To: ${options.email}, Subject: ${options.subject}`);
    return { mock: true, to: options.email, subject: options.subject };
  }

  console.log(`[Email Service] Attempting to send email to: ${options.email}`);

  try {
    const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;
    const client = new EmailClient(connectionString);

    const emailMessage = {
      senderAddress: process.env.AZURE_EMAIL_SENDER || 'DoNotReply@your-domain.azurecomm.net',
      content: {
        subject: options.subject,
        plainText: options.message,
        html: options.html,
      },
      recipients: {
        to: [{ address: options.email }],
      },
    };

    console.log(`[Email Service] Sending via Azure Communication Services...`);
    
    const poller = await client.beginSend(emailMessage);
    const result = await poller.pollUntilDone();

    if (result && result.id) {
      console.log(`[Email Service] SUCCESS: Message sent to ${options.email} (ID: ${result.id})`);
      return result;
    } else {
      throw new Error('Email send operation completed but no message ID was returned.');
    }
  } catch (error) {
    console.error(`[Email Service] FAILURE: Could not send email to ${options.email}`);
    console.error(`[Email Service] Error Name: ${error.name}`);
    console.error(`[Email Service] Error Message: ${error.message}`);
    
    // Fallback info for common Azure errors could be added here
    if (error.message && error.message.includes('AccessKey')) {
      console.error(`[Email Service] AUTH ERROR: Check your AZURE_EMAIL_CONNECTION_STRING`);
    }

    throw error;
  }
};

export default sendEmail;
