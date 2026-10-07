export type ClientStatus = "active" | "overdue" | "blocked" | "contract_ended" | "disabled";

export type InvoiceStatus = "pending" | "overdue" | "paid" | "cancelled";

export type ClientInvoice = {
  competence: string;
  dueDate: string;
  totalCents: number;
  status: InvoiceStatus;
  paidAt: string | null;
};

export type ClientDraft = {
  legalName: string;
  document: string;
  responsibleName: string;
  responsibleEmail: string;
  whatsapp: string;
  sameFinancePhone: boolean;
  monthlyFee: string;
  dueDay: string;
  startsOn: string;
  endsOn: string;
  finePercent: string;
  interestPercent: string;
  asaasSubscriptionId: string;
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
  portfolioId: string;
  balanceUrl: string;
  adAccountIds: string[];
  metaAccounts: { id: string; name: string }[];
  accessEmail: string;
  accessUserId: string | null;
  invoices: ClientInvoice[];
};

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
