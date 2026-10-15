import { Link, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { callChatbotContactFn, listChatbotQueueAlertsFn } from "@/lib/chatbot.functions";

type QueueLead = { conversationId: string; contactId: string; name: string; waitingMinutes: number };

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="9" fill="#25D366" />
      <path
        fill="#fff"
        d="M12.7 10.2c-.2-.1-1.1-.55-1.27-.61-.17-.06-.3-.1-.42.1-.12.19-.48.61-.59.74-.11.12-.22.14-.41.05-.19-.1-.79-.29-1.5-.93-.56-.5-.93-1.11-1.04-1.3-.11-.19-.01-.29.08-.38.08-.08.19-.22.28-.33.09-.11.12-.19.19-.32.06-.12.03-.24-.02-.33-.05-.1-.42-1.02-.58-1.4-.15-.36-.31-.31-.42-.32h-.32c-.13 0-.33.05-.5.24-.17.19-.66.64-.66 1.57s.68 1.82.77 1.95c.1.12 1.33 2.03 3.22 2.85.45.19.8.31 1.07.4.45.14.86.12 1.18.07.36-.05 1.1-.45 1.26-.89.15-.44.15-.81.11-.89-.05-.08-.17-.12-.36-.21z"
      />
    </svg>
  );
}

export function LowBalanceBell({ low, supervisor = false }: { low: boolean; supervisor?: boolean }) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<QueueLead[]>([]);
  const [offline, setOffline] = useState(false);
  const [open, setOpen] = useState(false);
  const [calling, setCalling] = useState("");
  const [failure, setFailure] = useState("");

  useEffect(() => {
    if (!supervisor) return;
    let active = true;
    async function load() {
      const result = await listChatbotQueueAlertsFn();
      if (!active || !result.ok) return;
      setLeads(result.data.leads);
      setOffline(result.data.offline === true);
    }
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [supervisor]);

  async function call(contactId: string) {
    setCalling(contactId);
    setFailure("");
    const result = await callChatbotContactFn({ data: { contactId } });
    setCalling("");
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    sessionStorage.setItem("nex-kanban-conversation", result.data.conversationId);
    setLeads((current) => current.filter((lead) => lead.contactId !== contactId));
    window.dispatchEvent(new Event("nex-open-conversation"));
    setOpen(false);
    const path = window.location.pathname.replace(/\/$/, "");
    if (path.endsWith("/chatbot")) sessionStorage.removeItem("nex-kanban-conversation");
    else void navigate({ to: "/chatbot" });
  }

  const waiting = supervisor && leads.length > 0;
  const unavailable = supervisor && offline;
  if (!low && !waiting && !unavailable) {
    return (
      <Button variant="ghost" size="icon" aria-label="Notificações">
        <Bell />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unavailable && waiting ? "Leads na fila e nenhum atendente online" : unavailable ? "Nenhum atendente online" : waiting ? "Leads aguardando além do tempo da fila" : "Saldo Meta baixo"}
          className={waiting || unavailable ? "relative text-warning" : "relative text-destructive"}
        >
          <span className={`absolute inset-1 rounded-full ${waiting || unavailable ? "animate-warning-wave" : "animate-balance-wave"}`} />
          <Bell />
          {waiting ? (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] font-bold text-background">
              {leads.length > 9 ? "9+" : leads.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        {unavailable ? (
          <div className={waiting ? "mb-4 border-b pb-4" : ""}>
            <p className="text-sm font-semibold">Nenhum atendente online</p>
            <p className="mt-2 text-sm text-muted-foreground">Não há atendente com o chatbot aberto. O aviso permanece até alguém voltar.</p>
          </div>
        ) : null}
        {waiting ? (
          <div className="grid max-h-80 gap-3 overflow-y-auto">
            <p className="text-sm font-semibold">Fila acima do tempo</p>
            {leads.map((lead) => (
              <div key={lead.conversationId} className="grid gap-2 border-t pt-3">
                <div>
                  <p className="text-sm font-semibold">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">Aguardando há {lead.waitingMinutes} min</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full [&_svg]:size-[18px]"
                  disabled={calling === lead.contactId}
                  onClick={() => void call(lead.contactId)}
                >
                  <WhatsAppIcon />
                  {calling === lead.contactId ? "Abrindo" : "Chamar"}
                </Button>
              </div>
            ))}
            {failure ? <p className="text-xs text-destructive">{failure}</p> : null}
          </div>
        ) : null}
        {low ? (
          <div className={waiting ? "mt-4 border-t pt-4" : ""}>
            <p className="text-sm font-semibold text-destructive">Saldo Meta baixo</p>
            <p className="mt-2 text-sm text-muted-foreground">
              O saldo de anúncios da Meta está em R$ 50,00 ou menos. O aviso permanece até o saldo ficar
              maior que R$ 50,00.
            </p>
            <Button asChild className="mt-4 w-full">
              <Link to="/creditos-meta">Adicionar saldo</Link>
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
