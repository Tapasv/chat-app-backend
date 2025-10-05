const nodemailer = require('nodemailer')

const sendEmail = async (to, subject, html) => {
    try {
        console.log('📧 Creating email transporter...');
        console.log('📧 EMAIL_USER:', process.env.EMAIL_USER);
        console.log('📧 EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
        
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // use TLS
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            },
            // Add these for better connection handling on Render
            connectionTimeout: 10000, // 10 seconds
            greetingTimeout: 10000,
            socketTimeout: 10000
        });

        console.log('✅ Verifying transporter connection...');
        await transporter.verify();
        console.log('✅ Transporter verified successfully!');

        const mailOptions = {
            from: `"Chatify Support" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        };

        console.log('📤 Sending email to:', to);
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log('📊 Message ID:', info.messageId);
        
        return info;
        
    } catch (error) {
        console.error('❌ SendEmail Error:', error.message);
        console.error('❌ Error code:', error.code);
        
        if (error.response) {
            console.error('❌ SMTP Response:', error.response);
        }
        
        throw error;
    }
}

module.exports = sendEmail