function fail(message: string): never {
  throw new Error(message);
}

export async function lookupCnpj(document: string) {
  const cnpj = document.replace(/\D/g, "");
  if (cnpj.length !== 14) fail("Informe um CNPJ com 14 dígitos.");
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "NEX-Ads/1.0 (https://app.nexmeta.com.br)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) fail("CNPJ não encontrado. Informe a razão social.");
  if (!response.ok) fail("Não foi possível consultar o CNPJ agora. Informe a razão social.");
  const body = (await response.json()) as { razao_social?: string };
  const legalName = body.razao_social?.trim() ?? "";
  if (legalName.length < 2) fail("A consulta não trouxe a razão social. Informe o nome.");
  return { legalName };
}
