import nodemailer from 'nodemailer';

export const MAIL_FROM_ADDRESS = process.env.SMTP_USER || 'info@ksvox.net';

export function getTransport() {
  if (!process.env.SMTP_PASS) throw new Error('メール送信の設定(SMTP_PASS)が未登録です。');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.lolipop.jp',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user: MAIL_FROM_ADDRESS, pass: process.env.SMTP_PASS },
  });
}

export async function sendMail({ to, bcc, subject, text }) {
  const t = getTransport();
  await t.sendMail({
    from: `"K's VOX 門弟アプリ" <${MAIL_FROM_ADDRESS}>`,
    to: to || MAIL_FROM_ADDRESS,
    bcc,
    subject,
    text,
  });
}

export const SIGNATURE = '\n\n――――――――――\nボーカル道場K\'s VOX NOBU\n※このメールは送信専用です。';
