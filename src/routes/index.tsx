import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight, BarChart3, Bot, Code2, Cpu, Database, Globe, HelpCircle, Home, Layers, LayoutDashboard,
  Menu, MonitorSmartphone, Search, ShieldCheck, Sparkles, Target, Workflow, Zap, Info, Phone,
} from "lucide-react";
import logoAsset from "@/assets/nex-logo-header-final.png.asset.json";
import credMetaCertified from "@/assets/cred-meta-certified.png.asset.json";
import credMetaTechProvider from "@/assets/cred-meta-tech-provider.png.asset.json";
import credGooglePartner from "@/assets/cred-google-partner.png.asset.json";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { faq, messages, sections, solutions, waLink, WHATSAPP_DISPLAY } from "@/data/site";

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

const navIcons = { inicio: Home, solucoes: Layers, "nex-ads": LayoutDashboard, tecnologia: Cpu, sobre: Info, faq: HelpCircle, contato: Phone } as const;
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
          <a href="#inicio" aria-label="NEX Marketing Digital — início"><img src={logoAsset.url} alt="NEX Marketing Digital" className="h-9 w-auto lg:h-11" /></a>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${active === s.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{s.label}</a>
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
                <img src={logoAsset.url} alt="NEX Marketing Digital" className="h-9 w-auto self-start" />
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
          <a key={s.id} href={`#${s.id}`} aria-label={s.label} aria-current={on ? "true" : undefined} className={`group relative grid size-11 place-items-center rounded-xl transition ${on ? "bg-nex-gradient text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            <I className="size-[18px]" />
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">{s.label}</span>
          </a>
        ); })}
        <div className="mx-auto my-1 h-px w-6 bg-border" />
        <a href={waLink(messages.general)} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp" className="grid size-11 place-items-center rounded-xl text-cyan hover:bg-secondary"><WhatsAppIcon className="size-[18px]" /></a>
      </nav>

      <main className="lg:[&_section>div]:pl-24 2xl:[&_section>div]:pl-6">
        {/* HERO */}
        <section id="inicio" className="relative overflow-hidden bg-[var(--surface-1)] pt-28 pb-20 lg:pt-40 lg:pb-32">
          <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_70%_30%,black,transparent_70%)]" aria-hidden />
          <div className="absolute -right-40 -top-40 size-[640px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,#6F02FD_35%,transparent),transparent_65%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
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
            <HeroVisual />
          </div>
        </section>

        {/* Certificações */}
        <section aria-label="Certificações" className="border-y border-border bg-[var(--surface-2)] py-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 text-center sm:px-6 md:flex-row md:justify-between md:text-left">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Credenciais</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              <li><img src={credMetaCertified.url} alt="Meta Certified — Media Buying Professional" className="h-14 w-auto rounded-full md:h-16" loading="lazy" /></li>
              <li><img src={credMetaTechProvider.url} alt="Meta Tech Provider — Certified Partner" className="h-12 w-auto rounded-lg md:h-14" loading="lazy" /></li>
              <li><img src={credGooglePartner.url} alt="Google Partner" className="h-12 w-auto rounded-lg md:h-14" loading="lazy" /></li>
            </ul>
          </div>
        </section>

        {/* SOLUÇÕES */}
        <section id="solucoes" className="bg-background py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead kicker="Soluções" title="Da aquisição de clientes à tecnologia que sustenta a operação" text="Cada frente conversa com a outra: a mídia gera demanda, a tecnologia organiza e a automação acelera o atendimento." />
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {solutions.map((s) => { const I = solIcons[s.key]; return (
                <article key={s.key} className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/60">
                  <div className="grid size-12 place-items-center rounded-xl bg-nex-gradient text-primary-foreground"><I className="size-5" /></div>
                  <h3 className="mt-5 font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                  <a href={waLink(s.msg)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent-foreground">Conversar sobre isso<ArrowRight className="size-4 transition group-hover:translate-x-1" /></a>
                </article>
              ); })}
            </div>
          </div>
        </section>

        {/* NEX ADS */}
        <section id="nex-ads" className="relative overflow-hidden bg-[var(--surface-3)] py-20 lg:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_90%,color-mix(in_oklch,#00EAFD_14%,transparent),transparent_55%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <SectionHead kicker="NEX Ads" title="Transparência total sobre cada real investido" text="Nossos clientes acompanham campanhas, resultados, saldo de mídia, financeiro e criativos em uma plataforma própria, desenvolvida pela NEX." />
              <ul className="mt-8 space-y-3 text-sm">
                {["Alcance, impressões, resultados e custo por resultado em tempo real", "Alertas de saldo de mídia antes que as campanhas parem", "Biblioteca de criativos organizada e segura", "Acesso por perfis para sua equipe"].map((t) => (
                  <li key={t} className="flex gap-3"><Zap className="mt-0.5 size-4 shrink-0 text-cyan" />{t}</li>
                ))}
              </ul>
              <WaButton msg={messages.general} className="mt-9">Quero conhecer o NEX Ads</WaButton>
            </div>
            <DashboardMock />
          </div>
        </section>

        {/* TECNOLOGIA (área clara) */}
        <section id="tecnologia" className="site-light bg-background py-20 text-foreground lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead kicker="Tecnologia" title="Uma agência que também constrói tecnologia" text="Não dependemos apenas de ferramentas prontas. Quando sua operação precisa, desenvolvemos." />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[[Database, "Dados", "Decisões baseadas em métricas reais, não em impressão."], [Workflow, "Automação", "Processos repetitivos executados sem esforço manual."], [Bot, "IA aplicada", "Atendimento e qualificação de leads com inteligência artificial."], [Globe, "Sistemas web", "Plataformas sob medida, seguras e integradas."]].map(([I, t, d]) => { const Icon = I as typeof Database; return (
                <div key={t as string} className="rounded-2xl border border-border bg-card p-6 shadow-panel">
                  <Icon className="size-6 text-primary" />
                  <h3 className="mt-4 font-display text-base font-semibold">{t as string}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{d as string}</p>
                </div>
              ); })}
            </div>
          </div>
        </section>

        {/* SOBRE */}
        <section id="sobre" className="bg-[var(--surface-1)] py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div className="border-gradient rounded-3xl p-10 text-center">
              <p className="text-sm font-semibold text-muted-foreground">No mercado de tecnologia desde</p>
              <p className="mt-2 font-display text-7xl font-bold text-nex-gradient sm:text-8xl">2006</p>
            </div>
            <div>
              <SectionHead kicker="Sobre a NEX" title="Experiência em tecnologia, aplicada à performance" text="A NEX nasceu da tecnologia. Ao longo dos anos, unimos esse conhecimento técnico ao marketing digital para oferecer algo que poucas agências entregam: campanhas de mídia apoiadas por sistemas, automações e dados." />
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[[ShieldCheck, "Segurança"], [BarChart3, "Performance"], [Sparkles, "Inovação"]].map(([I, t]) => { const Icon = I as typeof ShieldCheck; return (
                  <div key={t as string} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"><Icon className="size-4 text-cyan" />{t as string}</div>
                ); })}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-[var(--surface-2)] py-20 lg:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHead kicker="FAQ" title="Perguntas frequentes" center />
            <div className="mt-10 space-y-3">
              {faq.map((f) => (
                <details key={f.q} className="group rounded-xl border border-border bg-card px-5 open:border-primary/50">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold">{f.q}<span className="text-xl text-muted-foreground transition group-open:rotate-45">+</span></summary>
                  <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CONTATO */}
        <section id="contato" className="relative overflow-hidden bg-[var(--surface-1)] py-20 lg:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl bg-nex-gradient p-10 text-center text-primary-foreground sm:p-16">
              <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
              <h2 className="relative font-display text-3xl font-bold sm:text-4xl">Vamos conversar sobre o crescimento da sua empresa?</h2>
              <p className="relative mx-auto mt-4 max-w-xl opacity-90">Fale direto com um especialista no WhatsApp. Sem formulário, sem cadastro.</p>
              <a href={waLink(messages.general)} target="_blank" rel="noopener noreferrer" className="relative mt-8 inline-flex h-14 items-center gap-2 rounded-xl bg-[var(--surface-1)] px-8 text-base font-semibold text-foreground transition hover:-translate-y-0.5"><WhatsAppIcon className="size-5" />Falar com um especialista</a>
              <p className="relative mt-4 text-sm opacity-85">{WHATSAPP_DISPLAY}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-[var(--surface-1)] py-10 pb-28 sm:pb-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <img src={logoAsset.url} alt="NEX Marketing Digital" className="h-8 w-auto" />
          <p>© {new Date().getFullYear()} NEX Marketing Digital. Tecnologia desde 2006.</p>
          <Link to="/auth" className="hover:text-foreground">Área do cliente</Link>
        </div>
      </footer>

      {/* WhatsApp flutuante */}
      <a href={waLink(messages.general)} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-50 grid size-14 place-items-center rounded-full bg-nex-gradient text-primary-foreground shadow-brand transition hover:scale-105 active:scale-95">
        <WhatsAppIcon className="size-6" />
      </a>
    </div>
  );
}

function SectionHead({ kicker, title, text, center }: { kicker: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={center ? "text-center" : "max-w-2xl"}>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-accent-foreground">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{text}</p>}
    </div>
  );
}

function HeroVisual() {
  const bars = [38, 52, 46, 64, 58, 76, 70, 88];
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden>
      <div className="border-gradient animate-float rounded-3xl p-6 shadow-panel">
        <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Performance</span><span className="rounded-full bg-secondary px-2 py-0.5">ao vivo</span></div>
        <div className="mt-6 flex h-40 items-end gap-2">
          {bars.map((h, i) => <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-primary to-cyan opacity-90" style={{ height: `${h}%` }} />)}
        </div>
        <svg viewBox="0 0 300 60" className="mt-4 h-14 w-full"><defs><linearGradient id="hl" x1="0" x2="1"><stop offset="0" stopColor="#6F02FD" /><stop offset="1" stopColor="#00EAFD" /></linearGradient></defs><path d="M0 50 C40 45 60 30 100 34 S170 12 210 18 S270 4 300 6" fill="none" stroke="url(#hl)" strokeWidth="3" /></svg>
      </div>
      <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border bg-card p-4 shadow-panel sm:block">
        <p className="text-[11px] text-muted-foreground">Canais</p>
        <div className="mt-2 flex gap-2"><Target className="size-5 text-primary" /><Search className="size-5 text-cyan" /><WhatsAppIcon className="size-5 text-accent-foreground" /></div>
      </div>
      <div className="absolute -right-4 -top-6 hidden rounded-2xl border border-border bg-card p-4 shadow-panel sm:block">
        <p className="text-[11px] text-muted-foreground">Automação</p>
        <Workflow className="mt-2 size-5 text-cyan" />
      </div>
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-panel" aria-label="Ilustração da plataforma NEX Ads" role="img">
      <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-destructive/70" /><span className="size-2.5 rounded-full bg-warning/70" /><span className="size-2.5 rounded-full bg-success/70" /><span className="ml-3 text-xs text-muted-foreground">NEX Ads · Visão geral</span></div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {["Alcance", "Impressões", "Resultados"].map((k, i) => (
          <div key={k} className="rounded-xl bg-secondary p-3"><p className="text-[11px] text-muted-foreground">{k}</p><div className={`mt-2 h-2 rounded-full bg-nex-gradient`} style={{ width: `${55 + i * 15}%` }} /></div>
        ))}
      </div>
      <div className="mt-4 flex h-36 items-end gap-1.5 rounded-xl bg-secondary p-4">
        {[30, 45, 40, 60, 55, 72, 66, 80, 74, 90].map((h, i) => <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-primary to-cyan" style={{ height: `${h}%` }} />)}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Ilustração da interface</p>
    </div>
  );
}
