import { buildChargeCardSvg, type ChargeCardInput } from "@/lib/charge-card";
import { chargeCardFontBoldBase64 } from "@/vendor/charge-card/font-bold.b64";
import { chargeCardFontRegularBase64 } from "@/vendor/charge-card/font-regular.b64";
import { chargeCardLogoBase64 } from "@/vendor/charge-card/logo.b64";
import { chargeCardWasmBase64 } from "@/vendor/charge-card/wasm.b64";
import { initWasm, Resvg } from "@/vendor/charge-card/resvg.js";

let wasmReady: Promise<void> | null = null;

function decode(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function ensureWasm() {
  if (!wasmReady) {
    wasmReady = initWasm(decode(chargeCardWasmBase64)).catch((error: unknown) => {
      wasmReady = null;
      throw error;
    });
  }
  return wasmReady;
}

export async function renderChargeCardPng(input: Omit<ChargeCardInput, "logoBase64">) {
  await ensureWasm();
  const svg = buildChargeCardSvg({ ...input, logoBase64: chargeCardLogoBase64 });
  const renderer = new Resvg(svg, {
    font: {
      fontBuffers: [decode(chargeCardFontRegularBase64), decode(chargeCardFontBoldBase64)],
      defaultFontFamily: "Inter",
      sansSerifFamily: "Inter",
    },
    shapeRendering: 2,
    textRendering: 1,
  });
  const png = renderer.render().asPng();
  renderer.free();
  return Buffer.from(png);
}
