export type MetaAccountView = {
  id: string;
  accountId: string;
  name: string;
  currency: string | null;
  statusLabel: string;
};

export type MetaConnectionView = {
  status: "missing" | "pending" | "connected" | "error" | "disconnected";
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  selectedAccountId: string | null;
  selectedAccountName: string | null;
  accounts: MetaAccountView[];
};
