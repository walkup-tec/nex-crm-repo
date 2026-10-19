export type NexDeployStatus = {
  ok: boolean;
  shuttingDown: boolean;
  ready: boolean;
  deployMarker: string;
  serverBootId: string;
  evolution: string;
};

type NexProcess = typeof globalThis & {
  __NEX_DEPLOY?: string;
  __NEX_BOOT_ID?: string;
  __NEX_SHUTTING_DOWN?: boolean;
  __NEX_EVO_REACH?: string;
};

export function nexDeployStatus(): NexDeployStatus {
  const runtime = globalThis as NexProcess;
  const shuttingDown = runtime.__NEX_SHUTTING_DOWN === true;
  return {
    ok: !shuttingDown,
    shuttingDown,
    ready: !shuttingDown,
    deployMarker: runtime.__NEX_DEPLOY || "local",
    serverBootId: runtime.__NEX_BOOT_ID || "local",
    evolution: runtime.__NEX_EVO_REACH || "",
  };
}
