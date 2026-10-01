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
  {
    key: "meta",
    title: "Gestão de tráfego no Meta Ads",
    text: "Campanhas no Facebook e no Instagram estruturadas por objetivo, público e funil — de apresentação da marca até a decisão de compra — com otimização contínua orientada a custo por resultado.",
    points: [
      "Estrutura de campanha por objetivo, público e estágio do funil",
      "Otimização contínua orientada a custo por resultado",
      "Criativos e textos planejados junto à sua operação",
      "Acompanhamento completo pelo NEX Ads, em tempo real",
    ],
    msg: messages.meta,
  },
  {
    key: "google",
    title: "Google Ads",
    text: "Presença na busca no momento exato em que o cliente procura pelo que você vende, cobrindo Pesquisa, Performance Max, YouTube e remarketing — cada formato no papel certo dentro da estratégia.",
    points: [
      "Pesquisa, Performance Max, YouTube e remarketing em uma só estratégia",
      "Estrutura de palavras-chave com negativação contínua",
      "Anúncios alinhados à intenção de busca do cliente",
      "Leitura clara de custo por resultado por canal e por campanha",
    ],
    msg: messages.google,
  },
  {
    key: "whatsapp",
    title: "Disparos via WhatsApp",
    text: "Comunicação em escala pelo canal que o brasileiro mais usa, com segmentação da base e mensagens personalizadas por perfil — conectando a campanha ao atendimento real da sua empresa.",
    points: [
      "Envio em escala com segmentação da sua base",
      "Mensagens personalizadas por perfil de cliente",
      "Integração com sistemas, planilhas e CRM que você já usa",
      "Envios alinhados às políticas do WhatsApp",
    ],
    msg: messages.whatsapp,
  },
  {
    key: "systems",
    title: "Desenvolvimento de sistemas",
    text: "Sistemas web sob medida para organizar processos comerciais, integrar ferramentas e transformar dados dispersos em visibilidade real da operação — construídos por quem entende de tecnologia desde 2006.",
    points: [
      "Levantamento dos processos e requisitos do seu negócio",
      "Painéis, portais e integradores desenvolvidos sob medida",
      "Integração com as ferramentas que sua empresa já usa",
      "Evolução contínua, com segurança e dados sob controle",
    ],
    msg: messages.systems,
  },
  {
    key: "ai",
    title: "Automação e Inteligência Artificial",
    text: "Fluxos automatizados e assistentes com IA para atender, qualificar e acompanhar leads sem depender de tarefas manuais — reduzindo tempo de resposta e fazendo o investimento render mais.",
    points: [
      "Atendimento inicial e qualificação de leads automatizados",
      "Fluxos de follow-up e retomada de base parada",
      "Assistentes de IA treinados com o contexto do seu negócio",
      "Integração com WhatsApp, sistemas e canais de venda",
    ],
    msg: messages.ai,
  },
  {
    key: "sites",
    title: "Sites e landing pages",
    text: "Páginas rápidas, claras e pensadas para conversão — a base técnica que faz o investimento em mídia render mais, desde o primeiro clique até o contato no WhatsApp.",
    points: [
      "Páginas rápidas e claras, pensadas para conversão",
      "Estrutura pronta para receber tráfego pago desde o dia 1",
      "Rastreamento e eventos configurados desde o início",
      "Manutenção e evolução contínuas do site",
    ],
    msg: messages.sites,
  },
] as const;

export const faq = [
  { q: "A NEX é apenas uma agência de tráfego?", a: "Não. Atuamos em tráfego pago, mas também desenvolvemos sistemas, sites, automações e soluções com IA. Isso permite cuidar tanto da aquisição de clientes quanto da tecnologia que sustenta sua operação comercial." },
  { q: "Desde quando a NEX atua no mercado?", a: "Atuamos no mercado de tecnologia desde 2006." },
  { q: "Em quais plataformas de anúncio vocês trabalham?", a: "Meta Ads (Facebook e Instagram) e Google Ads, além de comunicação via WhatsApp." },
  { q: "O que é o NEX Ads?", a: "É a plataforma própria da NEX onde o cliente acompanha os resultados das suas campanhas, saldo de mídia, financeiro e criativos em um só lugar, com transparência." },
  { q: "Vocês desenvolvem sistemas sob medida?", a: "Sim. Desenvolvemos sistemas web, integrações e automações de acordo com a necessidade do seu negócio." },
  { q: "Como começo?", a: "Basta chamar no WhatsApp. Um especialista entende o seu momento e indica o melhor caminho — sem formulário e sem cadastro." },
] as const;
