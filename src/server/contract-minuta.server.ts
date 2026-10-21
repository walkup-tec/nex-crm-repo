import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fillContractMinutaDocx, type ContractMinutaFields } from "@/lib/contract-minuta";

function templateBytes() {
  const paths = [join(process.cwd(), "assets", "minuta-nex.docx"), "/app/assets/minuta-nex.docx"];
  for (const path of paths) {
    try {
      return readFileSync(path);
    } catch {
      continue;
    }
  }
  throw new Error("A minuta não está disponível no servidor.");
}

export function filledContractPdf(fields: ContractMinutaFields) {
  const docx = fillContractMinutaDocx(templateBytes(), fields);
  const dir = mkdtempSync(join(tmpdir(), "minuta-"));
  const source = join(dir, "minuta.docx");
  try {
    writeFileSync(source, docx);
    execFileSync(
      "soffice",
      [
        `-env:UserInstallation=file://${dir}`,
        "--headless",
        "--norestore",
        "--nolockcheck",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to",
        "pdf",
        "--outdir",
        dir,
        source,
      ],
      {
        timeout: 120000,
        env: { ...process.env, HOME: dir },
      },
    );
    const pdf = readFileSync(join(dir, "minuta.pdf"));
    if (pdf.subarray(0, 4).toString("ascii") !== "%PDF") throw new Error("A minuta preenchida não pôde ser gerada. O arquivo gerado não é um PDF.");
    return pdf.toString("base64");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("A minuta") && error.message !== "A minuta preenchida não pôde ser gerada.") throw error;
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    const detail = stderr
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !/javaldx|warning:|warn:/i.test(line)) ?? "";
    const safe = detail.replace(/\s+/g, " ").slice(0, 160);
    console.error("contract_minuta", safe || (error instanceof Error ? error.message.slice(0, 160) : ""));
    if (/ENOENT|not found/i.test(error instanceof Error ? error.message : "")) {
      throw new Error("A minuta preenchida não pôde ser gerada. O conversor não está disponível no servidor.");
    }
    throw new Error(safe ? `A minuta preenchida não pôde ser gerada. ${safe}` : "A minuta preenchida não pôde ser gerada.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
