import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  createChatbotConnectionFn,
  deleteChatbotConnectionFn,
  disconnectChatbotConnectionFn,
  listChatbotChannelsFn,
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

const statusValues = new Set<ChatbotConnectionStatus>([
  "waiting",
  "qr",
  "connecting",
  "connected",
  "disconnected",
  "error",
]);

type Connection = {
  id: string;
  name: string;
  phone: string;
  status: ChatbotConnectionStatus;
  error: string;
};

function asStatus(value: string): ChatbotConnectionStatus {
  return statusValues.has(value as ChatbotConnectionStatus)
    ? (value as ChatbotConnectionStatus)
    : "disconnected";
}

function formatPhone(value: string) {
  return whatsappMask(value) || "Aguardando leitura";
}

const connectionSteps = ["NEX Chatbot", "API WhatsApp", "Números"] as const;

function ConnectionsLoading() {
  return (
    <div className="rounded-md border bg-card px-3 py-5 sm:col-span-2 sm:px-5 xl:col-span-3" role="status" aria-live="polite">
      <div className="flex items-center" aria-hidden>
        {connectionSteps.map((label, index) => (
          <div key={label} className={index === 0 ? "flex items-center" : "flex min-w-0 flex-1 items-center"}>
            {index > 0 && (
              <span className="relative mx-1 h-0.5 min-w-1 flex-1 overflow-hidden rounded-full bg-muted sm:mx-2 sm:min-w-3">
                <span
                  className="animate-meta-link absolute inset-y-0 left-0 w-2/5 rounded-full bg-nex-gradient"
                  style={{ animationDelay: `${index * 0.55}s` }}
                />
              </span>
            )}
            <span
              className="animate-meta-node shrink-0 rounded-full border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground sm:px-2.5 sm:text-xs"
              style={{ animationDelay: `${index * 0.55}s` }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Carregando números salvos...</p>
    </div>
  );
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
  const [qrPendingId, setQrPendingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const qrIssuedAt = useRef(0);

  function applyStatus(connectionId: string, status: ChatbotConnectionStatus, error = "") {
    setRows((current) => current.map((row) => (row.id === connectionId ? { ...row, status, error } : row)));
    window.dispatchEvent(new Event("nex-channel-status"));
  }

  function closeQr() {
    qrIssuedAt.current = 0;
    setQr("");
    setActive("");
    setQrPendingId("");
  }

  async function presentQr(value: string) {
    if (!value) {
      setQr("");
      return;
    }
    qrIssuedAt.current = Date.now();
    setQr(value);
    const tinted = await tintQrImage(value);
    if (qrIssuedAt.current) setQr(tinted);
  }

  async function reload() {
    const result = await listChatbotChannelsFn();
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setRows(
      result.data.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        status: asStatus(row.status),
        error: "",
      })),
    );
  }

  useEffect(() => {
    void (async () => {
      const result = await listChatbotChannelsFn();
      if (!result.ok) {
        setMessage(result.message);
        setLoading(false);
        return;
      }
      const listed = result.data.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        status: asStatus(row.status),
        error: "",
      }));
      setRows(listed);
      setLoading(false);
      const refreshed = await Promise.all(
        listed.map(async (row) => {
          const current = await refreshChatbotConnectionFn({
            data: { connectionId: row.id, phone: row.phone, withQr: false },
          });
          return current.ok ? { id: row.id, status: current.data.status, error: current.data.error } : null;
        }),
      );
      setRows((current) =>
        current.map((row) => {
          const next = refreshed.find((item) => item?.id === row.id);
          if (!next) return row;
          return { ...row, status: next.status, error: next.error };
        }),
      );
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    const phone = rows.find((row) => row.id === active)?.phone ?? "";
    const timer = window.setInterval(() => {
      void refreshChatbotConnectionFn({ data: { connectionId: active, phone, withQr: false } }).then((result) => {
        if (!result.ok) return;
        applyStatus(active, result.data.status, result.data.error);
        if (result.data.status === "connected") {
          closeQr();
          setMessage("Conexão finalizada");
        }
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [active, rows]);

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
    setQrPendingId(connectionId);
    qrIssuedAt.current = Date.now();
    setActive(connectionId);
    const phone = rows.find((row) => row.id === connectionId)?.phone ?? "";
    const result = await refreshChatbotConnectionFn({ data: { connectionId, phone, withQr: true } });
    setQrPendingId("");
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
        {loading ? (
          <ConnectionsLoading />
        ) : rows.length ? (
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={qrPendingId === row.id}
                    onClick={() => void showQr(row.id)}
                  >
                    {qrPendingId === row.id ? "Abrindo QR" : "Ver QR"}
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
                    setDialogError("");
                    setRemoving(row);
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
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && !deleting && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir número</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir {removing?.name ?? "este número"} e apagar essa instância na Evolution? As conversas desse número também serão removidas.
            </AlertDialogDescription>
            {dialogError ? (
              <p role="alert" className="text-sm text-destructive">
                {dialogError}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                if (!removing) return;
                const connectionId = removing.id;
                setDialogError("");
                setDeleting(true);
                void deleteChatbotConnectionFn({ data: { connectionId } })
                  .then((result) => {
                    setDeleting(false);
                    if (!result.ok) {
                      setDialogError(result.message);
                      return;
                    }
                    if (active === connectionId) closeQr();
                    setRows((current) => current.filter((row) => row.id !== connectionId));
                    setMessage("");
                    setDialogError("");
                    setRemoving(null);
                    void reload();
                  })
                  .catch(() => {
                    setDeleting(false);
                    setDialogError("Não foi possível excluir o número.");
                  });
              }}
            >
              {deleting ? "Excluindo" : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
