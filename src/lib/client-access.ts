export type ClientStatus = "active" | "overdue" | "blocked" | "contract_ended" | "disabled";

export type InvoiceStatus = "pending" | "overdue" | "paid" | "cancelled";

export type ClientInvoice = {
  competence: string;
  dueDate: string;
  totalCents: number;
  status: InvoiceStatus;
  paidAt: string | null;
};

export type BillingProvider = "asaas" | "cora";
export type DelinquencyMode = "rate" | "amount";

export type ClientDraft = {
  legalName: string;
  document: string;
  responsibleName: string;
  responsibleEmail: string;
  whatsapp: string;
  sameFinancePhone: boolean;
  billingProvider: BillingProvider | "";
  adsMeta: boolean;
  adsGoogle: boolean;
  monthlyFee: string;
  dueDay: string;
  startsOn: string;
  endsOn: string;
  finePercent: string;
  interestPercent: string;
  asaasSubscriptionId: string;
  promoEnabled: boolean;
  promoStartsOn: string;
  promoEndsOn: string;
  afterPromoFee: string;
  delinquencyMode: DelinquencyMode | "";
  delinquencyAmount: string;
};

export type ClientPromotion = {
  id: string;
  startsOn: string;
  endsOn: string;
  amountCents: number;
  nominalCents: number;
};

export type ListedClient = {
  id: string;
  legalName: string;
  document: string;
  responsibleName: string;
  responsibleEmail: string;
  whatsapp: string;
  sameFinancePhone: boolean;
  status: ClientStatus;
  balanceCents: number;
  balanceKnown: boolean;
  financeLabel: string;
  monthlyFeeCents: number | null;
  dueDay: number | null;
  startsOn: string | null;
  endsOn: string | null;
  finePercent: number | null;
  interestPercent: number | null;
  asaasSubscriptionId: string;
  billingProvider: BillingProvider | "";
  adsMeta: boolean;
  adsGoogle: boolean;
  promoEnabled: boolean;
  promoStartsOn: string | null;
  promoEndsOn: string | null;
  afterPromoCents: number | null;
  promotions: ClientPromotion[];
  delinquencyMode: DelinquencyMode | "";
  delinquencyAmountCents: number | null;
  portfolioId: string;
  balanceUrl: string;
  adAccountIds: string[];
  metaAccounts: { id: string; name: string }[];
  accessEmail: string;
  accessUserId: string | null;
  invoices: ClientInvoice[];
};

export function adsPlatformLabel(client: { adsMeta: boolean; adsGoogle: boolean }) {
  if (client.adsMeta && client.adsGoogle) return "Meta e Google Ads";
  if (client.adsGoogle) return "Google Ads";
  if (client.adsMeta) return "Meta Ads";
  return "Não informado";
}

export function promoChargeCopy(nominal: string, promotional: string, afterDue: string) {
  return {
    about: `Está ativa no seu cadastro a promoção que reduz a sua mensalidade nominal de ${nominal} para mensalidade promocional de ${promotional}.`,
    keep: `Mantenham suas mensalidades em dia para não perder a promoção. Após o vencimento, o valor da cobrança será de ${afterDue}.`,
  };
}

export function adsServiceDescription(client: { adsMeta: boolean; adsGoogle: boolean }) {
  if (client.adsMeta && client.adsGoogle) {
    return "Mensalidade referente ao serviço de anúncios na plataforma Google e Meta Ads.";
  }
  if (client.adsGoogle) {
    return "Mensalidade referente ao serviço de anúncios na plataforma Google Ads.";
  }
  return "Mensalidade referente ao serviço de anúncios na plataforma Meta Ads.";
}

export function isInactiveClient(status: ClientStatus) {
  return status === "disabled" || status === "blocked" || status === "contract_ended";
}

export function clientStatusLabel(status: ClientStatus) {
  switch (status) {
    case "active":
      return "Ativo";
    case "overdue":
      return "Pagamento em atraso";
    case "blocked":
      return "Bloqueado";
    case "contract_ended":
      return "Contrato encerrado";
    case "disabled":
      return "Inativo";
  }
}

export function invoiceStatusLabel(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return "Pago";
    case "pending":
      return "Em aberto";
    case "overdue":
      return "Em atraso";
    case "cancelled":
      return "Cancelada";
  }
}

export function moneyFromCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dateBr(iso: string | null, empty = "—") {
  if (!iso) return empty;
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return empty;
  return `${day}/${month}/${year}`;
}

export function percentBr(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
