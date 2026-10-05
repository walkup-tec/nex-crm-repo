import { createServerFn } from "@tanstack/react-start";
import type { ActivationState } from "@/lib/activation-access";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error("activation", /password|senha/i.test(message) ? "redacted" : message);
  if (message.startsWith("Entre em contato com o administrador")) return message;
  if (message === "Este acesso está bloqueado." || message === "Este acesso já possui senha. Entre na tela de login.") return message;
  if (message === "Use pelo menos 8 caracteres." || message.startsWith("Escolha uma senha")) return message;
  if (message === "Informe um e-mail válido.") return message;
  return "Não foi possível concluir o primeiro acesso.";
}

async function guard<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export const checkAccessEmailFn = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }): Promise<Result<{ state: ActivationState }>> => {
    const { checkAccessEmail } = await import("@/server/activation.server");
    return guard(() => checkAccessEmail(data.email));
  });

export const createAccessPasswordFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }): Promise<Result<{ email: string }>> => {
    const { createAccessPassword } = await import("@/server/activation.server");
    return guard(() => createAccessPassword(data.email, data.password));
  });
