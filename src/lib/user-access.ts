export type UserRole = "master" | "client_admin" | "client_user";

export type UserPermissions = {
  campaigns: boolean;
  balance: boolean;
  credit: boolean;
  manage: boolean;
  chatbot: boolean;
};

export type ListedUser = {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  financeEmail: string;
  financeEmailSame: boolean;
  role: UserRole;
  blocked: boolean;
  organizationId: string | null;
  ownerId: string | null;
  ownerName: string | null;
  permissions: UserPermissions;
  canManage: boolean;
  metaLinked: boolean;
  metaProblem: boolean;
  adsMeta: boolean;
  adsGoogle: boolean;
};

export type MetaConnectionProblem = {
  organizationId: string;
  name: string;
};

export function metaConnectionBroken(
  row: { status?: string | null; lastError?: string | null; expiresAt?: string | null },
  now = Date.now(),
) {
  if (!row.status || row.status === "missing" || row.status === "disconnected") return false;
  if (row.status === "error" || Boolean(row.lastError?.trim())) return true;
  const expires = row.expiresAt ? Date.parse(row.expiresAt) : Number.NaN;
  return Number.isFinite(expires) && expires < now;
}

export type RegisteredClient = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  adsMeta: boolean;
  adsGoogle: boolean;
};

export function adsConnectionSections(flags: { adsMeta?: boolean; adsGoogle?: boolean } | null | undefined) {
  if (!flags) return { meta: true, google: false };
  return { meta: flags.adsMeta === true, google: flags.adsGoogle === true };
}

export type UsersSnapshot = {
  actor: { id: string; role: UserRole; fullName: string; organizationId: string | null };
  users: ListedUser[];
};
