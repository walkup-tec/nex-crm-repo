export const inviteSubject = "Seja bem-vindo a Agência NEX";
export const invitePasswordButton = "CRIAR MINHA SENHA";

export function inviteAccessLink(appBase: string, email: string) {
  const base = appBase.replace(/\/$/, "");
  return `${base}/primeiro-acesso?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

export function inviteHello(name: string) {
  const displayName = name.trim();
  return displayName ? `Olá, ${displayName}!` : "Olá!";
}

export function inviteParagraphs(name: string, email: string) {
  return [
    inviteHello(name),
    "Seja bem-vindo a Agência NEX.",
    "Seu acesso à nossa plataforma foi criado e já está quase tudo pronto para você começar.",
    "Na NEX, você poderá acompanhar de forma simples e centralizada os principais indicadores e resultados das suas campanhas, facilitando a análise do desempenho dos seus anúncios.",
    "Para concluir a ativação da sua conta, clique no botão abaixo e crie sua senha de acesso.",
    "Após definir sua senha, você poderá acessar normalmente a plataforma utilizando seu e-mail cadastrado.",
    `Seu acesso: ${email.trim()}`,
    "Se você não reconhece este cadastro ou acredita que recebeu este e-mail por engano, entre em contato com nossa equipe.",
    "Até logo,\nEquipe NEX\nDados claros. Decisões melhores.",
  ];
}

export function invitePlainText(name: string, email: string, link: string) {
  const paragraphs = inviteParagraphs(name, email);
  const activate = paragraphs[4] ?? "";
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (lines.length) lines.push("");
    if (paragraph === activate) {
      lines.push(paragraph, "", invitePasswordButton, link);
      continue;
    }
    lines.push(paragraph);
  }
  return lines.join("\n");
}

export function inviteWhatsappDescription(name: string, email: string) {
  return inviteParagraphs(name, email).join("\n\n");
}
