'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required.');
    }
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, code) {
  await getTransporter().sendMail({
    from: `"ForexAI Terminal" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Verify your ForexAI account',
    html: `
      <div style="background:#060614;padding:40px;font-family:sans-serif;color:#fff;border-radius:12px">
        <h2 style="color:#a78bfa">ForexAI Terminal</h2>
        <p>Your verification code is:</p>
        <h1 style="color:#38bdf8;font-size:48px;letter-spacing:8px">${code}</h1>
        <p style="color:#64748b">This code expires in 10 minutes.</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(email, code) {
  await getTransporter().sendMail({
    from: `"ForexAI Terminal" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Reset your ForexAI password',
    html: `
      <div style="background:#060614;padding:40px;font-family:sans-serif;color:#fff;border-radius:12px">
        <h2 style="color:#a78bfa">ForexAI Terminal</h2>
        <p>Your password reset code is:</p>
        <h1 style="color:#ec4899;font-size:48px;letter-spacing:8px">${code}</h1>
        <p style="color:#64748b">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, generateCode };
