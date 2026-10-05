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
  role: UserRole;
  blocked: boolean;
  ownerId: string | null;
  ownerName: string | null;
  permissions: UserPermissions;
  canManage: boolean;
};

export type UsersSnapshot = {
  actor: { id: string; role: UserRole; fullName: string };
  users: ListedUser[];
};
