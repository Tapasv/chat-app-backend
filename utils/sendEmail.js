const nodemailer = require('nodemailer')

const sendEmail = async (to, subject, html) => {
    try {
        console.log('📧 Creating Brevo email transporter...');
        console.log('📧 EMAIL_USER:', process.env.EMAIL_USER);
        console.log('📧 BREVO_SMTP_KEY exists:', !!process.env.BREVO_SMTP_KEY);
        
        const transporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.BREVO_SMTP_KEY
            }
        });

        console.log('✅ Verifying Brevo connection...');
        await transporter.verify();
        console.log('✅ Brevo connection verified!');

        const mailOptions = {
            from: `"Chatify Support" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        };

        console.log('📤 Sending email via Brevo to:', to);
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log('📊 Message ID:', info.messageId);
        
        return info;
        
    } catch (error) {
        console.error('❌ Brevo Email Error:', error.message);
        console.error('❌ Error code:', error.code);
        
        if (error.response) {
            console.error('❌ SMTP Response:', error.response);
        }
        
        throw error;
    }
}

module.exports = sendEmail