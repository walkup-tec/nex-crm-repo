import { Link, useLocation, useNavigate, useRouteContext } from "@tanstack/react-router";
import { BarChart3, BriefcaseBusiness, ChevronDown, CircleAlert, CircleDollarSign, CreditCard, FileImage, Gauge, LogOut, Menu, RefreshCw, Settings, ShieldCheck, Users, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { LowBalanceBell } from "./LowBalanceAlert";
import { useLowBalance } from "./use-low-balance";
import { OverdueAccess } from "./OverdueAccess";
import { clientNavPaths } from "@/lib/master-role";

function MetaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.05 8.05c1.28 0 2.38.72 3.48 2.12.62.8 1.08 1.78 1.47 2.38.39-.6.85-1.58 1.47-2.38 1.1-1.4 2.2-2.12 3.48-2.12 2.16 0 3.7 1.72 3.7 4.45 0 2.68-1.62 5.05-3.82 5.05-1.28 0-2.34-.82-3.52-2.36L12 13.55l-1.31 1.64c-1.18 1.54-2.24 2.36-3.52 2.36-2.2 0-3.82-2.37-3.82-5.05 0-2.73 1.54-4.45 3.7-4.45Zm.05 1.62c-1.08 0-2.02.92-2.02 2.83 0 1.74.84 3.43 2.18 3.43.68 0 1.4-.58 2.36-1.86l.86-1.22-1.02-1.42c-.78-1.02-1.52-1.76-2.36-1.76Zm9.8 0c-.84 0-1.58.74-2.36 1.76l-1.02 1.42.86 1.22c.96 1.28 1.68 1.86 2.36 1.86 1.34 0 2.18-1.69 2.18-3.43 0-1.91-.94-2.83-2.02-2.83Z"
      />
    </svg>
  );
}

const clientNav = [
  ["/dashboard", "Visão geral", Gauge],
  ["/campanhas", "Campanhas", BarChart3],
  ["/creditos-meta", "Créditos Meta", WalletCards],
  ["/criativos", "Criativos", FileImage],
  ["/financeiro", "Financeiro", CreditCard],
  ["/usuarios", "Usuários", Users],
  ["/minha-conta", "Minha conta", Settings],
] as const;

const clientSections = [
  {
    label: "META Ads",
    icon: MetaMark,
    paths: ["/campanhas", "/creditos-meta", "/criativos"],
  },
  {
    label: "Configurações",
    icon: Settings,
    paths: ["/financeiro", "/usuarios", "/minha-conta"],
  },
] as const;
const masterNav = [["/master", "Dashboard", Gauge], ["/master/clientes", "Clientes", BriefcaseBusiness], ["/usuarios", "Usuários", Users], ["/master/campanhas", "Campanhas", BarChart3], ["/master/financeiro", "Financeiro", CircleDollarSign], ["/master/criativos", "Criativos", FileImage], ["/master/configuracoes", "Configurações", Settings]] as const;
function useSignedInName() {
  const [name, setName] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id;
      if (!id) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", id)
        .maybeSingle();
      const fullName = profile?.full_name?.trim() ?? "";
      if (active && fullName) setName(fullName);
    })();
    return () => {
      active = false;
    };
  }, []);
  return name;
}

const clientsEntry = ["/master/clientes", "Clientes", BriefcaseBusiness] as const;
function clientItems(showClients: boolean) {
  const order = clientNavPaths(
    clientNav.map(([to]) => to),
    showClients,
  );
  const entries = new Map<string, (typeof clientNav)[number] | typeof clientsEntry>(
    clientNav.map((item) => [item[0], item]),
  );
  entries.set(clientsEntry[0], clientsEntry);
  return order.flatMap((to) => {
    const item = entries.get(to);
    return item ? [item] : [];
  });
}
function Nav({
  master,
  close,
  demoPath,
  onDemoNavigate,
  lowBalance = false,
  showClients = false,
}: {
  master: boolean;
  close?: () => void;
  demoPath?: string | undefined;
  onDemoNavigate?: ((to: string) => void) | undefined;
  lowBalance?: boolean;
  showClients?: boolean;
}) {
  const loc = useLocation().pathname;
  const path = demoPath ?? loc;
  const entries = master ? masterNav : clientItems(showClients);
  const link = (to: string, label: string, Icon: (typeof entries)[number][2], nested = false) => (
    <Link
      key={to}
      to={onDemoNavigate ? "/demo" : to}
      onClick={(event) => {
        if (onDemoNavigate) {
          event.preventDefault();
          onDemoNavigate(to);
        }
        close?.();
      }}
      className={`flex h-11 items-center gap-3 rounded-lg text-sm font-medium transition ${nested ? "pr-3 pl-9" : "px-3"} ${path === to ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}
    >
      <Icon className="size-[18px]" />
      {label}
      {to === "/creditos-meta" && lowBalance ? (
        <CircleAlert className="ml-auto size-4 text-destructive" aria-label="Saldo baixo" />
      ) : null}
    </Link>
  );
  if (master) {
    return (
      <nav className="space-y-1">{masterNav.map(([to, label, Icon]) => link(to, label, Icon))}</nav>
    );
  }
  const items = clientItems(showClients);
  const overview = items.find((item) => item[0] === "/dashboard");
  const clients = items.find((item) => item[0] === "/master/clientes");
  return (
    <nav className="space-y-1" aria-label="Menu principal">
      {overview ? link(overview[0], overview[1], overview[2]) : null}
      {clients ? link(clients[0], clients[1], clients[2]) : null}
      {clientSections.map((section) => {
        const SectionIcon = section.icon;
        return (
          <div
            key={section.label}
            role="group"
            aria-label={section.label}
            className="mt-4 rounded-xl border border-sidebar-foreground/15 bg-sidebar-foreground/[0.04] px-1 py-2"
          >
            <p className="mb-1 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-[.12em] text-sidebar-foreground">
              <SectionIcon className={section.icon === MetaMark ? "size-[1.3rem]" : "size-4"} />
              {section.label}
            </p>
            {section.paths.map((to) => {
              const item = clientNav.find((entry) => entry[0] === to);
              return item ? link(item[0], item[1], item[2], true) : null;
            })}
          </div>
        );
      })}
    </nav>
  );
}
export function AppShell({ children, title, subtitle, master = false, demoPath, onDemoNavigate, live = false, notes = true }: { children: React.ReactNode; title: string; subtitle: string; master?: boolean; demoPath?: string | undefined; onDemoNavigate?: ((to: string) => void) | undefined; live?: boolean; notes?: boolean }) {
 const navigate = useNavigate(); const [syncing,setSyncing]=useState(false); const sync=()=>{setSyncing(true);setTimeout(()=>setSyncing(false),1200)}; const signOut=async()=>{await supabase.auth.signOut();navigate({to:"/auth"})}; const userName = useSignedInName(); const session = useRouteContext({ strict: false }); const showClients = !master && !onDemoNavigate && session?.master === true; const lowBalance = useLowBalance(live && !master && !onDemoNavigate);
 const shell = <div className="min-h-screen bg-background text-foreground"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar p-5 lg:flex lg:flex-col"><Brand/><div className="mt-8 mb-3 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">{master?<><ShieldCheck className="size-3"/>Ambiente Master</>:"Área do cliente"}</div><Nav master={master} demoPath={demoPath} onDemoNavigate={onDemoNavigate} lowBalance={lowBalance} showClients={showClients}/></aside><div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-md sm:px-6"><div className="flex items-center gap-3"><Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu"><Menu/></Button></SheetTrigger><SheetContent side="left" className="w-72"><Brand/><div className="mt-8"><Nav master={master} demoPath={demoPath} onDemoNavigate={onDemoNavigate} lowBalance={lowBalance} showClients={showClients}/></div></SheetContent></Sheet><div className="lg:hidden"><Brand compact/></div>{!live&&<div className="hidden sm:block"><p className="text-sm font-semibold">Vértice Crédito</p><p className="text-xs text-muted-foreground">Conta Meta principal</p></div>}</div><div className="flex items-center gap-1"><LowBalanceBell low={lowBalance}/><ThemeToggle/><div className="mx-2 hidden h-6 w-px bg-border sm:block"/>{userName ? <p className="hidden max-w-48 truncate px-2 text-sm font-medium sm:block" title={`Olá ${userName}!`}>Olá {userName}!</p> : null}<Button variant="ghost" onClick={signOut} className="hidden sm:flex"><LogOut/>Sair</Button>{!live&&<div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold">MC</div>}</div></header><main className="px-4 py-6 sm:px-6 lg:px-8"><div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div>{notes?<div className="mb-2 flex items-center gap-2">{!live&&<span className="rounded-md bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">Demonstração</span>}{master&&<span className="text-xs text-muted-foreground">Acesso global protegido</span>}</div>:null}<h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>{title==="Visão geral"&&!live&&<div className="flex items-center gap-2"><Button variant="outline" className="flex-1 sm:flex-none">Últimos 30 dias<ChevronDown/></Button><Button onClick={sync} disabled={syncing} className="flex-1 sm:flex-none"><RefreshCw className={syncing?"animate-spin":""}/>{syncing?"Sincronizando":"Atualizar dados"}</Button></div>}</div>{children}</main></div></div>;
 if (master || onDemoNavigate) return shell;
 return <OverdueAccess>{shell}</OverdueAccess>;
}
