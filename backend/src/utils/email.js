const nodemailer = require('nodemailer');

const isEmailConfigured = () =>
  Boolean(process.env.EMAIL_USER && (process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS));

const SEND_TIMEOUT_MS = 8000;

/**
 * Envía un correo electrónico utilizando Gmail (o el servicio definido en EMAIL_SERVICE).
 * Lanza error si el correo no está configurado o si el envío tarda más de 8 s
 * (en Vercel la función no puede quedarse colgada esperando a un SMTP lento).
 * @param {Object} options - Opciones del correo (email, subject, message, html)
 */
const sendEmail = async (options) => {
  if (!isEmailConfigured()) {
    throw new Error('Correo no configurado (EMAIL_USER / EMAIL_PASSWORD)');
  }

  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS
    },
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS
  });

  const mailOptions = {
    from: `"Indusecc SGC" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
module.exports.isEmailConfigured = isEmailConfigured;
