import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chatbotSnapshotFn,
  createChatbotConnectionFn,
  deleteChatbotConnectionFn,
  disconnectChatbotConnectionFn,
  refreshChatbotConnectionFn,
} from "@/lib/chatbot.functions";
import { attendancePhone, tintQrPixel, whatsappMask, type ChatbotConnectionStatus } from "@/lib/chatbot-evo";

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
  return whatsappMask(value) || "Aguardando leitura";
}

function tintQrImage(src: string) {
  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(src);
        return;
      }
      context.drawImage(image, 0, 0);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = frame.data;
      for (let index = 0; index < pixels.length; index += 4) {
        const tinted = tintQrPixel(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0, pixels[index + 3] ?? 255);
        pixels[index] = tinted[0];
        pixels[index + 1] = tinted[1];
        pixels[index + 2] = tinted[2];
        pixels[index + 3] = tinted[3];
      }
      context.putImageData(frame, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });
}

export function Connections() {
  const [rows, setRows] = useState<Connection[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qr, setQr] = useState("");
  const [active, setActive] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const qrIssuedAt = useRef(0);

  function applyStatus(connectionId: string, status: ChatbotConnectionStatus, error = "") {
    setRows((current) => current.map((row) => (row.id === connectionId ? { ...row, status, error } : row)));
  }

  function closeQr() {
    qrIssuedAt.current = 0;
    setQr("");
    setActive("");
  }

  async function presentQr(value: string) {
    if (!value) {
      setQr("");
      return;
    }
    qrIssuedAt.current = Date.now();
    setQr(await tintQrImage(value));
  }

  async function reload() {
    const result = await chatbotSnapshotFn();
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setRows(result.data.connections);
  }

  useEffect(() => {
    void (async () => {
      const result = await chatbotSnapshotFn();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const next = await Promise.all(
        result.data.connections.map(async (row) => {
          const current = await refreshChatbotConnectionFn({ data: { connectionId: row.id, withQr: false } });
          if (!current.ok) return row;
          return { ...row, status: current.data.status, error: current.data.error };
        }),
      );
      setRows(next);
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      void refreshChatbotConnectionFn({ data: { connectionId: active, withQr: false } }).then(async (result) => {
        if (!result.ok) return;
        applyStatus(active, result.data.status, result.data.error);
        if (result.data.status === "connected") {
          closeQr();
          setMessage("Conexão finalizada");
          return;
        }
        if (result.data.status === "connecting" || Date.now() - qrIssuedAt.current < 45000) return;
        const again = await refreshChatbotConnectionFn({ data: { connectionId: active, withQr: true } });
        if (!again.ok) return;
        applyStatus(active, again.data.status, again.data.error);
        if (again.data.status === "connected") {
          closeQr();
          setMessage("Conexão finalizada");
          return;
        }
        if (again.data.qrCode) await presentQr(again.data.qrCode);
      });
    }, 3000);
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
    qrIssuedAt.current = Date.now();
    setActive(result.data.id);
    await presentQr(result.data.qrCode);
    await reload();
  }

  async function showQr(connectionId: string) {
    setMessage("");
    qrIssuedAt.current = Date.now();
    setActive(connectionId);
    const result = await refreshChatbotConnectionFn({ data: { connectionId, withQr: true } });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    applyStatus(connectionId, result.data.status, result.data.error);
    if (result.data.status === "connected") {
      closeQr();
      setMessage("Conexão finalizada");
      return;
    }
    await presentQr(result.data.qrCode);
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
          <span className="flex w-full items-center gap-2">
            <span role="img" aria-label="Brasil" className="text-lg leading-none">
              🇧🇷
            </span>
            <input
              value={phone}
              onChange={(event) => setPhone(whatsappMask(event.target.value))}
              inputMode="tel"
              className="min-w-0 flex-1"
              placeholder="(11) 99999-9999"
              aria-label="Número com DDD"
            />
          </span>
        </label>
        <Button disabled={pending || name.trim().length < 2 || !attendancePhone(phone)}>
          <Smartphone />
          {pending ? "Gerando QR Code" : "Conectar"}
        </Button>
      </form>
      {qr && active ? (
        <div className="mb-5 max-w-xs rounded-md border bg-card p-4 text-center">
          <img src={qr} alt="QR Code do WhatsApp" className="mx-auto h-56 w-56 bg-white p-2" />
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
                <span className={`status-pill shrink-0${row.status === "connected" ? " connected" : row.status === "disconnected" ? " disconnected" : ""}`}>{labels[row.status]}</span>
              </div>
              {row.error ? <p className="mt-2 text-xs text-muted-foreground">{row.error}</p> : null}
              <div className="mt-3 flex gap-2">
                {row.status !== "connected" ? (
                  <Button variant="outline" size="sm" onClick={() => void showQr(row.id)}>
                    Ver QR
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void disconnectChatbotConnectionFn({ data: { connectionId: row.id } }).then((result) => {
                      if (!result.ok) setMessage(result.message);
                      if (active === row.id) closeQr();
                      void reload();
                    });
                  }}
                >
                  Desconectar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!window.confirm(`Excluir ${row.name} e apagar essa instância na Evolution?`)) return;
                    void deleteChatbotConnectionFn({ data: { connectionId: row.id } }).then((result) => {
                      if (!result.ok) {
                        setMessage(result.message);
                        return;
                      }
                      if (active === row.id) closeQr();
                      setMessage("");
                      void reload();
                    });
                  }}
                >
                  Excluir
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
