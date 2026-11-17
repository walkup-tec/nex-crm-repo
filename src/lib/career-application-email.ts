/**
 * Texto canônico de apresentação da candidatura (Marcelo Mozart).
 * Usado no envio por e-mail do painel Candidatura.
 */

export const CAREER_APPLICATION_EMAIL_TEXT = `Olá, tudo bem?

Meu nome é Marcelo Mozart, sou Gestor de Tráfego Pago Sênior, com atuação em Meta Ads, Google Ads, desenvolvimento de soluções digitais e gestão de projetos.

Tenho experiência na gestão simultânea de até 15 contas de anúncios, atendendo empresas de diferentes segmentos e administrando campanhas com investimentos mensais entre R$ 1,2 mil e R$ 20 mil.

Minha atuação vai além da gestão de campanhas, abrangendo planejamento estratégico, análise de indicadores, desenvolvimento de landing pages, implementação de Pixel e API de Conversões, além de integrações com CRM e WhatsApp.

Entre os resultados recentes, destaco um projeto no segmento de turismo, no qual alcançamos 68% de crescimento nas conversas iniciadas e redução de 28,6% no custo por conversa, após otimizações nas campanhas Meta Ads.

Gostaria de apresentar meu portfólio profissional, onde compartilho minhas competências, experiências e soluções desenvolvidas:

Portfólio: https://marcelomozart.com.br

LinkedIn: https://www.linkedin.com/in/marcelo-mozart

Estou disponível para novas oportunidades e parcerias profissionais, em modelo PJ ou freelancer, com atuação remota.

Encaminho também meu currículo em anexo para avaliação.

Fico à disposição para uma conversa e para apresentar como minha experiência pode contribuir com os resultados da sua empresa.

Atenciosamente,

Marcelo Mozart
Gestor de Tráfego Pago Sênior | Meta Ads | Google Ads
https://marcelomozart.com.br
WhatsApp Pessoal: 51 999666841`;

/** HTML com os destaques do texto original (**…**) e quebras de linha preservadas. */
export function careerApplicationEmailHtml() {
  const blocks = [
    "Olá, tudo bem?",
    "",
    "Meu nome é <strong>Marcelo Mozart</strong>, sou <strong>Gestor de Tráfego Pago Sênior</strong>, com atuação em Meta Ads, Google Ads, desenvolvimento de soluções digitais e gestão de projetos.",
    "",
    "Tenho experiência na gestão simultânea de até <strong>15 contas de anúncios</strong>, atendendo empresas de diferentes segmentos e administrando campanhas com investimentos mensais entre <strong>R$ 1,2 mil e R$ 20 mil</strong>.",
    "",
    "Minha atuação vai além da gestão de campanhas, abrangendo planejamento estratégico, análise de indicadores, desenvolvimento de landing pages, implementação de Pixel e API de Conversões, além de integrações com CRM e WhatsApp.",
    "",
    "Entre os resultados recentes, destaco um projeto no segmento de turismo, no qual alcançamos <strong>68% de crescimento nas conversas iniciadas e redução de 28,6% no custo por conversa</strong>, após otimizações nas campanhas Meta Ads.",
    "",
    "<strong>Gostaria de apresentar meu portfólio profissional</strong>, onde compartilho minhas competências, experiências e soluções desenvolvidas:",
    "",
    '<strong>Portfólio:</strong> <a href="https://marcelomozart.com.br">https://marcelomozart.com.br</a>',
    "",
    '<strong>LinkedIn:</strong> <a href="https://www.linkedin.com/in/marcelo-mozart">https://www.linkedin.com/in/marcelo-mozart</a>',
    "",
    "Estou disponível para novas oportunidades e parcerias profissionais, em modelo <strong>PJ ou freelancer, com atuação remota</strong>.",
    "",
    "Encaminho também meu currículo em anexo para avaliação.",
    "",
    "Fico à disposição para uma conversa e para apresentar como minha experiência pode contribuir com os resultados da sua empresa.",
    "",
    "Atenciosamente,",
    "",
    "<strong>Marcelo Mozart</strong><br>Gestor de Tráfego Pago Sênior | Meta Ads | Google Ads<br><a href=\"https://marcelomozart.com.br\">https://marcelomozart.com.br</a><br>WhatsApp Pessoal: 51 999666841",
  ];

  const inner = blocks
    .map((line) => {
      if (line === "") return "<br>";
      if (line.includes("<br>")) return `<p style="margin:0 0 12px">${line}</p>`;
      return `<p style="margin:0 0 12px">${line}</p>`;
    })
    .join("");

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.65;font-size:15px;max-width:640px">${inner}</div>`;
}
