const brevo = require('@getbrevo/brevo');

const sendEmail = async (to, subject, html) => {
    try {
        console.log('📧 Initializing Brevo API...');
        console.log('📧 Sending to:', to);
        console.log('📧 From:', process.env.EMAIL_USER);
        console.log('📧 API Key exists:', !!process.env.BREVO_API_KEY);

        // Initialize API client
        const apiInstance = new brevo.TransactionalEmailsApi();
        
        // Set API key
        apiInstance.setApiKey(
            brevo.TransactionalEmailsApiApiKeys.apiKey,
            process.env.BREVO_API_KEY
        );

        // Prepare email data
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;
        sendSmtpEmail.sender = { 
            name: "Chatify Support", 
            email: process.env.EMAIL_USER 
        };
        sendSmtpEmail.to = [{ email: to }];

        console.log('📤 Sending email via Brevo API...');
        
        // Send email
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        
        console.log('✅ Email sent successfully!');
        console.log('📊 Message ID:', data.messageId);
        
        return data;
        
    } catch (error) {
        console.error('❌ Brevo API Error:', error.message);
        console.error('❌ Error body:', error.body);
        throw error;
    }
}

module.exports = sendEmail;