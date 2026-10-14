import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { callChatbotContactFn, listChatbotKanbanFn } from "@/lib/chatbot.functions";
import { negotiatedLabel, type ChatbotKanbanCard } from "@/lib/chatbot-evo";

const openConversationKey = "nex-kanban-conversation";

const stagePalette = ["var(--primary)", "var(--info)", "var(--warning)", "oklch(0.72 0.16 330)", "var(--success)", "var(--destructive)"];

function stageTone(name: string, index: number) {
  const key = name.trim().toLocaleLowerCase("pt-BR");
  if (key === "sucesso") return "var(--success)";
  if (key === "perdido") return "var(--destructive)";
  return stagePalette[index % stagePalette.length];
}

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

export function Kanban() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<string[]>([]);
  const [cards, setCards] = useState<ChatbotKanbanCard[]>([]);
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(true);
  const [calling, setCalling] = useState("");
  const [failure, setFailure] = useState("");

  useEffect(() => {
    void listChatbotKanbanFn().then((result) => {
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      setReady(result.data.ready);
      setStages(result.data.stages);
      setCards(result.data.cards);
    });
  }, []);

  async function call(contactId: string) {
    setCalling(contactId);
    const result = await callChatbotContactFn({ data: { contactId } });
    setCalling("");
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    sessionStorage.setItem(openConversationKey, result.data.conversationId);
    void navigate({ to: "/chatbot" });
  }

  const term = search.trim().toLowerCase();

  return (
    <main className="page kanban-page">
      <div className="table-toolbar mb-5 rounded-md border bg-card">
        <input placeholder="Buscar contato" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar contato" />
      </div>
      {ready ? null : <p className="info-note mb-5">A etapa do contato ainda não está disponível. Aplique a migração do kanban no Supabase.</p>}
      <div className="kanban-board">
        {stages.map((stage, index) => {
          const items = cards.filter((card) => {
            const product = card.products.join(", ");
            return card.stage === stage && `${card.name} ${product}`.toLowerCase().includes(term);
          });
          const total = items.reduce((sum, card) => sum + (card.negotiatedCents ?? 0), 0);
          return (
            <section key={stage} className="kanban-column" style={{ "--stage": stageTone(stage, index) } as CSSProperties}>
              <h2>
                {stage}
                <span className="count">{items.length}</span>
              </h2>
              <p className="column-total">{negotiatedLabel(total)}</p>
              {items.map((card) => (
                <article key={card.id} className="kanban-card">
                  <strong>{card.name || "Contato sem nome"}</strong>
                  <p className="kanban-product">{card.products.join(", ") || "Sem produto"}</p>
                  <p className="kanban-value">{negotiatedLabel(card.negotiatedCents ?? 0)}</p>
                  <Button variant="outline" className="kanban-call" disabled={calling === card.id} onClick={() => void call(card.id)}>
                    <WhatsAppIcon />
                    {calling === card.id ? "Abrindo" : "Chamar"}
                  </Button>
                </article>
              ))}
              {!items.length ? (
                <div className="text-center text-xs text-muted-foreground py-10">
                  <Columns3 className="mx-auto mb-3 size-5 opacity-40" />
                  Nenhum contato
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      <AlertDialog open={failure !== ""} onOpenChange={(open) => !open && setFailure("")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não foi possível concluir</AlertDialogTitle>
            <AlertDialogDescription>{failure}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendi</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
