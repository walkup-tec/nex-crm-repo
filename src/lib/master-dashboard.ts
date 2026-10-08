import { isInactiveClient, type ListedClient } from "@/lib/client-access";
import { daysPast, todayKey } from "@/lib/finance-access";
import { isLowMetaBalance } from "@/lib/low-balance";

export type DashboardAttention = {
  id: string;
  name: string;
  detail: string;
  amountCents: number | null;
};

export type DashboardContract = {
  id: string;
  name: string;
  endsOn: string;
  daysLeft: number;
};

export type MasterDashboard = {
  activeClients: number;
  overdueClients: number;
  blockedClients: number;
  receivableCents: number;
  attention: DashboardAttention[];
  endingContracts: DashboardContract[];
  criticalBalances: number;
  overdueCents: number;
  metaPending: number;
};

function overdueCentsOf(client: ListedClient) {
  return client.invoices.filter((invoice) => invoice.status === "overdue").reduce((sum, invoice) => sum + invoice.totalCents, 0);
}

function attentionOf(client: ListedClient): DashboardAttention | null {
  if (client.status === "disabled" || client.status === "contract_ended") return null;
  const overdueCents = overdueCentsOf(client);
  if (overdueCents > 0 || client.status === "overdue") {
    return { id: client.id, name: client.legalName, detail: "Mensalidade em atraso", amountCents: overdueCents > 0 ? overdueCents : null };
  }
  if (client.status === "blocked") {
    return { id: client.id, name: client.legalName, detail: "Bloqueado", amountCents: null };
  }
  if (client.balanceKnown && isLowMetaBalance(client.balanceCents)) {
    return { id: client.id, name: client.legalName, detail: "Saldo Meta baixo", amountCents: client.balanceCents };
  }
  return null;
}

export function masterDashboardFrom(clients: ListedClient[], today = todayKey()): MasterDashboard {
  const active = clients.filter((client) => !isInactiveClient(client.status));
  const overdueClients = clients.filter((client) => client.status !== "disabled" && client.status !== "contract_ended" && (client.status === "overdue" || overdueCentsOf(client) > 0));
  const invoices = clients.flatMap((client) => client.invoices);
  const horizon = 60;
  const endingContracts = active
    .flatMap((client) => {
      if (!client.endsOn) return [];
      const daysLeft = -daysPast(client.endsOn, today);
      if (daysLeft < 0 || daysLeft > horizon) return [];
      return [{ id: client.id, name: client.legalName, endsOn: client.endsOn, daysLeft }];
    })
    .sort((left, right) => left.daysLeft - right.daysLeft);
  const attention = clients
    .flatMap((client) => {
      const item = attentionOf(client);
      return item ? [item] : [];
    })
    .sort((left, right) => (right.amountCents ?? -1) - (left.amountCents ?? -1) || left.name.localeCompare(right.name, "pt-BR"));

  return {
    activeClients: active.length,
    overdueClients: overdueClients.length,
    blockedClients: clients.filter((client) => client.status === "blocked").length,
    receivableCents: invoices.filter((invoice) => invoice.status === "pending" || invoice.status === "overdue").reduce((sum, invoice) => sum + invoice.totalCents, 0),
    attention,
    endingContracts,
    criticalBalances: active.filter((client) => client.balanceKnown && isLowMetaBalance(client.balanceCents)).length,
    overdueCents: invoices.filter((invoice) => invoice.status === "overdue").reduce((sum, invoice) => sum + invoice.totalCents, 0),
    metaPending: clients.filter((client) => !client.balanceKnown).reduce((sum, client) => sum + client.metaAccounts.length, 0),
  };
}
