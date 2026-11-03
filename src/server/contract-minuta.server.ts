import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fillContractMinutaDocx, type ContractMinutaFields } from "@/lib/contract-minuta";

const execFileAsync = promisify(execFile);

async function templateBytes() {
  const paths = [join(process.cwd(), "assets", "minuta-nex.docx"), "/app/assets/minuta-nex.docx"];
  for (const path of paths) {
    try {
      return await readFile(path);
    } catch {
      continue;
    }
  }
  throw new Error("A minuta não está disponível no servidor.");
}

/**
 * Converte a minuta em PDF via LibreOffice sem travar o event loop do Node
 * (execFile assíncrono — execFileSync impedia a resposta HTTP de sair).
 */
export async function filledContractPdf(fields: ContractMinutaFields) {
  const docx = fillContractMinutaDocx(await templateBytes(), fields);
  const dir = await mkdtemp(join(tmpdir(), "minuta-"));
  const source = join(dir, "minuta.docx");
  try {
    await writeFile(source, docx);
    await execFileAsync(
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
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    const pdf = await readFile(join(dir, "minuta.pdf"));
    if (pdf.subarray(0, 4).toString("ascii") !== "%PDF") {
      throw new Error("A minuta preenchida não pôde ser gerada. O arquivo gerado não é um PDF.");
    }
    return pdf.toString("base64");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("A minuta") && error.message !== "A minuta preenchida não pôde ser gerada.") {
      throw error;
    }
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    const detail =
      stderr
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
    await rm(dir, { recursive: true, force: true });
  }
}
