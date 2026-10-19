import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import QRCode from "@/vendor/qrcode/lib/browser.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { moneyFromCents, overdueAccessCopy, overduePixCopy } from "@/lib/client-access";
import type { ChargePix } from "@/lib/finance-access";
import { chargePixFn, listOwnFinanceFn } from "@/lib/finance.functions";

function PixQr({ image, payload }: { image: string; payload: string }) {
  const [drawn, setDrawn] = useState("");
  useEffect(() => {
    if (image || !payload.startsWith("000201")) {
      setDrawn("");
      return;
    }
    let active = true;
    void QRCode.toDataURL(payload, { width: 640, margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } })
      .then((url) => {
        if (active) setDrawn(url);
      })
      .catch(() => {
        if (active) setDrawn("");
      });
    return () => {
      active = false;
    };
  }, [image, payload]);
  const src = image ? `data:image/png;base64,${image}` : drawn;
  if (!src) return <span className="px-3 text-center text-xs text-muted-foreground">Sem QR Code</span>;
  return <img src={src} alt="QR Code Pix" className="h-full w-full object-contain" />;
}

function penaltyNote(pix: ChargePix) {
  const parts = [
    pix.fineCents > 0 ? `multa de ${moneyFromCents(pix.fineCents)}` : "",
    pix.interestCents > 0 ? `juros de ${moneyFromCents(pix.interestCents)}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return `Inclui ${parts.join(" e ")}.`;
}

export function OverdueAccess({ children }: { children: React.ReactNode }) {
  const [overdueChargeId, setOverdueChargeId] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState({ adsMeta: true, adsGoogle: false });
  const [billingProvider, setBillingProvider] = useState<"cora" | "asaas" | "">("");
  const [pixOpen, setPixOpen] = useState(false);
  const [pix, setPix] = useState<ChargePix | null>(null);
  const [pixError, setPixError] = useState("");
  const [pixLoading, setPixLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const result = await listOwnFinanceFn();
    if (!result.ok) {
      setOverdueChargeId(null);
      return;
    }
    setOverdueChargeId(result.data.overdueChargeId);
    setPlatforms({ adsMeta: result.data.adsMeta, adsGoogle: result.data.adsGoogle });
    setBillingProvider(result.data.billingProvider);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!overdueChargeId) return;
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [overdueChargeId, load]);

  const openPix = async () => {
    if (!overdueChargeId) return;
    setPixOpen(true);
    setPix(null);
    setPixError("");
    setCopied(false);
    setPixLoading(true);
    const result = await chargePixFn({ data: { invoiceId: overdueChargeId } });
    setPixLoading(false);
    if (!result.ok) {
      setPixError(result.message);
      if (result.message.includes("não está em aberto") || result.message.includes("já foi paga")) void load();
      return;
    }
    setPix(result.data);
  };

  const blocked = overdueChargeId !== null;

  return (
    <>
      <div className={blocked ? "pointer-events-none select-none blur-md" : undefined} aria-hidden={blocked}>
        {children}
      </div>
      {blocked && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-background/55 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="overdue-access-title" className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-lg">
            <p id="overdue-access-title" className="text-sm leading-relaxed">
              {overdueAccessCopy(platforms)}
            </p>
            <Button className="mt-6 w-full" onClick={() => void openPix()}>
              Regularizar agora
            </Button>
          </div>
        </div>
      )}
      <Dialog
        open={pixOpen}
        onOpenChange={(open) => {
          setPixOpen(open);
          if (!open) void load();
        }}
      >
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>Regularizar pendência</DialogTitle>
            <DialogDescription>
              {overduePixCopy({ provider: billingProvider, nominal: pix ? pix.nominal : null })}
            </DialogDescription>
          </DialogHeader>
          {pixLoading && <p className="text-sm text-muted-foreground">Consultando o Pix...</p>}
          {pixError && <p className="text-sm text-destructive">{pixError}</p>}
          {pix && (
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border bg-muted">
                <PixQr image={pix.image} payload={pix.payload} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total devido</p>
                <p className="mt-1 text-2xl font-bold">{moneyFromCents(pix.totalCents)}</p>
                {penaltyNote(pix) && <p className="mt-2 text-xs text-muted-foreground">{penaltyNote(pix)}</p>}
                <Badge className="mt-3" variant="outline">Aguardando pagamento</Badge>
                <Button
                  className="mt-4 w-full"
                  disabled={!pix.payload}
                  onClick={() => {
                    if (!pix.payload) return;
                    void navigator.clipboard.writeText(pix.payload).then(() => setCopied(true));
                  }}
                >
                  <Copy />
                  {copied ? "Código copiado" : "Copiar código Pix"}
                </Button>
                {pix.invoiceUrl && (
                  <Button className="mt-2 w-full" variant="outline" asChild>
                    <a href={pix.invoiceUrl} target="_blank" rel="noreferrer">
                      Abrir cobrança
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
