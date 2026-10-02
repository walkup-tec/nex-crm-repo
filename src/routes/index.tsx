import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, BarChart3, Bot, Building2, Check, Code2, Cpu, Database, Globe, HelpCircle, Home, LayoutDashboard,
  Megaphone, Menu, MessageCircle, MonitorSmartphone, Rocket, Search, ShieldCheck, Sparkles, Target, Workflow, Zap,
  Wallet, FolderOpen, Users,
} from "lucide-react";
import footerLogo from "@/assets/nex-logo-dark.png";
import metaOfficial from "@/assets/meta-official-dark.svg?url";
import googleOfficial from "@/assets/google-official-cropped.png";
import attendantAvatar from "@/assets/attendant-avatar.png";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { faq, messages, sections, solutions, waLink } from "@/data/site";

const TITLE = "NEX Marketing Digital — Marketing, tecnologia e automação desde 2006";
const DESC = "Tráfego pago no Meta Ads e Google Ads, WhatsApp, sistemas, sites e automação com IA. Performance apoiada por tecnologia e dados desde 2006.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: SitePage,
});

const navIcons = { inicio: Home, solucoes: Rocket, "nex-ads": Megaphone, tecnologia: Cpu, sobre: Building2, faq: HelpCircle, contato: MessageCircle } as const;
const solIcons = { meta: Target, google: Search, whatsapp: WhatsAppIcon, systems: Code2, ai: Bot, sites: MonitorSmartphone } as const;

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.2-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function WaButton({ msg, children, className = "" }: { msg: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={waLink(msg)} target="_blank" rel="noopener noreferrer"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-nex-gradient px-6 text-sm font-semibold text-primary-foreground shadow-brand transition hover:-translate-y-0.5 hover:brightness-110 ${className}`}>
      <WhatsAppIcon className="size-4" />{children}
    </a>
  );
}

function useActiveSection() {
  const [active, setActive] = useState("inicio");
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    const hero = document.getElementById("inicio");
    const heroObs = new IntersectionObserver(([e]) => setPastHero(!e!.isIntersecting), { threshold: 0.05 });
    if (hero) heroObs.observe(hero);
    return () => { obs.disconnect(); heroObs.disconnect(); };
  }, []);
  return { active, pastHero };
}

function SitePage() {
  const { active, pastHero } = useActiveSection();
  const [open, setOpen] = useState(false);
  return (
    <div className="site min-h-screen scroll-smooth bg-background text-foreground [&_section]:scroll-mt-20">
      {/* Header horizontal (desktop topo) / compacto (mobile) */}
      <header className={`fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-[color-mix(in_oklch,var(--surface-1)_85%,transparent)] backdrop-blur-md transition-all duration-500 ${pastHero ? "lg:pointer-events-none lg:-translate-y-full lg:opacity-0" : ""}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20">
          <a href="#inicio" aria-label="NEX Marketing Digital — início"><img src={footerLogo} alt="NEX Marketing Digital" className="h-9 w-auto object-contain lg:h-11" /></a>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={`nav-link rounded-lg px-3 py-2 text-sm font-medium transition ${active === s.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{s.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <WaButton msg={messages.general} className="hidden min-h-10 px-4 sm:inline-flex">Falar no WhatsApp</WaButton>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button className="grid size-11 place-items-center rounded-lg text-foreground lg:hidden" aria-label="Abrir menu"><Menu /></button>
              </SheetTrigger>
              <SheetContent side="right" className="site w-[85vw] max-w-sm border-border bg-background text-foreground">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <img src={footerLogo} alt="NEX Marketing Digital" className="h-9 w-auto self-start object-contain" />
                <nav className="mt-8 flex flex-col gap-1" aria-label="Menu mobile">
                  {sections.map((s) => { const I = navIcons[s.id]; return (
                    <a key={s.id} href={`#${s.id}`} onClick={() => setOpen(false)} className={`flex h-12 items-center gap-3 rounded-lg px-3 text-base font-medium ${active === s.id ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}><I className="size-5" />{s.label}</a>
                  ); })}
                </nav>
                <WaButton msg={messages.general} className="mt-6 w-full">Falar no WhatsApp</WaButton>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Barra lateral flutuante (desktop, após o hero) */}
      <nav aria-label="Navegação rápida" className={`fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border bg-[color-mix(in_oklch,var(--surface-2)_90%,transparent)] p-2 shadow-panel backdrop-blur-md transition-all duration-500 lg:flex ${pastHero ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-6 opacity-0"}`}>
        {sections.map((s) => { const I = navIcons[s.id]; const on = active === s.id; return (
          <a key={s.id} href={`#${s.id}`} aria-label={s.label} aria-current={on ? "true" : undefined} className={`group relative flex h-11 max-w-11 items-center overflow-hidden rounded-xl transition-[max-width,background-color,color] duration-300 hover:max-w-56 ${on ? "bg-nex-gradient text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            <span className="grid size-11 shrink-0 place-items-center"><I className="size-[18px]" /></span>
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 group-hover:max-w-44 group-hover:pr-4 group-hover:opacity-100 group-focus-visible:max-w-44 group-focus-visible:pr-4 group-focus-visible:opacity-100">{s.label}</span>
          </a>
        ); })}
        <div className="mx-auto my-1 h-px w-6 bg-border" />
        <a href={waLink(messages.general)} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp" className="group relative flex h-11 max-w-11 items-center overflow-hidden rounded-xl text-cyan transition-[max-width,background-color,color] duration-300 hover:max-w-56 hover:bg-secondary">
          <span className="grid size-11 shrink-0 place-items-center"><WhatsAppIcon className="size-[18px]" /></span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 group-hover:max-w-44 group-hover:pr-4 group-hover:opacity-100 group-focus-visible:max-w-44 group-focus-visible:pr-4 group-focus-visible:opacity-100">Falar no WhatsApp</span>
        </a>
      </nav>

      <main className="lg:[&_section>div]:pl-24 2xl:[&_section>div]:pl-6">
        {/* HERO */}
        <section id="inicio" className="relative overflow-hidden bg-[var(--surface-1)] pt-28 pb-20 lg:pt-40 lg:pb-32">
          <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_70%_30%,black,transparent_70%)]" aria-hidden />
          <div className="animate-drift-slow absolute -right-40 -top-40 size-[640px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,#6F02FD_35%,transparent),transparent_65%)]" aria-hidden />
          <div className="animate-drift absolute -left-32 -bottom-48 size-[520px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,#00EAFD_15%,transparent),transparent_65%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
            <Reveal>
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-accent-foreground"><Sparkles className="size-3.5" />Tecnologia e inovação desde 2006</p>
                <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                  Marketing, tecnologia e automação para transformar <span className="text-nex-gradient">investimento em clientes</span>.
                </h1>
                <p className="mt-6 max-w-xl text-lg text-muted-foreground">Unimos tráfego pago no Meta e no Google, WhatsApp, sistemas e inteligência artificial em uma operação orientada a dados — com quase duas décadas de experiência em tecnologia.</p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <WaButton msg={messages.general} className="h-14 px-7 text-base">Falar com um especialista</WaButton>
                  <a href="#solucoes" className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-border px-7 text-base font-semibold transition hover:bg-secondary">Conheça nossas soluções<ArrowRight className="size-4" /></a>
                </div>
              </div>
            </Reveal>
            <Reveal delay={140}><HeroVisual /></Reveal>
          </div>
        </section>

        {/* SOLUÇÕES */}
        <section id="solucoes" className="relative overflow-hidden bg-background py-18 lg:py-[100px]">
          <div className="absolute inset-0 bg-grid opacity-35 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead kicker="Soluções" title="Da aquisição de clientes à tecnologia que sustenta a operação" text="Cada frente conversa com a outra: a mídia gera demanda, a tecnologia organiza e a automação acelera o atendimento." />
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {solutions.map((s, i) => { const I = solIcons[s.key]; return (
                <Reveal key={s.key} delay={(i % 3) * 80} className="h-full">
                  <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-brand">
                    <div className="grid size-12 place-items-center rounded-xl bg-nex-gradient text-primary-foreground"><I className="size-5" /></div>
                    <h3 className="mt-5 font-display text-lg font-semibold">{s.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                    <div className="my-5 h-px bg-border/60" aria-hidden />
                    <ul className="flex-1 space-y-2.5">
                      {s.points.map((pt) => (
                        <li key={pt} className="flex gap-2.5 text-[13px] leading-snug"><Check className="mt-0.5 size-3.5 shrink-0 text-cyan" /><span>{pt}</span></li>
                      ))}
                    </ul>
                    <a href={waLink(s.msg)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent-foreground">Conversar sobre isso<ArrowRight className="size-4 transition group-hover:translate-x-1" /></a>
                  </article>
                </Reveal>
              ); })}
            </div>
          </div>
        </section>

        {/* NEX ADS */}
        <section id="nex-ads" className="relative overflow-hidden bg-[var(--surface-3)] py-20 lg:py-28">
          <div className="animate-drift-slow absolute inset-0 bg-[radial-gradient(ellipse_at_10%_90%,color-mix(in_oklch,#00EAFD_14%,transparent),transparent_55%)]" aria-hidden />
          <div className="animate-drift absolute -right-48 top-1/4 size-[560px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,#6F02FD_22%,transparent),transparent_65%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <Reveal>
              <div>
                <SectionHead kicker="NEX Ads" title="Transparência total sobre cada real investido" text="Nossos clientes acompanham campanhas, resultados, saldo de mídia, financeiro e criativos em uma plataforma própria, desenvolvida pela NEX." />
                <ul className="mt-8 space-y-3 text-sm">
                  {["Alcance, impressões, resultados e custo por resultado em tempo real", "Alertas de saldo de mídia antes que as campanhas parem", "Biblioteca de criativos organizada e segura", "Acesso por perfis para sua equipe"].map((t) => (
                    <li key={t} className="flex gap-3"><Zap className="mt-0.5 size-4 shrink-0 text-cyan" />{t}</li>
                  ))}
                </ul>
                <WaButton msg={messages.general} className="mt-9">Quero conhecer o NEX Ads</WaButton>
              </div>
            </Reveal>
            <Reveal delay={120}><DashboardMock /></Reveal>
          </div>
        </section>

        {/* TECNOLOGIA (área clara) */}
        <section id="tecnologia" className="site-light bg-background py-20 text-foreground lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead kicker="Tecnologia" title="Uma agência que também constrói tecnologia" text="Não dependemos apenas de ferramentas prontas. Quando sua operação precisa, desenvolvemos." />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[[Database, "Dados", "Decisões baseadas em métricas reais, não em impressão."], [Workflow, "Automação", "Processos repetitivos executados sem esforço manual."], [Bot, "IA aplicada", "Atendimento e qualificação de leads com inteligência artificial."], [Globe, "Sistemas web", "Plataformas sob medida, seguras e integradas."]].map(([I, t, d], i) => { const Icon = I as typeof Database; return (
                <Reveal key={t as string} delay={i * 70} className="h-full">
                  <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-panel transition duration-300 hover:-translate-y-1 hover:border-primary/60">
                    <Icon className="size-6 text-primary" />
                    <h3 className="mt-4 font-display text-base font-semibold">{t as string}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{d as string}</p>
                  </div>
                </Reveal>
              ); })}
            </div>
          </div>
        </section>

        {/* SOBRE */}
        <section id="sobre" className="relative overflow-hidden bg-[var(--surface-1)] py-20 lg:py-28">
          <div className="absolute inset-0 bg-grid opacity-35 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <Reveal>
              <div className="flex flex-col items-center justify-center gap-6 border-gradient rounded-3xl px-10 py-14 text-center">
                <img src={footerLogo} alt="NEX Marketing Digital" className="h-24 w-auto object-contain sm:h-28" />
                <p className="text-sm font-semibold tracking-wide text-muted-foreground sm:text-base">No mercado de tecnologia desde <span className="text-nex-gradient font-bold">2006</span></p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div>
                <SectionHead kicker="Sobre a NEX" title="Experiência em tecnologia, aplicada à performance" text="A NEX nasceu da tecnologia. Ao longo dos anos, unimos esse conhecimento técnico ao marketing digital para oferecer algo que poucas agências entregam: campanhas de mídia apoiadas por sistemas, automações e dados." />
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {[[ShieldCheck, "Segurança"], [BarChart3, "Performance"], [Sparkles, "Inovação"]].map(([I, t]) => { const Icon = I as typeof ShieldCheck; return (
                    <div key={t as string} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"><Icon className="size-4 text-cyan" />{t as string}</div>
                  ); })}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-[var(--surface-2)] py-20 lg:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHead kicker="FAQ" title="Perguntas frequentes" center />
            <div className="mt-10 space-y-3">
              {faq.map((f, i) => (
                <Reveal key={f.q} delay={(i % 5) * 60}>
                  <details className="group rounded-xl border border-border bg-card px-5 open:border-primary/50">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold">{f.q}<span className="text-xl text-muted-foreground transition group-open:rotate-45">+</span></summary>
                    <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CONTATO */}
        <section id="contato" className="relative overflow-hidden bg-[var(--surface-1)] py-20 lg:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl bg-nex-gradient p-10 text-center text-primary-foreground sm:p-16">
                <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
                <div className="animate-drift-slow absolute -left-24 -top-24 size-96 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.3),transparent_60%)]" aria-hidden />
                <div className="animate-drift absolute -bottom-40 -right-24 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(1,3,23,.4),transparent_60%)]" aria-hidden />
                <h2 className="relative font-display text-3xl font-bold sm:text-4xl">Vamos conversar sobre o crescimento da sua empresa?</h2>
                <p className="relative mx-auto mt-4 max-w-xl opacity-90">Fale direto com um especialista no WhatsApp. Sem formulário, sem cadastro.</p>
                <a href={waLink(messages.general)} target="_blank" rel="noopener noreferrer" className="cta-invert relative mt-8 inline-flex h-14 items-center gap-2.5 whitespace-nowrap rounded-xl px-7 text-[15px] font-semibold transition hover:-translate-y-0.5"><WhatsAppIcon className="size-5" />Falar com um especialista</a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-[var(--surface-1)] pt-12 pb-28 sm:pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <img src={footerLogo} alt="NEX Marketing Digital" className="h-10 w-auto object-contain" />
              <p className="text-xs text-muted-foreground">Marketing, tecnologia e automação desde 2006.</p>
            </div>
            <div className="w-full max-w-xl">
              <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground lg:text-left">Certificações e parceiros</p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_1px_1fr] sm:items-start sm:gap-8">
                <div className="group text-center">
                  <div className="mx-auto flex h-11 w-44 items-center justify-center">
                    <img src={metaOfficial} alt="Meta" className="h-full w-full object-contain" loading="lazy" />
                  </div>
                  <div className="mt-3 h-[3px] w-full bg-gradient-to-r from-[#0668E1] via-[#0072EC] to-[#0082FB] transition-all duration-500 group-hover:shadow-[0_0_18px_rgba(0,130,251,0.55)]" />
                  <div className="mt-3 space-y-1 text-sm text-foreground/90">
                    <p>Media Buying Professional</p>
                    <p>Tech Provider</p>
                  </div>
                </div>
                <div className="hidden h-24 bg-border/60 sm:block" />
                <div className="group text-center">
                  <div className="mx-auto flex h-11 w-44 items-center justify-center">
                    <img src={googleOfficial} alt="Google" className="h-full w-full object-contain" loading="lazy" />
                  </div>
                  <div className="mt-3 h-[3px] w-full bg-gradient-to-r from-[#4285f4] via-[#ea4335] to-[#fbbc05] transition-all duration-500 group-hover:shadow-[0_0_18px_color-mix(in_oklch,var(--cyan)_35%,transparent)]" />
                  <p className="mt-3 text-base text-foreground/90">Partner</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-9 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} NEX Marketing Digital. Tecnologia desde 2006.</p>
            <Link to="/auth" className="transition hover:text-foreground">Área do cliente</Link>
          </div>
        </div>
      </footer>

      {/* WhatsApp flutuante — atendente com selo */}
      <a href={waLink(messages.general)} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp com uma atendente"
        className="group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-50 flex items-center gap-2 transition-transform duration-300 hover:scale-105 active:scale-95">
        <span className="hidden opacity-0 translate-x-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-brand backdrop-blur transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 md:block">
          Falar no WhatsApp
        </span>
        <span className="relative grid size-16 place-items-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-white/90 motion-safe:animate-nex-ping" />
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-nex-gradient opacity-50 blur-md transition-opacity duration-300 group-hover:opacity-75" />
          <img src={attendantAvatar} alt="Atendente da NEX no WhatsApp" width={1024} height={1024} loading="lazy"
            className="relative size-16 rounded-full border-2 border-accent/60 object-cover shadow-brand" />
          <span className="absolute -bottom-0.5 -right-0.5 grid size-8 place-items-center rounded-full bg-nex-gradient text-primary-foreground shadow-brand ring-2 ring-background">
            <WhatsAppIcon className="size-4" />
          </span>
        </span>
      </a>
    </div>
  );
}


function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry!.isIntersecting) { setShown(true); obs.disconnect(); } }, { threshold: 0.15, rootMargin: "0px 0px -48px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={delay ? { transitionDelay: `${delay}ms` } : undefined} className={`reveal ${shown ? "reveal-in" : ""} ${className}`}>
      {children}
    </div>
  );
}

function SectionHead({ kicker, title, text, center }: { kicker: string; title: string; text?: string; center?: boolean }) {
  return (
    <Reveal className={center ? "text-center" : "max-w-2xl"}>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-accent-foreground">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{text}</p>}
    </Reveal>
  );
}

function HeroVisual() {
  const bars = [30, 45, 40, 60, 55, 72, 66, 80, 74, 90, 84, 96];
  const rows = [["Campanha Leads B2B", "Ativa", "412", "R$ 9,71"], ["Black Friday — Loja Online", "Ativa", "501", "R$ 7,35"], ["Retenção CRM", "Pausada", "98", "R$ 12,10"]] as const;
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden>
      <div className="animate-float overflow-hidden rounded-2xl border border-white/10 bg-[#010317] shadow-panel">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" />
          <span className="ml-3 rounded-md bg-white/5 px-2.5 py-1 text-[10px] text-white/50">app.nexads.com.br/dashboard</span>
        </div>
        <div className="flex">
          <div className="hidden w-10 flex-col items-center gap-4 border-r border-white/10 py-4 sm:flex">
            <span className="size-5 rounded-md bg-nex-gradient" />
            {[LayoutDashboard, BarChart3, Wallet, FolderOpen, Users].map((I, i) => <I key={i} className={`size-3.5 ${i === 0 ? "text-cyan" : "text-white/30"}`} />)}
          </div>
          <div className="min-w-0 flex-1 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-white">Visão geral</p>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">Últimos 30 dias</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-[10px] font-medium text-cyan"><span className="relative flex size-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-70" /><span className="relative inline-flex size-1.5 rounded-full bg-cyan" /></span>Saldo: R$ 312,50</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[["Alcance", "128,4 mil", "+12,3%"], ["Impressões", "412,9 mil", "+8,1%"], ["Resultados", "1.847", "+23,6%"], ["Custo/result.", "R$ 8,42", "-11,2%"]].map(([k, v, d], i) => (
                <div key={k} className={`rounded-lg border p-2.5 ${i === 2 ? "border-primary/50 bg-primary/15" : "border-white/10 bg-white/[.03]"}`}>
                  <p className="text-[9px] text-white/50">{k}</p>
                  <p className={`mt-0.5 text-xs font-bold ${i === 2 ? "text-nex-gradient" : "text-white"}`}>{v}</p>
                  <p className="mt-0.5 text-[9px] text-emerald-400">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-2.5 rounded-lg border border-white/10 bg-white/[.03] p-3">
              <div className="flex items-center justify-between"><p className="text-[10px] text-white/50">Resultados por dia</p><span className="text-[10px] text-white/40">Meta Ads</span></div>
              <div className="mt-2 flex h-16 items-end gap-1">
                {bars.map((h, i) => <div key={i} className="animate-rise flex-1 rounded-t-sm bg-gradient-to-t from-primary to-cyan" style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }} />)}
              </div>
            </div>
            <div className="mt-2.5 overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left">
                <thead><tr className="bg-white/5 text-[9px] uppercase tracking-wide text-white/40"><th className="px-2.5 py-1.5 font-medium">Campanha</th><th className="px-1.5 py-1.5 font-medium">Status</th><th className="px-2.5 py-1.5 text-right font-medium">Result.</th><th className="px-2.5 py-1.5 text-right font-medium">C/result.</th></tr></thead>
                <tbody className="divide-y divide-white/5 text-[10px] text-white/85">
                  {rows.map(([n, s, res, cpr]) => (
                    <tr key={n}>
                      <td className="max-w-0 truncate px-2.5 py-2">{n}</td>
                      <td className="px-1.5 py-2"><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${s === "Ativa" ? "bg-emerald-400/15 text-emerald-400" : "bg-white/10 text-white/50"}`}>{s}</span></td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{res}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums text-white/70">{cpr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-right text-[9px] text-white/40">Sincronizado com a Meta há 12 min</p>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border bg-card p-4 shadow-panel sm:block">
        <p className="text-[11px] text-muted-foreground">Canais</p>
        <div className="mt-2 flex items-center gap-2">
          <img src={metaOfficial} alt="Meta" className="h-4 w-auto object-contain" loading="lazy" />
          <img src={googleOfficial} alt="Google" className="h-5 w-auto object-contain" loading="lazy" />
          <span className="flex items-center gap-1"><WhatsAppIcon className="size-5 text-accent-foreground" /><span className="text-[11px] text-muted-foreground">WhatsApp</span></span>
        </div>
      </div>
      <div className="animate-float absolute -right-4 -top-6 hidden rounded-2xl border border-border bg-card p-4 shadow-panel sm:block" style={{ animationDelay: "1.4s" }}>
        <p className="text-[11px] text-muted-foreground">Automação</p>
        <Workflow className="mt-2 size-5 text-cyan" />
      </div>
    </div>
  );
}

function DashboardMock() {
  const kpis: [string, string, string, boolean][] = [
    ["Alcance", "128,4 mil", "+12,3%", false],
    ["Impressões", "412,9 mil", "+8,1%", false],
    ["Resultados", "1.847", "+23,6%", true],
    ["Custo por resultado", "R$ 8,42", "-11,2%", false],
  ];
  const bars = [30, 45, 40, 60, 55, 72, 66, 80, 74, 90, 84, 96];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#010317] shadow-panel" aria-label="Captura da plataforma NEX Ads" role="img">
      {/* barra da janela */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" />
        <span className="ml-3 rounded-md bg-white/5 px-2.5 py-1 text-[10px] text-white/50">app.nexads.com.br/dashboard</span>
      </div>
      <div className="flex">
        {/* mini menu lateral */}
        <div className="hidden w-12 flex-col items-center gap-4 border-r border-white/10 py-4 sm:flex">
          <span className="size-6 rounded-md bg-nex-gradient" />
          {[LayoutDashboard, BarChart3, Wallet, FolderOpen, Users].map((I, i) => { const Icon = I; return <Icon key={i} className={`size-4 ${i === 0 ? "text-cyan" : "text-white/30"}`} />; })}
        </div>
        <div className="flex-1 p-4 sm:p-5">
          {/* topo: título + filtro + saldo */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white">Visão geral</p>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/60">Últimos 30 dias ▾</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-[10px] font-medium text-cyan"><span className="relative flex size-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-70" /><span className="relative inline-flex size-1.5 rounded-full bg-cyan" /></span>Saldo Meta: R$ 312,50</span>
            </div>
          </div>
          {/* KPIs */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {kpis.map(([k, v, d, hi]) => (
              <div key={k} className={`rounded-xl border p-3 ${hi ? "border-primary/50 bg-primary/15" : "border-white/10 bg-white/[.03]"}`}>
                <p className="text-[10px] text-white/50">{k}</p>
                <p className={`mt-1 text-sm font-bold ${hi ? "text-nex-gradient" : "text-white"}`}>{v}</p>
                <p className={`mt-0.5 text-[10px] ${d.startsWith("-") ? "text-cyan" : "text-emerald-400"}`}>{d} vs. período anterior</p>
              </div>
            ))}
          </div>
          {/* gráfico */}
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex items-center justify-between"><p className="text-[10px] text-white/50">Resultados por dia</p><span className="flex items-center gap-1.5 text-[10px] text-white/40"><span className="size-2 rounded-sm bg-gradient-to-t from-primary to-cyan" />Resultados</span></div>
            <div className="mt-3 flex h-28 items-end gap-1.5">
              {bars.map((h, i) => <div key={i} className="animate-rise flex-1 rounded-t-sm bg-gradient-to-t from-primary to-cyan" style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
