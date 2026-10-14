import { useEffect, useState } from "react";
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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.5 3.5A11 11 0 0 0 2.1 17.8L1 23l5.3-1.1A11 11 0 0 0 20.5 3.5zM12 20.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.2.1-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.5c.1-.1.2-.2.2-.3a.5.5 0 0 0 0-.5c-.2-.4-.7-1.5-.7-1.6s-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.4 2.4 0 0 0-.8 1.8 4.4 4.4 0 0 0 .9 2.3 9.9 9.9 0 0 0 3.8 3.4c.5.2.9.4 1.3.5a3 3 0 0 0 1.4.1 2.3 2.3 0 0 0 1.5-1c.2-.3.2-.7.1-1.1-.1-.1-.3-.2-.5-.3z"
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
        {stages.map((stage) => {
          const items = cards.filter((card) => {
            const product = card.products.join(", ");
            return card.stage === stage && `${card.name} ${product}`.toLowerCase().includes(term);
          });
          const total = items.reduce((sum, card) => sum + (card.negotiatedCents ?? 0), 0);
          return (
            <section key={stage} className="kanban-column">
              <h2>
                {stage}
                <span className="count">{items.length}</span>
              </h2>
              <p className="column-total">{negotiatedLabel(total)}</p>
              {items.map((card) => (
                <article key={card.id} className="kanban-card">
                  <strong>{card.name || "Contato sem nome"}</strong>
                  <p>{card.products.join(", ") || "Sem produto"}</p>
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
