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

export async function sendInviteEmail(to: string, name: string) {
  const smtp = smtpConfig();
  if (!smtp) {
    throw new Error("O envio de e-mail não está configurado no servidor.");
  }
  const displayName = name.trim();
  const hello = displayName ? `Olá, ${displayName}!` : "Olá!";
  const link = `${appUrl()}/primeiro-acesso?email=${encodeURIComponent(to)}`;
  const safeHello = escapeHtml(hello);
  const safeEmail = escapeHtml(to);
  const safeLink = escapeHtml(link);
  const text = [
    hello,
    "",
    "Seja bem-vindo ao NEX.",
    "",
    "Seu acesso à nossa plataforma foi criado e já está quase tudo pronto para você começar.",
    "",
    "No NEX, você poderá acompanhar de forma simples e centralizada os principais indicadores e resultados das suas campanhas, facilitando a análise do desempenho dos seus anúncios.",
    "",
    "Para concluir a ativação da sua conta, clique no botão abaixo e crie sua senha de acesso.",
    "",
    "CRIAR MINHA SENHA",
    link,
    "",
    "Após definir sua senha, você poderá acessar normalmente a plataforma utilizando seu e-mail cadastrado.",
    "",
    `Seu acesso: ${to}`,
    "",
    "Se você não reconhece este cadastro ou acredita que recebeu este e-mail por engano, entre em contato com nossa equipe.",
    "",
    "Até logo,",
    "Equipe NEX",
    "Dados claros. Decisões melhores.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;font-size:16px">
      <p>${safeHello}</p>
      <p>Seja bem-vindo ao NEX.</p>
      <p>Seu acesso à nossa plataforma foi criado e já está quase tudo pronto para você começar.</p>
      <p>No NEX, você poderá acompanhar de forma simples e centralizada os principais indicadores e resultados das suas campanhas, facilitando a análise do desempenho dos seus anúncios.</p>
      <p>Para concluir a ativação da sua conta, clique no botão abaixo e crie sua senha de acesso.</p>
      <p style="margin:28px 0">
        <a href="${safeLink}" style="display:inline-block;background:#5b21b6;color:#ffffff;text-decoration:none;font-weight:700;letter-spacing:.04em;padding:14px 22px;border-radius:8px">CRIAR MINHA SENHA</a>
      </p>
      <p>Após definir sua senha, você poderá acessar normalmente a plataforma utilizando seu e-mail cadastrado.</p>
      <p><strong>Seu acesso:</strong> ${safeEmail}</p>
      <p>Se você não reconhece este cadastro ou acredita que recebeu este e-mail por engano, entre em contato com nossa equipe.</p>
      <p>Até logo,<br>Equipe NEX<br>Dados claros. Decisões melhores.</p>
    </div>
  `;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  try {
    await transporter.sendMail({
      from: smtp.from,
      to,
      subject: "Seja bem-vindo ao NEX",
      text,
      html,
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "error";
    console.error("smtp_send", code);
    const failure = new Error("Não foi possível enviar o e-mail de acesso.");
    failure.name = "InviteMailError";
    throw failure;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
