import { lookup } from "node:dns/promises";
import nodemailer from "nodemailer";
import { billingNoticeEmailHtml } from "@/lib/billing-notice";
import {
  inviteAccessLink,
  inviteParagraphs,
  invitePasswordButton,
  invitePlainText,
  inviteSubject,
} from "@/lib/invite-message";

type SmtpConfig = { host: string; user: string; pass: string; port: number; from: string };

function smtpConfig(): SmtpConfig | null {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASSWORD"];
  const port = Number(process.env["SMTP_PORT"] || 465);
  const from = process.env["SMTP_FROM"] || user;
  if (!host || !user || !pass || !from) return null;
  return { host, user, pass, port, from };
}

/** SMTP exclusivo do módulo Candidatura (remetente mozart.linkedin@gmail.com). */
function careerSmtpConfig(): SmtpConfig | null {
  const host = process.env["CAREER_SMTP_HOST"]?.trim() || "smtp.gmail.com";
  const user = process.env["CAREER_SMTP_USER"]?.trim();
  const pass = (process.env["CAREER_SMTP_PASSWORD"] ?? "").replace(/\s+/g, "");
  const port = Number(process.env["CAREER_SMTP_PORT"] || 587);
  const from = process.env["CAREER_SMTP_FROM"]?.trim() || user;
  if (!user || !pass || !from) return null;
  return { host, user, pass, port, from };
}

export function appUrl() {
  return (process.env["APP_URL"] || "https://app.nexmeta.com.br").replace(/\/$/, "");
}

export async function sendInviteEmail(to: string, name: string) {
  const link = inviteAccessLink(appUrl(), to);
  await sendSmtp(
    {
      to,
      subject: inviteSubject,
      text: invitePlainText(name, to, link),
      html: inviteHtml(name, to, link),
    },
    "Não foi possível enviar o e-mail de acesso.",
  );
}

export async function sendBillingNoticeEmail(input: {
  to: string;
  subject: string;
  text: string;
  imagePng: Uint8Array;
}) {
  const to = input.to.trim();
  if (!to.includes("@")) return { ok: false, error: "Cliente sem e-mail para a cobrança." };
  try {
    await sendSmtp(
      {
        to,
        subject: input.subject,
        text: input.text,
        html: billingNoticeEmailHtml(input.text),
        attachments:
          input.imagePng.byteLength > 0
            ? [
                {
                  filename: "cobranca.png",
                  content: Buffer.from(input.imagePng),
                  cid: "cobranca@nex",
                  contentType: "image/png",
                },
              ]
            : undefined,
      },
      "Não foi possível enviar o e-mail da cobrança.",
    );
    return { ok: true, error: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível enviar o e-mail da cobrança.";
    return { ok: false, error: message };
  }
}

type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
};

async function sendSmtp(
  input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments?: MailAttachment[];
  },
  fallback: string,
  smtpOverride?: SmtpConfig | null,
) {
  const smtp = smtpOverride === undefined ? smtpConfig() : smtpOverride;
  if (!smtp) {
    const failure = new Error("O envio de e-mail não está configurado no servidor.");
    failure.name = "InviteMailError";
    throw failure;
  }
  let address = smtp.host;
  try {
    address = (await lookup(smtp.host, { family: 4 })).address;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "error";
    console.error("smtp_dns", code);
    const failure = new Error("O servidor de e-mail não aceitou a conexão.");
    failure.name = "InviteMailError";
    throw failure;
  }
  const attachmentBytes = (input.attachments ?? []).reduce((sum, file) => sum + file.content.byteLength, 0);
  // Gmail ~25MB na mensagem; base64 infla ~33%. Anexos grandes travam o SMTP sem erro limpo.
  if (attachmentBytes > 8 * 1024 * 1024) {
    const failure = new Error(
      `Anexo de e-mail grande demais (${Math.round(attachmentBytes / (1024 * 1024))} MB). Use PDF até ~8 MB.`,
    );
    failure.name = "InviteMailError";
    throw failure;
  }
  const heavy = attachmentBytes > 512 * 1024;
  const transporter = nodemailer.createTransport({
    host: address,
    port: smtp.port,
    secure: smtp.port === 465,
    requireTLS: smtp.port === 587,
    connectionTimeout: heavy ? 30000 : 15000,
    greetingTimeout: heavy ? 30000 : 15000,
    socketTimeout: heavy ? 90000 : 20000,
    auth: { user: smtp.user, pass: smtp.pass },
    tls: { servername: smtp.host },
  });
  try {
    await transporter.sendMail({
      from: smtp.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "error";
    const responseCode = error && typeof error === "object" && "responseCode" in error ? Number(error.responseCode) : 0;
    console.error("smtp_send", code, Number.isFinite(responseCode) ? responseCode : 0, `attach_bytes=${attachmentBytes}`);
    const failure = new Error(mailFailureMessage(code, responseCode, fallback));
    failure.name = "InviteMailError";
    throw failure;
  }
}

export async function sendCareerApplicationMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const to = input.to.trim();
  if (!to.includes("@")) {
    const failure = new Error("Informe um e-mail de destino válido.");
    failure.name = "InviteMailError";
    throw failure;
  }
  const text = input.text.trim();
  if (!text) {
    const failure = new Error("A candidatura não tem corpo de e-mail para enviar.");
    failure.name = "InviteMailError";
    throw failure;
  }
  const html =
    input.html?.trim() ||
    `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;font-size:15px">${escapeHtml(text).replaceAll("\n", "<br>")}</div>`;

  const resumeName = "Curriculo_Marcelo_Mozart.pdf";
  // Preferir versão e-mail (~0,5 MB). O HD (~16 MB) estoura o Gmail em base64 e trava o envio.
  const resumeCandidates = [
    process.env["CAREER_RESUME_PATH"]?.trim(),
    join(process.cwd(), "assets", "curriculo-marcelo-mozart-email.pdf"),
    join("/app", "assets", "curriculo-marcelo-mozart-email.pdf"),
    join(process.cwd(), "assets", "curriculo-marcelo-mozart.pdf"),
    join("/app", "assets", "curriculo-marcelo-mozart.pdf"),
  ].filter(Boolean) as string[];

  let attachments: MailAttachment[] | undefined;
  let usedPath = "";
  for (const path of resumeCandidates) {
    try {
      const content = await readFile(path);
      attachments = [{ filename: resumeName, content, contentType: "application/pdf" }];
      usedPath = path;
      break;
    } catch {
      // tenta o próximo caminho
    }
  }
  if (!attachments) {
    console.error("career_resume_missing", resumeCandidates.join(" | "));
    const failure = new Error("Currículo em PDF não encontrado no servidor (assets/curriculo-marcelo-mozart-email.pdf).");
    failure.name = "InviteMailError";
    throw failure;
  }
  console.info("career_resume_attached", usedPath, `${attachments[0]?.content.byteLength ?? 0}b`);

  await sendSmtp(
    { to, subject: input.subject.trim() || "Candidatura", text, html, attachments },
    "Não foi possível enviar a candidatura por e-mail.",
    careerSmtpConfig(),
  );
  return { ok: true as const, to, from: careerSmtpConfig()?.from ?? "", attachedResume: true as const };
}

function mailFailureMessage(code: string, responseCode: number, fallback: string) {
  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) {
    return "A caixa de e-mail recusou o usuário ou a senha.";
  }
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ESOCKET") {
    return "O servidor de e-mail não aceitou a conexão.";
  }
  return fallback;
}

function inviteHtml(name: string, email: string, link: string) {
  const activate = "Para concluir a ativação da sua conta, clique no botão abaixo e crie sua senha de acesso.";
  const safeLink = escapeHtml(link);
  const blocks = inviteParagraphs(name, email).map((paragraph) => {
    const body = paragraph.startsWith("Seu acesso:")
      ? `<strong>Seu acesso:</strong> ${escapeHtml(email.trim())}`
      : escapeHtml(paragraph).replaceAll("\n", "<br>");
    const html = `<p>${body}</p>`;
    if (paragraph !== activate) return html;
    return `${html}<p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;background:#5b21b6;color:#ffffff;text-decoration:none;font-weight:700;letter-spacing:.04em;padding:14px 22px;border-radius:8px">${invitePasswordButton}</a></p>`;
  });
  return `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;font-size:16px">${blocks.join("")}</div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
