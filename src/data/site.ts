export const WHATSAPP_NUMBER = "555197979224";
export const WHATSAPP_DISPLAY = "+55 51 9797-9224";

export const waLink = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const messages = {
  general: "Olá! Vim pelo site da NEX Marketing Digital e gostaria de saber mais sobre as soluções.",
  meta: "Olá! Vim pelo site da NEX e gostaria de conversar sobre gestão de tráfego no Meta Ads.",
  google: "Olá! Vim pelo site da NEX e gostaria de conversar sobre Google Ads.",
  whatsapp: "Olá! Vim pelo site da NEX e gostaria de saber mais sobre a solução de disparos via WhatsApp.",
  systems: "Olá! Vim pelo site da NEX e gostaria de conversar sobre desenvolvimento de um sistema.",
  ai: "Olá! Vim pelo site da NEX e gostaria de conversar sobre automação e IA para minha empresa.",
  sites: "Olá! Vim pelo site da NEX e gostaria de conversar sobre desenvolvimento de site ou landing page.",
} as const;

export const sections = [
  { id: "inicio", label: "Início" },
  { id: "solucoes", label: "Soluções" },
  { id: "nex-ads", label: "NEX Ads" },
  { id: "tecnologia", label: "Tecnologia" },
  { id: "sobre", label: "Sobre a NEX" },
  { id: "faq", label: "FAQ" },
  { id: "contato", label: "Fale conosco" },
] as const;

export const solutions = [
  { key: "meta", title: "Gestão de tráfego no Meta Ads", text: "Campanhas no Facebook e Instagram estruturadas por objetivo, público e funil, com otimização contínua orientada a custo por resultado.", msg: messages.meta },
  { key: "google", title: "Google Ads", text: "Presença nas buscas no momento em que o cliente procura pelo que você vende: Pesquisa, Performance Max, YouTube e remarketing.", msg: messages.google },
  { key: "whatsapp", title: "Disparos via WhatsApp", text: "Comunicação em escala com sua base pelo canal que o brasileiro mais usa, com segmentação e mensagens personalizadas.", msg: messages.whatsapp },
  { key: "systems", title: "Desenvolvimento de sistemas", text: "Sistemas web sob medida para organizar processos comerciais, integrar ferramentas e dar visibilidade aos dados da operação.", msg: messages.systems },
  { key: "ai", title: "Automação e Inteligência Artificial", text: "Fluxos automatizados e assistentes com IA para atender, qualificar e acompanhar leads sem depender de tarefas manuais.", msg: messages.ai },
  { key: "sites", title: "Sites e landing pages", text: "Páginas rápidas, claras e pensadas para conversão — a base técnica que faz o investimento em mídia render mais.", msg: messages.sites },
] as const;

export const faq = [
  { q: "A NEX é apenas uma agência de tráfego?", a: "Não. Atuamos em tráfego pago, mas também desenvolvemos sistemas, sites, automações e soluções com IA. Isso permite cuidar tanto da aquisição de clientes quanto da tecnologia que sustenta sua operação comercial." },
  { q: "Desde quando a NEX atua no mercado?", a: "Atuamos no mercado de tecnologia desde 2006." },
  { q: "Em quais plataformas de anúncio vocês trabalham?", a: "Meta Ads (Facebook e Instagram) e Google Ads, além de comunicação via WhatsApp." },
  { q: "O que é o NEX Ads?", a: "É a plataforma própria da NEX onde o cliente acompanha os resultados das suas campanhas, saldo de mídia, financeiro e criativos em um só lugar, com transparência." },
  { q: "Vocês desenvolvem sistemas sob medida?", a: "Sim. Desenvolvemos sistemas web, integrações e automações de acordo com a necessidade do seu negócio." },
  { q: "Como começo?", a: "Basta chamar no WhatsApp. Um especialista entende o seu momento e indica o melhor caminho — sem formulário e sem cadastro." },
] as const;
