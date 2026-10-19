import { createFileRoute } from "@tanstack/react-router";
import { ContractingFormPage } from "./contratacao";

export const Route = createFileRoute("/contratacao/$contactId")({
  head: () => ({
    meta: [
      { title: "Contratação — Agência NEX" },
      { name: "description", content: "Envie os dados e os documentos da contratação." },
    ],
  }),
  component: ContractingFormPage,
});
