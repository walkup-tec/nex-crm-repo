import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chatbotSnapshotFn,
  createChatbotConnectionFn,
  disconnectChatbotConnectionFn,
  refreshChatbotConnectionFn,
} from "@/lib/chatbot.functions";
import type { ChatbotConnectionStatus } from "@/lib/chatbot-evo";

const labels: Record<ChatbotConnectionStatus, string> = {
  waiting: "Aguardando conexão",
  qr: "QR Code disponível",
  connecting: "Conectando",
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Erro",
};

type Connection = {
  id: string;
  name: string;
  phone: string;
  status: ChatbotConnectionStatus;
  error: string;
};

export function Connections() {
  const [rows, setRows] = useState<Connection[]>([]);
  const [name, setName] = useState("");
  const [qr, setQr] = useState("");
  const [active, setActive] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const result = await chatbotSnapshotFn();
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setRows(result.data.connections);
    setMessage("");
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      void refreshChatbotConnectionFn({ data: { connectionId: active } }).then((result) => {
        if (!result.ok) return;
        setQr(result.data.qrCode);
        void load();
        if (result.data.status === "connected") setActive("");
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [active]);

  async function create() {
    setPending(true);
    const result = await createChatbotConnectionFn({ data: { name } });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setName("");
    setQr(result.data.qrCode);
    setActive(result.data.id);
    await load();
  }

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <h1>Conexão</h1>
          <p>Cada número fica ligado somente à empresa desta conta.</p>
        </div>
      </div>
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <form
        className="modal-form mb-5 max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label>
          Nome da conexão
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="WhatsApp comercial" />
        </label>
        <Button disabled={pending || name.trim().length < 2}>
          <Smartphone />
          {pending ? "Gerando QR Code" : "Adicionar WhatsApp"}
        </Button>
      </form>
      {qr ? (
        <div className="metric mb-5 max-w-xs text-center">
          <img src={qr} alt="QR Code do WhatsApp" className="mx-auto h-56 w-56" />
          <p className="mt-3 text-xs text-muted-foreground">Abra o WhatsApp, toque em Aparelhos conectados e leia este código.</p>
        </div>
      ) : null}
      <div className="empty-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Conexão</th>
                <th>Número</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.phone || "Aguardando leitura"}</td>
                    <td>
                      <span className={`status-pill${row.status === "connected" ? " good" : ""}`}>{labels[row.status]}</span>
                      {row.error ? <p>{row.error}</p> : null}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActive(row.id);
                          void refreshChatbotConnectionFn({ data: { connectionId: row.id } }).then((result) => {
                            if (result.ok) setQr(result.data.qrCode);
                            else setMessage(result.message);
                          });
                        }}
                      >
                        Atualizar QR
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void disconnectChatbotConnectionFn({ data: { connectionId: row.id } }).then(() => load());
                        }}
                      >
                        Desconectar
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>Nenhum WhatsApp conectado nesta empresa.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
