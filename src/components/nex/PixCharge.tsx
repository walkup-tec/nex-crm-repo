import { useEffect, useState } from "react";
import { Calendar, CircleDollarSign } from "lucide-react";
import QRCode from "@/vendor/qrcode/lib/browser.js";
import { Brand } from "@/components/nex/Brand";
import { dateBr, moneyFromCents, percentBr } from "@/lib/client-access";
import { applyMask } from "@/lib/masks";

export function PixCharge({
  payload,
  totalCents,
  dueDate,
  clientName,
  clientDocument,
  delinquencyMode,
  finePercent,
  interestPercent,
  delinquencyAmountCents,
}: {
  payload: string;
  totalCents: number;
  dueDate: string;
  clientName: string;
  clientDocument: string;
  delinquencyMode: "rate" | "amount" | "";
  finePercent: number;
  interestPercent: number;
  delinquencyAmountCents: number | null;
}) {
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);
  const document = clientDocument.replace(/\D/g, "");
  const fine =
    delinquencyMode === "amount" && delinquencyAmountCents != null
      ? moneyFromCents(delinquencyAmountCents)
      : percentBr(finePercent);
  const interest = delinquencyMode === "amount" ? percentBr(0) : percentBr(interestPercent);

  useEffect(() => {
    let active = true;
    setImage("");
    setFailed(false);
    void QRCode.toDataURL(payload, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setImage(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [payload]);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 size-48 rounded-full bg-cyan/20 blur-2xl" />
      <div className="relative grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Brand />
          <div className="text-left sm:text-right">
            <h2 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
              Essa é a sua <span className="text-primary">cobrança</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{clientName}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <CircleDollarSign className="size-6" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="font-display text-2xl font-bold">{moneyFromCents(totalCents)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border bg-muted/60 px-4 py-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Calendar className="size-6" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Vencimento</p>
              <p className="font-display text-2xl font-bold">{dateBr(dueDate)}</p>
            </div>
          </div>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-4">
            <section>
              <h3 className="font-display text-lg font-bold text-primary">Beneficiário</h3>
              <p className="mt-1 font-medium">{clientName}</p>
              {document ? (
                <p className="text-sm text-muted-foreground">
                  {document.length > 11 ? "CNPJ" : "CPF"} {applyMask("doc", document)}
                </p>
              ) : null}
            </section>
            <section className="border-t pt-4">
              <h3 className="font-display text-lg font-bold text-primary">Descrição</h3>
              <p className="mt-1 font-medium">Mensalidade Nex</p>
              <p className="text-sm text-muted-foreground">Mensalidade do contrato Nex</p>
            </section>
            <section className="border-t pt-4">
              <h3 className="font-display text-lg font-bold text-primary">Após o vencimento</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="font-medium">{fine}</p>
                  <p className="text-sm text-muted-foreground">multa</p>
                </div>
                <div className="border-l pl-3">
                  <p className="font-medium">{interest}</p>
                  <p className="text-sm text-muted-foreground">juros</p>
                </div>
              </div>
            </section>
            <section className="border-t pt-4">
              <h3 className="font-display text-lg font-bold text-primary">Antes do vencimento</h3>
              <p className="mt-1 font-medium">{moneyFromCents(0)}</p>
              <p className="text-sm text-muted-foreground">desconto</p>
            </section>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-center text-sm font-medium">
              Escaneie o QR code abaixo
              <span className="mt-1 block font-normal text-muted-foreground">para realizar o pagamento</span>
            </p>
            <div className="relative mx-auto mt-4 w-full max-w-[18rem] bg-white p-3">
              <span className="absolute left-1 top-1 size-6 border-l-2 border-t-2 border-primary" />
              <span className="absolute right-1 top-1 size-6 border-r-2 border-t-2 border-primary" />
              <span className="absolute bottom-1 left-1 size-6 border-b-2 border-l-2 border-primary" />
              <span className="absolute bottom-1 right-1 size-6 border-b-2 border-r-2 border-primary" />
              {image ? (
                <img src={image} alt="QR Code Pix da mensalidade" className="w-full" />
              ) : (
                <p className="py-16 text-center text-sm text-neutral-500">
                  {failed ? "Não foi possível montar o QR Code." : "Montando o QR Code..."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
