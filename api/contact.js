/**
 * API Route: Contact & Support Email Handler
 * Dra. Odette Noyola — Ginecología y Medicina Materno Fetal
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const DATA_FILE = path.join(__dirname, '..', 'data', 'contact_messages.json');

// In-memory rate limiting (max 5 submissions per 15 minutes per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return false;
  }
  if (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  entry.count++;
  return false;
}

// Clean up old rate limit entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 30 * 60 * 1000);

// Helper: Save message to local JSON backup
function saveMessageBackup(messageData) {
  try {
    let messages = [];
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      messages = JSON.parse(raw || '[]');
    }
    messages.unshift(messageData);
    // Keep last 500 messages
    if (messages.length > 500) messages = messages.slice(0, 500);
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Contact Backup Error]:', err.message);
  }
}

// Helper: Create transporter from environment variables
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null; // Not configured yet
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });
}

/**
 * POST /api/contact
 * Receives contact and support form submissions
 */
router.post('/', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Rate limiting check
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Has enviado demasiados mensajes recientemente. Por favor espera unos minutos o comunícate vía WhatsApp.'
    });
  }

  const { name, email, phone, service, message, _hp } = req.body;

  // Honeypot check (anti-bot)
  if (_hp) {
    // Silently succeed for bots
    return res.json({ success: true, message: 'Mensaje recibido correctamente.' });
  }

  // Input Validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Por favor ingresa un nombre válido.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Por favor ingresa un correo electrónico válido.' });
  }

  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({ success: false, error: 'Por favor ingresa un mensaje descriptivo.' });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone ? phone.trim() : 'No proporcionado';
  const cleanService = service ? service.trim() : 'Consulta General / Soporte';
  const cleanMessage = message.trim();
  const timestamp = new Date().toISOString();

  const record = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp,
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    service: cleanService,
    message: cleanMessage,
    ip: clientIp,
    status: 'received'
  };

  // 1. Always save to local backup
  saveMessageBackup(record);

  // 2. Try sending via SMTP email
  const transporter = getTransporter();
  const recipientEmail = process.env.CONTACT_EMAIL || 'contacto@draodettenoyola.com';

  if (!transporter) {
    console.log(`[Contact API] Mensaje recibido de ${cleanName} (${cleanEmail}). Almacenado en backup local. (Para entrega en buzón, configurar SMTP_USER y SMTP_PASS en .env).`);
    return res.json({
      success: true,
      message: '¡Tu mensaje ha sido recibido con éxito! La Dra. Odette o su equipo se pondrán en contacto contigo a la brevedad.'
    });
  }

  const mailOptions = {
    from: `"Web Dra. Odette Noyola" <${process.env.SMTP_USER}>`,
    replyTo: `"${cleanName}" <${cleanEmail}>`,
    to: recipientEmail,
    subject: `[Contacto Web] ${cleanService} — ${cleanName}`,
    text: `
Nuevo mensaje de contacto desde draodettenoyola.com
--------------------------------------------------
Nombre: ${cleanName}
Correo: ${cleanEmail}
Teléfono: ${cleanPhone}
Motivo / Servicio: ${cleanService}
Fecha: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}

Mensaje:
${cleanMessage}
    `,
    html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #0f766e; margin: 0 0 6px;">Nuevo Mensaje de Contacto</h2>
        <p style="color: #64748b; font-size: 14px; margin: 0;">draodettenoyola.com · Atención y Soporte</p>
      </div>

      <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <p style="margin: 0 0 10px; font-size: 15px;"><strong>Paciente / Remitente:</strong> ${cleanName}</p>
        <p style="margin: 0 0 10px; font-size: 15px;"><strong>Correo electrónico:</strong> <a href="mailto:${cleanEmail}" style="color: #0d9488;">${cleanEmail}</a></p>
        <p style="margin: 0 0 10px; font-size: 15px;"><strong>Teléfono / WhatsApp:</strong> <a href="tel:${cleanPhone}" style="color: #0d9488;">${cleanPhone}</a></p>
        <p style="margin: 0 0 10px; font-size: 15px;"><strong>Asunto / Servicio:</strong> <span style="background: #ccfbf1; color: #115e59; padding: 3px 8px; border-radius: 6px; font-weight: 600;">${cleanService}</span></p>
        <p style="margin: 0; font-size: 13px; color: #94a3b8;"><strong>Fecha y Hora:</strong> ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</p>
      </div>

      <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h4 style="margin: 0 0 10px; color: #1e293b; font-size: 15px;">Mensaje de la paciente:</h4>
        <div style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-wrap; background: #f1f5f9; padding: 14px; border-radius: 8px;">${cleanMessage}</div>
      </div>

      <div style="text-align: center; margin-top: 20px;">
        <a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(cleanName)}%2C%20recibimos%20tu%20mensaje%20en%20el%20consultorio%20de%20la%20Dra.%20Odette%20Noyola" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; font-weight: bold; padding: 10px 20px; border-radius: 9999px; margin-right: 10px; font-size: 14px;">Responder por WhatsApp</a>
        <a href="mailto:${cleanEmail}?subject=Re:%20Contacto%20Dra.%20Odette%20Noyola" style="display: inline-block; background-color: #0d9488; color: #ffffff; text-decoration: none; font-weight: bold; padding: 10px 20px; border-radius: 9999px; font-size: 14px;">Responder por Correo</a>
      </div>

      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;">
        Este correo fue generado automáticamente a través del formulario de contacto del sitio web.
      </div>
    </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Contact API] Correo enviado exitosamente a ${recipientEmail} para ${cleanName}`);
    return res.json({
      success: true,
      message: '¡Tu mensaje ha sido enviado con éxito! Nos comunicaremos contigo a la brevedad.'
    });
  } catch (mailErr) {
    console.error('[Contact API Mail Error]:', mailErr.message);
    // Even if SMTP failed, the message was preserved in JSON backup
    return res.json({
      success: true,
      message: '¡Tu mensaje ha sido registrado exitosamente en el consultorio! Nos comunicaremos contigo pronto.'
    });
  }
});

module.exports = router;
