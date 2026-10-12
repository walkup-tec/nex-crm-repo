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
  connected: "Conexão finalizada",
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

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    const left = number.length > 8 ? number.slice(0, number.length - 4) : number;
    const right = number.length > 8 ? number.slice(-4) : "";
    return right ? `+55 (${ddd}) ${left}-${right}` : `+55 (${ddd}) ${number}`;
  }
  return digits ? `+${digits}` : "Aguardando leitura";
}

export function Connections() {
  const [rows, setRows] = useState<Connection[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      void refreshChatbotConnectionFn({ data: { connectionId: active } }).then((result) => {
        if (!result.ok) return;
        if (result.data.status === "connected") {
          setQr("");
          setActive("");
          setMessage("Conexão finalizada");
        } else {
          setQr(result.data.qrCode);
        }
        void load();
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [active]);

  async function create() {
    setPending(true);
    setMessage("");
    const result = await createChatbotConnectionFn({ data: { name, phone } });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setName("");
    setPhone("");
    setQr(result.data.qrCode);
    setActive(result.data.id);
    await load();
  }

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <h1>Conexão</h1>
          <p>Informe o nome e o número. O QR Code aparece aqui para concluir no WhatsApp.</p>
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
          Nome de atendimento
          <input
            value={name}
            maxLength={25}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome que aparece no WhatsApp"
          />
        </label>
        <label>
          Número
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="+55 (11) 99999-9999"
          />
        </label>
        <Button disabled={pending || name.trim().length < 2 || phone.replace(/\D/g, "").length < 10}>
          <Smartphone />
          {pending ? "Gerando QR Code" : "Conectar"}
        </Button>
      </form>
      {qr ? (
        <div className="mb-5 max-w-xs rounded-md border bg-card p-4 text-center">
          <img src={qr} alt="QR Code do WhatsApp" className="mx-auto h-56 w-56" />
          <p className="mt-3 text-xs text-muted-foreground">Abra o WhatsApp, toque em Aparelhos conectados e leia este código.</p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.length ? (
          rows.map((row) => (
            <article key={row.id} className="rounded-md border bg-card px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{row.name}</strong>
                  <p className="text-xs text-muted-foreground">{formatPhone(row.phone)}</p>
                </div>
                <span className={`status-pill shrink-0${row.status === "connected" ? " good" : ""}`}>{labels[row.status]}</span>
              </div>
              {row.error ? <p className="mt-2 text-xs text-muted-foreground">{row.error}</p> : null}
              <div className="mt-3 flex gap-2">
                {row.status !== "connected" ? (
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
                    Ver QR
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void disconnectChatbotConnectionFn({ data: { connectionId: row.id } }).then((result) => {
                      if (!result.ok) setMessage(result.message);
                      void load();
                    });
                  }}
                >
                  Desconectar
                </Button>
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum número conectado nesta empresa.</p>
        )}
      </div>
    </main>
  );
}
