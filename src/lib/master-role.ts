import { supabase } from "@/integrations/supabase/client";

export const MASTER_ROLE_ATTEMPTS = 4;

export type RoleRead = { roles: readonly string[] | null; error: boolean };
export type MasterDecision = "master" | "client" | "retry";

export function decideMaster(
  read: RoleRead,
  attempt: number,
  maxAttempts = MASTER_ROLE_ATTEMPTS,
): MasterDecision {
  if (read.roles?.includes("master")) return "master";
  if (!read.error && read.roles !== null && read.roles.length > 0) return "client";
  if (attempt + 1 < maxAttempts) return "retry";
  return "client";
}

export function masterFromReads(
  reads: readonly RoleRead[],
  maxAttempts = MASTER_ROLE_ATTEMPTS,
): boolean {
  const total = Math.min(maxAttempts, reads.length);
  for (let attempt = 0; attempt < total; attempt += 1) {
    const read = reads[attempt];
    if (!read) return false;
    const decision = decideMaster(read, attempt, maxAttempts);
    if (decision === "retry") continue;
    return decision === "master";
  }
  return false;
}

export function clientNavPaths(paths: readonly string[], showClients: boolean): string[] {
  if (!showClients || paths.includes("/master/clientes")) return [...paths];
  const [first, ...rest] = paths;
  if (!first) return ["/master/clientes"];
  return [first, "/master/clientes", ...rest];
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readMasterRoles(
  userId: string,
): Promise<{ master: boolean; roles: readonly string[] }> {
  const reads: RoleRead[] = [];
  for (let attempt = 0; attempt < MASTER_ROLE_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const previous = reads[attempt - 1];
      if (previous?.error) await supabase.auth.refreshSession();
      await wait(200 * attempt);
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      reads.push({ roles: null, error: true });
      continue;
    }
    const { data: rows, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rows ?? []).map((row) => row.role);
    const read: RoleRead = { roles: error ? null : roles, error: error !== null };
    reads.push(read);
    const decision = decideMaster(read, attempt);
    if (decision === "master") return { master: true, roles };
    if (decision === "client") return { master: false, roles: read.roles ?? [] };
  }
  const last = reads[reads.length - 1];
  return { master: masterFromReads(reads), roles: last?.roles ?? [] };
}
