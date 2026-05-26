import nodemailer from 'nodemailer';
import { db } from '../db/database';

function getSettings(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM panel_settings").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function sendEmail(to: string, subject: string, html: string) {
  const s = getSettings();
  if (!s.smtp_host) return;
  try {
    const transporter = nodemailer.createTransport({
      host: s.smtp_host,
      port: parseInt(s.smtp_port) || 587,
      auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
    });
    await transporter.sendMail({ from: s.smtp_from || 'noreply@palto-network.io', to, subject, html });
  } catch (e) {
    console.error('Email error:', e);
  }
}
