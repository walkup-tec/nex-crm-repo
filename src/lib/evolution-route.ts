export function gatewayFromProcRoute(route: string) {
  const lines = route.trim().split(/\r?\n/).slice(1);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[1] !== "00000000") continue;
    const hex = parts[2] ?? "";
    if (!/^[0-9a-fA-F]{8}$/.test(hex) || hex === "00000000") continue;
    const bytes = hex.match(/../g);
    if (!bytes) continue;
    return bytes.map((byte) => String(parseInt(byte, 16))).reverse().join(".");
  }
  return "";
}

export function evolutionBaseUrls(input: {
  configured: string;
  gateway: string;
  hostUrl: string;
  publicUrl: string;
}) {
  const gatewayUrl = dockerGatewayUrl(input.gateway);
  return [input.configured, "http://127.0.0.1:30181", gatewayUrl, input.hostUrl, input.publicUrl].filter(
    (base, index, all) => Boolean(base) && all.indexOf(base) === index,
  );
}

function dockerGatewayUrl(gateway: string) {
  const match = /^172\.(1[6-9]|2\d|3[0-1])\.(\d{1,3})\.(\d{1,3})$/.exec(gateway.trim());
  if (!match) return "";
  return `http://${gateway.trim()}:30181`;
}
