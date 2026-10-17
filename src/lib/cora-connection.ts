export type CoraSettings = {
  id: string;
  base: string;
  cert: string;
  key: string;
  secret: string;
  direct: boolean;
};

export function normalizePem(value: string) {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}

export function resolveCoraSettings(env: {
  id?: string | undefined;
  secret?: string | undefined;
  base?: string | undefined;
  cert?: string | undefined;
  key?: string | undefined;
}): CoraSettings {
  const id = env.id?.trim() ?? "";
  const secret = env.secret?.trim() ?? "";
  const cert = normalizePem(env.cert ?? "");
  const key = normalizePem(env.key ?? "");
  const direct = Boolean(cert && key);
  const requested = env.base?.trim() ?? "";
  if (!id) throw new Error("A Cora ainda não está configurada no servidor.");
  if (!direct && /matls-clients/i.test(requested)) {
    throw new Error("A Cora de produção exige o certificado e a private key no servidor.");
  }
  if (!direct && !secret) throw new Error("A Cora ainda não está configurada no servidor.");
  const base = (requested || (direct ? "https://matls-clients.api.cora.com.br" : "https://api.stage.cora.com.br")).replace(
    /\/$/,
    "",
  );
  return { id, base, cert, key, secret, direct };
}
