import { createFileRoute } from "@tanstack/react-router";

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (
    message.startsWith("Informe") ||
    message.startsWith("Envie") ||
    message.startsWith("Esse formato") ||
    message.startsWith("O arquivo") ||
    message.includes(": Envie") ||
    message.includes(": Esse formato") ||
    message.includes(": O arquivo") ||
    message === "Este link de contratação não está disponível." ||
    message === "A migração da contratação ainda não foi aplicada no Supabase." ||
    message === "Não foi possível registrar a contratação." ||
    message === "Não foi possível guardar os documentos." ||
    message === "Não foi possível receber a contratação."
  ) {
    return message;
  }
  console.error("contracting", message);
  return "Não foi possível receber a contratação.";
}

export const Route = createFileRoute("/api/contratacao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const { saveContracting } = await import("@/server/contracting.server");
          const saved = await saveContracting(form);
          return Response.json({ ok: true, id: saved.id, protocol: saved.protocol, name: saved.name });
        } catch (error) {
          return Response.json({ ok: false, message: publicMessage(error) }, { status: 400 });
        }
      },
    },
  },
});
