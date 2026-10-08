import { Link, useLocation, useNavigate } from "@tanstack/react-router";
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

const clientNav = [
  ["/dashboard", "Visão geral", Gauge], ["/campanhas", "Campanhas", BarChart3], ["/creditos-meta", "Créditos Meta", WalletCards], ["/financeiro", "Financeiro", CreditCard], ["/criativos", "Criativos", FileImage], ["/usuarios", "Usuários", Users], ["/minha-conta", "Minha conta", Settings],
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

function Nav({ master, close, demoPath, onDemoNavigate, lowBalance = false }: { master: boolean; close?: () => void; demoPath?: string | undefined; onDemoNavigate?: ((to: string) => void) | undefined; lowBalance?: boolean }) { const loc = useLocation().pathname; const path = demoPath ?? loc; return <nav className="space-y-1">{(master ? masterNav : clientNav).map(([to,label,Icon]) => <Link key={to} to={onDemoNavigate ? "/demo" : to} onClick={(e)=>{ if(onDemoNavigate){e.preventDefault();onDemoNavigate(to)} close?.() }} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${path===to ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}><Icon className="size-[18px]" />{label}{to==="/creditos-meta" && lowBalance ? <CircleAlert className="ml-auto size-4 text-destructive" aria-label="Saldo baixo" /> : null}</Link>)}</nav> }
export function AppShell({ children, title, subtitle, master = false, demoPath, onDemoNavigate, live = false, notes = true }: { children: React.ReactNode; title: string; subtitle: string; master?: boolean; demoPath?: string | undefined; onDemoNavigate?: ((to: string) => void) | undefined; live?: boolean; notes?: boolean }) {
 const navigate = useNavigate(); const [syncing,setSyncing]=useState(false); const sync=()=>{setSyncing(true);setTimeout(()=>setSyncing(false),1200)}; const signOut=async()=>{await supabase.auth.signOut();navigate({to:"/auth"})}; const userName = useSignedInName(); const lowBalance = useLowBalance(live && !master && !onDemoNavigate);
 const shell = <div className="min-h-screen bg-background text-foreground"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar p-5 lg:flex lg:flex-col"><Brand/><div className="mt-8 mb-3 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">{master?<><ShieldCheck className="size-3"/>Ambiente Master</>:"Área do cliente"}</div><Nav master={master} demoPath={demoPath} onDemoNavigate={onDemoNavigate} lowBalance={lowBalance}/></aside><div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-md sm:px-6"><div className="flex items-center gap-3"><Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu"><Menu/></Button></SheetTrigger><SheetContent side="left" className="w-72"><Brand/><div className="mt-8"><Nav master={master} demoPath={demoPath} onDemoNavigate={onDemoNavigate} lowBalance={lowBalance}/></div></SheetContent></Sheet><div className="lg:hidden"><Brand compact/></div>{!live&&<div className="hidden sm:block"><p className="text-sm font-semibold">Vértice Crédito</p><p className="text-xs text-muted-foreground">Conta Meta principal</p></div>}</div><div className="flex items-center gap-1"><LowBalanceBell low={lowBalance}/><ThemeToggle/><div className="mx-2 hidden h-6 w-px bg-border sm:block"/>{userName ? <p className="hidden max-w-48 truncate px-2 text-sm font-medium sm:block" title={`Olá ${userName}!`}>Olá {userName}!</p> : null}<Button variant="ghost" onClick={signOut} className="hidden sm:flex"><LogOut/>Sair</Button>{!live&&<div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold">MC</div>}</div></header><main className="px-4 py-6 sm:px-6 lg:px-8"><div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div>{notes?<div className="mb-2 flex items-center gap-2">{!live&&<span className="rounded-md bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">Demonstração</span>}{master&&<span className="text-xs text-muted-foreground">Acesso global protegido</span>}</div>:null}<h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>{title==="Visão geral"&&!live&&<div className="flex items-center gap-2"><Button variant="outline" className="flex-1 sm:flex-none">Últimos 30 dias<ChevronDown/></Button><Button onClick={sync} disabled={syncing} className="flex-1 sm:flex-none"><RefreshCw className={syncing?"animate-spin":""}/>{syncing?"Sincronizando":"Atualizar dados"}</Button></div>}</div>{children}</main></div></div>;
 if (master || onDemoNavigate) return shell;
 return <OverdueAccess>{shell}</OverdueAccess>;
}
