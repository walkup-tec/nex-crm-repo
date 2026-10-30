import { clientDisplayName, isInactiveClient, type ClientInvoice, type ClientStatus } from "@/lib/client-access";
import { daysPast, shiftDate, todayKey } from "@/lib/finance-access";
import type { MetaPeriod } from "@/lib/meta-access";

export type DashboardClient = {
  id: string;
  legalName: string;
  commercialName?: string | null;
  status: ClientStatus;
  createdAt: string | null;
  startsOn: string | null;
  endsOn: string | null;
  state: string | null;
  invoices: ClientInvoice[];
};

export type DashboardDelta = {
  value: number;
  percent: number | null;
  label: string;
};

export type DashboardKpi = {
  value: number;
  cents: number | null;
  delta: DashboardDelta | null;
};

export type DashboardMonthPoint = {
  key: string;
  label: string;
  revenueCents: number;
  activeClients: number;
};

export type DashboardSlice = {
  key: string;
  label: string;
  value: number;
  cents: number;
  percent: number;
};

export type DashboardRegion = {
  key: string;
  label: string;
  clients: number;
  percent: number;
};

export type DashboardUf = {
  uf: string;
  clients: number;
};

export type DashboardTopClient = {
  id: string;
  name: string;
  revenueCents: number;
  percent: number;
};

export type DashboardWeekBucket = {
  key: string;
  label: string;
  count: number;
  cents: number;
};

export type MasterDashboard = {
  period: MetaPeriod;
  today: string;
  activeClients: DashboardKpi;
  newClients: DashboardKpi;
  periodRevenue: DashboardKpi;
  overdueClients: DashboardKpi;
  dueThisWeek: DashboardKpi;
  dueNextWeek: DashboardKpi;
  revenueClientsSeries: DashboardMonthPoint[];
  paymentSlices: DashboardSlice[];
  regions: DashboardRegion[];
  ufs: DashboardUf[];
  topClients: DashboardTopClient[];
  dueWeeks: DashboardWeekBucket[];
  statusSlices: DashboardSlice[];
  unknownGeoClients: number;
};

const REGIONS: { key: string; label: string; ufs: string[] }[] = [
  { key: "SE", label: "Sudeste", ufs: ["SP", "RJ", "MG", "ES"] },
  { key: "S", label: "Sul", ufs: ["RS", "SC", "PR"] },
  { key: "NE", label: "Nordeste", ufs: ["BA", "PE", "CE", "MA", "PB", "RN", "AL", "SE", "PI"] },
  { key: "CO", label: "Centro-Oeste", ufs: ["GO", "MT", "MS", "DF"] },
  { key: "N", label: "Norte", ufs: ["AM", "PA", "RO", "AC", "RR", "AP", "TO"] },
];

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function normalizeUf(value: string | null | undefined) {
  const uf = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(uf) ? uf : null;
}

export function dayOf(iso: string | null | undefined) {
  if (!iso) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso.trim());
  if (match) return match[1];
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export function periodBounds(period: MetaPeriod): { start: string; end: string } | null {
  if (period.mode === "total") return null;
  return { start: period.since, end: period.until };
}

export function previousBounds(bounds: { start: string; end: string }) {
  const monthStart = `${bounds.start.slice(0, 7)}-01`;
  const nextMonth = shiftDate(bounds.end, 1);
  const fullMonth =
    bounds.start === monthStart && nextMonth.slice(8, 10) === "01" && nextMonth.slice(0, 7) !== bounds.start.slice(0, 7);
  if (fullMonth) {
    const previousMonth = shiftMonthKey(bounds.start.slice(0, 7), -1);
    return { start: `${previousMonth}-01`, end: shiftDate(monthStart, -1) };
  }
  const length = daysPast(bounds.start, bounds.end) + 1;
  const end = shiftDate(bounds.start, -1);
  const start = shiftDate(bounds.start, -length);
  return { start, end };
}

function inBounds(day: string | null, bounds: { start: string; end: string } | null) {
  if (!bounds) return true;
  if (!day) return false;
  return day >= bounds.start && day <= bounds.end;
}

function openInvoice(invoice: ClientInvoice) {
  return invoice.status === "pending" || invoice.status === "overdue";
}

function liveInvoice(invoice: ClientInvoice) {
  return invoice.status !== "cancelled";
}

function clientCreatedDay(client: DashboardClient) {
  return dayOf(client.createdAt) ?? dayOf(client.startsOn);
}

function overdueCentsOf(client: DashboardClient) {
  return client.invoices.filter((invoice) => invoice.status === "overdue").reduce((sum, invoice) => sum + invoice.totalCents, 0);
}

function isOverdueClient(client: DashboardClient) {
  return client.status !== "disabled" && client.status !== "contract_ended" && (client.status === "overdue" || overdueCentsOf(client) > 0);
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function deltaOf(current: number, previous: number, label = "vs período anterior"): DashboardDelta {
  return {
    value: current - previous,
    percent: percentChange(current, previous),
    label,
  };
}

function monthKey(day: string) {
  return day.slice(0, 7);
}

function monthLabel(key: string) {
  const [, month] = key.split("-");
  return MONTH_LABELS[Number(month) - 1] ?? key;
}

function shiftMonthKey(key: string, months: number) {
  const [yearText, monthText] = key.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthEnd(key: string, cap: string) {
  const next = `${shiftMonthKey(key, 1)}-01`;
  const end = shiftDate(next, -1);
  return end > cap ? cap : end;
}

function weekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00-03:00`).getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return shiftDate(day, offset);
}

function weekLabel(start: string) {
  const end = shiftDate(start, 6);
  const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function invoicesInPeriod(clients: DashboardClient[], bounds: { start: string; end: string } | null) {
  return clients.flatMap((client) =>
    client.invoices
      .filter((invoice) => liveInvoice(invoice) && inBounds(dayOf(invoice.dueDate), bounds))
      .map((invoice) => ({ client, invoice })),
  );
}

function kpi(value: number, previous: number | null, cents: number | null = null): DashboardKpi {
  return {
    value,
    cents,
    delta: previous == null ? null : deltaOf(value, previous),
  };
}

function defaultMonthPeriod(today = todayKey()): MetaPeriod {
  return { mode: "custom", since: `${today.slice(0, 7)}-01`, until: today };
}

export function resolveDashboardPeriod(period?: MetaPeriod | null, today = todayKey()): MetaPeriod {
  if (!period) return defaultMonthPeriod(today);
  if (period.mode === "total") return period;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period.since) || !/^\d{4}-\d{2}-\d{2}$/.test(period.until)) {
    return defaultMonthPeriod(today);
  }
  if (period.until < period.since) return { mode: "custom", since: period.until, until: period.since };
  return period;
}

export function masterDashboardFrom(
  clients: DashboardClient[],
  periodInput?: MetaPeriod | null,
  today = todayKey(),
): MasterDashboard {
  const period = resolveDashboardPeriod(periodInput, today);
  const bounds = periodBounds(period);
  const previous = bounds ? previousBounds(bounds) : null;

  const activeNow = clients.filter((client) => !isInactiveClient(client.status));
  const overdueNow = clients.filter(isOverdueClient);
  const inactiveNow = clients.filter((client) => isInactiveClient(client.status));
  const activeOnly = clients.filter((client) => client.status === "active").length;

  const newIn = (range: { start: string; end: string } | null) =>
    clients.filter((client) => inBounds(clientCreatedDay(client), range)).length;

  const revenueIn = (range: { start: string; end: string } | null) =>
    invoicesInPeriod(clients, range).reduce((sum, row) => sum + row.invoice.totalCents, 0);

  const overdueCountIn = (range: { start: string; end: string } | null) => {
    if (!range) return overdueNow.length;
    return new Set(
      invoicesInPeriod(clients, range)
        .filter((row) => row.invoice.status === "overdue")
        .map((row) => row.client.id),
    ).size;
  };

  const activeAt = (end: string) =>
    clients.filter((client) => {
      if (isInactiveClient(client.status) && client.status !== "blocked") {
        if (client.status === "disabled" || client.status === "contract_ended") {
          const ended = dayOf(client.endsOn);
          if (ended && ended <= end) return false;
        }
      }
      if (isInactiveClient(client.status)) return false;
      const created = clientCreatedDay(client);
      if (created && created > end) return false;
      return true;
    }).length;

  const dueWindow = (start: string, end: string) => {
    const rows = clients.flatMap((client) =>
      client.invoices.filter((invoice) => openInvoice(invoice) && inBounds(dayOf(invoice.dueDate), { start, end })),
    );
    return {
      count: rows.length,
      cents: rows.reduce((sum, invoice) => sum + invoice.totalCents, 0),
    };
  };

  const thisWeekStart = weekStart(today);
  const dueThisBounded = dueWindow(today, shiftDate(today, 6));
  const dueNext = dueWindow(shiftDate(today, 7), shiftDate(today, 13));

  const seriesEnd = bounds?.end ?? today;
  const endMonth = monthKey(seriesEnd);
  const revenueClientsSeries: DashboardMonthPoint[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const key = shiftMonthKey(endMonth, -i);
    const start = `${key}-01`;
    const end = monthEnd(key, seriesEnd);
    const monthBounds = { start, end };
    revenueClientsSeries.push({
      key,
      label: monthLabel(key),
      revenueCents: revenueIn(monthBounds),
      activeClients: activeAt(end),
    });
  }

  const periodRows = invoicesInPeriod(clients, bounds);
  const paidCents = periodRows.filter((row) => row.invoice.status === "paid").reduce((sum, row) => sum + row.invoice.totalCents, 0);
  const pendingCents = periodRows.filter((row) => row.invoice.status === "pending").reduce((sum, row) => sum + row.invoice.totalCents, 0);
  const overdueCents = periodRows.filter((row) => row.invoice.status === "overdue").reduce((sum, row) => sum + row.invoice.totalCents, 0);
  const paymentTotal = paidCents + pendingCents + overdueCents;
  const paymentSlices: DashboardSlice[] = [
    { key: "paid", label: "Recebido", value: paidCents, cents: paidCents, percent: paymentTotal ? Math.round((paidCents / paymentTotal) * 100) : 0 },
    { key: "pending", label: "A vencer", value: pendingCents, cents: pendingCents, percent: paymentTotal ? Math.round((pendingCents / paymentTotal) * 100) : 0 },
    { key: "overdue", label: "Em atraso", value: overdueCents, cents: overdueCents, percent: paymentTotal ? Math.round((overdueCents / paymentTotal) * 100) : 0 },
  ];

  let unknownGeoClients = 0;
  const ufCounts = new Map<string, number>();
  for (const client of clients) {
    if (client.status === "disabled") continue;
    const uf = normalizeUf(client.state);
    if (!uf) {
      unknownGeoClients += 1;
      continue;
    }
    ufCounts.set(uf, (ufCounts.get(uf) ?? 0) + 1);
  }
  const geoTotal = [...ufCounts.values()].reduce((sum, value) => sum + value, 0);
  const regions: DashboardRegion[] = REGIONS.map((region) => {
    const count = region.ufs.reduce((sum, uf) => sum + (ufCounts.get(uf) ?? 0), 0);
    return {
      key: region.key,
      label: region.label,
      clients: count,
      percent: geoTotal ? Math.round((count / geoTotal) * 100) : 0,
    };
  }).sort((left, right) => right.clients - left.clients || left.label.localeCompare(right.label, "pt-BR"));

  const ufs = [...ufCounts.entries()]
    .map(([uf, count]) => ({ uf, clients: count }))
    .sort((left, right) => right.clients - left.clients || left.uf.localeCompare(right.uf))
    .slice(0, 10);

  const revenueByClient = new Map<string, { id: string; name: string; revenueCents: number }>();
  for (const row of periodRows) {
    const current = revenueByClient.get(row.client.id) ?? {
      id: row.client.id,
      name: clientDisplayName(row.client),
      revenueCents: 0,
    };
    current.revenueCents += row.invoice.totalCents;
    revenueByClient.set(row.client.id, current);
  }
  const ranked = [...revenueByClient.values()].sort((left, right) => right.revenueCents - left.revenueCents);
  const topRevenue = ranked.reduce((sum, row) => sum + row.revenueCents, 0) || 1;
  const topClients = ranked.slice(0, 5).map((row) => ({
    id: row.id,
    name: row.name,
    revenueCents: row.revenueCents,
    percent: Math.round((row.revenueCents / topRevenue) * 1000) / 10,
  }));

  const dueWeeks: DashboardWeekBucket[] = [];
  for (let i = 0; i < 4; i += 1) {
    const start = shiftDate(thisWeekStart, i * 7);
    const end = shiftDate(start, 6);
    const rows = clients.flatMap((client) =>
      client.invoices.filter((invoice) => openInvoice(invoice) && inBounds(dayOf(invoice.dueDate), { start, end })),
    );
    dueWeeks.push({
      key: start,
      label: weekLabel(start),
      count: rows.length,
      cents: rows.reduce((sum, invoice) => sum + invoice.totalCents, 0),
    });
  }

  const statusTotal = activeOnly + overdueNow.length + inactiveNow.length;
  const statusSlices: DashboardSlice[] = [
    { key: "active", label: "Ativos", value: activeOnly, cents: 0, percent: statusTotal ? Math.round((activeOnly / statusTotal) * 100) : 0 },
    { key: "overdue", label: "Em atraso", value: overdueNow.length, cents: 0, percent: statusTotal ? Math.round((overdueNow.length / statusTotal) * 100) : 0 },
    { key: "inactive", label: "Inativos", value: inactiveNow.length, cents: 0, percent: statusTotal ? Math.round((inactiveNow.length / statusTotal) * 100) : 0 },
  ];

  const revenueCents = revenueIn(bounds);
  const previousRevenue = previous ? revenueIn(previous) : null;

  return {
    period,
    today,
    activeClients: kpi(activeNow.length, previous ? activeAt(previous.end) : null),
    newClients: kpi(newIn(bounds), previous ? newIn(previous) : null),
    periodRevenue: kpi(revenueCents, previousRevenue, revenueCents),
    overdueClients: kpi(overdueCountIn(bounds), previous ? overdueCountIn(previous) : null),
    dueThisWeek: { value: dueThisBounded.count, cents: dueThisBounded.cents, delta: null },
    dueNextWeek: { value: dueNext.count, cents: dueNext.cents, delta: null },
    revenueClientsSeries,
    paymentSlices,
    regions,
    ufs,
    topClients,
    dueWeeks,
    statusSlices,
    unknownGeoClients,
  };
}
