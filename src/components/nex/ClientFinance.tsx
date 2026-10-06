import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dateBr, invoiceStatusLabel, moneyFromCents } from "@/lib/client-access";
import { competenceLabel, type ChargePix, type OwnFinance } from "@/lib/finance-access";
import { chargePixFn, listOwnFinanceFn } from "@/lib/finance.functions";

export function ClientFinance() {
  const [snapshot, setSnapshot] = useState<OwnFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pixOpen, setPixOpen] = useState(false);
  const [pix, setPix] = useState<ChargePix | null>(null);
  const [pixError, setPixError] = useState("");
  const [pixLoading, setPixLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await listOwnFinanceFn();
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSnapshot(result.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openPix = async () => {
    if (!snapshot?.openChargeId) return;
    setPixOpen(true);
    setPix(null);
    setPixError("");
    setCopied(false);
    setPixLoading(true);
    const result = await chargePixFn({ data: { invoiceId: snapshot.openChargeId } });
    setPixLoading(false);
    if (!result.ok) {
      setPixError(result.message);
      return;
    }
    setPix(result.data);
  };

  return (
    <div className="space-y-5">
      {loading && <p className="text-sm text-muted-foreground">Consultando o financeiro...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {snapshot?.notice && <p className="text-sm text-muted-foreground">{snapshot.notice}</p>}
      {snapshot && snapshot.overdueDays > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-semibold">Pagamento em atraso — {snapshot.overdueDays} {snapshot.overdueDays === 1 ? "dia" : "dias"}</p>
            <p className="text-sm text-muted-foreground">Durante os três primeiros dias, o acesso continua disponível com este aviso.</p>
          </div>
          <Button variant="outline" onClick={() => void openPix()}>
            Regularizar pagamento
          </Button>
        </div>
      )}
      {snapshot && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Próxima mensalidade</p>
                <strong className="mt-2 block text-2xl">{snapshot.nextCents == null ? "—" : moneyFromCents(snapshot.nextCents)}</strong>
                <p className="mt-1 text-xs text-muted-foreground">{snapshot.nextDue ? `Vencimento em ${dateBr(snapshot.nextDue)}` : "Sem cobrança em aberto"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Situação atual</p>
                <div className="mt-3">
                  <Badge variant={snapshot.situation === "Em atraso" ? "destructive" : "outline"}>{snapshot.situation}</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Contrato</p>
                <strong className="mt-2 block">{snapshot.startsOn ? `${dateBr(snapshot.startsOn)} — ${dateBr(snapshot.endsOn)}` : "Contrato não cadastrado"}</strong>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Histórico financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshot.charges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma cobrança gravada.</p>
              ) : (
                snapshot.charges.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 border-b py-4 last:border-0 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="font-medium">{competenceLabel(item.competence)}</p>
                      <p className="text-xs text-muted-foreground">
                        Vencimento {dateBr(item.dueDate)}
                        {item.paidAt ? ` • pago em ${dateBr(item.paidAt)}` : ""}
                      </p>
                    </div>
                    <strong>{moneyFromCents(item.totalCents)}</strong>
                    <Badge variant="outline">{invoiceStatusLabel(item.status)}</Badge>
                    {item.invoiceUrl ? (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={item.invoiceUrl} target="_blank" rel="noreferrer" aria-label="Abrir documento">
                          <Download />
                        </a>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" disabled aria-label="Documento indisponível">
                        <Download />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
      <Dialog open={pixOpen} onOpenChange={setPixOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regularizar com Pix</DialogTitle>
            <DialogDescription>Se a negociação retirou multa e juros, este Pix é só o valor nominal desta cobrança.</DialogDescription>
          </DialogHeader>
          {pixLoading && <p className="text-sm text-muted-foreground">Consultando o Pix...</p>}
          {pixError && <p className="text-sm text-destructive">{pixError}</p>}
          {pix && (
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border bg-muted">
                {pix.image ? <img src={`data:image/png;base64,${pix.image}`} alt="QR Code Pix" className="h-full w-full object-contain" /> : <span className="px-3 text-center text-xs text-muted-foreground">Sem QR Code</span>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total devido</p>
                <p className="mt-1 text-2xl font-bold">{moneyFromCents(pix.totalCents)}</p>
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
    </div>
  );
}
