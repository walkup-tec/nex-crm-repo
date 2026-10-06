export type UserRole = "master" | "client_admin" | "client_user";

export type UserPermissions = {
  campaigns: boolean;
  balance: boolean;
  credit: boolean;
  manage: boolean;
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
};

export type RegisteredClient = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
};

export type UsersSnapshot = {
  actor: { id: string; role: UserRole; fullName: string; organizationId: string | null };
  users: ListedUser[];
};
