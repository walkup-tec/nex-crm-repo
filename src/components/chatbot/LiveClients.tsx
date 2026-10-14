import { useEffect, useState } from "react";
import { listChatbotClientsFn } from "@/lib/chatbot.functions";
import { negotiatedLabel, whatsappMask, type ChatbotClientRow } from "@/lib/chatbot-evo";

export function LiveClients() {
  const [clients, setClients] = useState<ChatbotClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void listChatbotClientsFn().then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setClients(result.data);
    });
  }, []);

  const term = search.trim().toLowerCase();
  const visible = clients.filter((client) => {
    if (!term) return true;
    return client.name.toLowerCase().includes(term) || client.phone.includes(term.replace(/\D/g, ""));
  });

  return (
    <main className="page">
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <div className="empty-table">
        <div className="table-toolbar">
          <div className="search-field w-full max-w-xs">
            <input placeholder="Buscar clientes" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar clientes" />
          </div>
          <span className="status-pill">{visible.length} registros</span>
        </div>
        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>WhatsApp</th>
                  <th>Valor negociado</th>
                  <th>Etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.name}</strong>
                    </td>
                    <td>{whatsappMask(client.phone) || client.phone}</td>
                    <td>{negotiatedLabel(client.negotiatedCents) || "—"}</td>
                    <td>{client.tags.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h2>{search ? "Nenhum resultado encontrado" : "Nenhum cliente cadastrado"}</h2>
            <p>O cadastro é feito no contato, na caixa de entrada. Cada atendente vê apenas os clientes que cadastrou.</p>
          </div>
        )}
      </div>
    </main>
  );
}
