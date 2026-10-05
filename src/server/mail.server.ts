import nodemailer from "nodemailer";

function smtpConfig() {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASSWORD"];
  const port = Number(process.env["SMTP_PORT"] || 465);
  const from = process.env["SMTP_FROM"] || user;
  if (!host || !user || !pass || !from) return null;
  return { host, user, pass, port, from };
}

export function appUrl() {
  return (process.env["APP_URL"] || "https://app.nexmeta.com.br").replace(/\/$/, "");
}

export async function sendInviteEmail(to: string, name: string, link: string) {
  const smtp = smtpConfig();
  if (!smtp) {
    throw new Error("O envio de e-mail não está configurado no servidor.");
  }
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  const greeting = name.trim() ? `Olá, ${name.trim()}.` : "Olá.";
  const safeName = escapeHtml(greeting);
  const safeLink = escapeHtml(link);
  await transporter.sendMail({
    from: smtp.from,
    to,
    subject: "Seu acesso ao NEX Ads",
    text: `${greeting}\n\nVocê recebeu um acesso ao NEX Ads. Defina sua senha neste link:\n${link}\n\nSe você não esperava este e-mail, ignore a mensagem.`,
    html: `<p>${safeName}</p><p>Você recebeu um acesso ao NEX Ads. Defina sua senha neste link:</p><p><a href="${safeLink}">${safeLink}</a></p><p>Se você não esperava este e-mail, ignore a mensagem.</p>`,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
