/** Definições MCP (tools) do NEX Career Intelligence — espelha as operações REST. */

export const CAREER_MCP_PROTOCOL_VERSION = "2025-06-18";
export const CAREER_MCP_SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"] as const;
export const CAREER_MCP_SERVER_INFO = {
  name: "nex-career-intelligence",
  title: "NEX Career Intelligence",
  version: "1.0.0",
} as const;

export const CAREER_MCP_INSTRUCTIONS =
  "Persista resultados de pesquisa de empresas, vagas e contatos no NEX. " +
  "Use career_applications_prepare apenas para preparar textos — nunca envie candidaturas automaticamente. " +
  "Prefira idempotency_key estável por lote. Autenticação: Bearer CHATGPT_INTEGRATION_SECRET (direto) ou OAuth JWT (ChatGPT Web).";

type JsonSchema = Record<string, unknown>;

export type CareerMcpToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
};

const companyItem: JsonSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    name: { type: "string" },
    cnpj: { type: "string" },
    website: { type: "string" },
    linkedinUrl: { type: "string" },
    segment: { type: "string" },
    category: { type: "string", enum: ["agency", "enterprise", "inhouse_marketing", "other"] },
    city: { type: "string" },
    state: { type: "string" },
    corporateEmail: { type: "string" },
    hrEmail: { type: "string" },
    businessWhatsapp: { type: "string" },
    recruiterNames: { type: "string" },
    source: { type: "string" },
    prospectStatus: {
      type: "string",
      enum: ["new", "researching", "contacted", "qualified", "archived"],
    },
  },
  required: ["name"],
};

const contactItem: JsonSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    companyId: { type: "string", format: "uuid" },
    company_id: { type: "string", format: "uuid" },
    companyName: { type: "string" },
    company_name: { type: "string" },
    kind: {
      type: "string",
      description:
        "hr_email | recruiting_email | business_whatsapp | company_linkedin | recruiter_linkedin | marketing_manager_linkedin | person | other (aliases: email, whatsapp, linkedin).",
    },
    fullName: { type: "string" },
    full_name: { type: "string" },
    title: { type: "string" },
    value: { type: "string" },
    verificationStatus: { type: "string", enum: ["confirmed", "unverified", "not_found"] },
    verification_status: { type: "string", enum: ["confirmed", "unverified", "not_found"] },
    source: { type: "string" },
  },
  required: ["kind", "value"],
};

const jobItem: JsonSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    companyId: { type: "string", format: "uuid" },
    company_id: { type: "string", format: "uuid" },
    companyName: { type: "string" },
    company_name: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    url: { type: "string" },
    platform: { type: "string" },
    location: { type: "string" },
    workMode: { type: "string" },
    work_mode: { type: "string" },
    contractType: { type: "string" },
    contract_type: { type: "string" },
    salaryRange: { type: "string" },
    salary_range: { type: "string" },
    requirements: { type: "string" },
    publishedAt: { type: "string" },
    published_at: { type: "string" },
    applicationChannel: { type: "string" },
    application_channel: { type: "string" },
    compatibilityScore: { type: "number" },
    compatibility_score: { type: "number" },
    compatibilityNotes: { type: "string" },
    compatibility_notes: { type: "string" },
    opportunityStatus: { type: "string" },
    opportunity_status: { type: "string" },
    source: { type: "string" },
  },
  required: ["title"],
};

export const careerMcpTools: CareerMcpToolDefinition[] = [
  {
    name: "career_health",
    title: "Career health",
    description: "Verifica saúde do módulo Career (contagens de empresas, vagas e execuções).",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "career_companies_discover",
    title: "Discover companies",
    description: "Salva empresas descobertas com deduplicação (CNPJ/domínio/LinkedIn/nome+cidade+UF).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        idempotency_key: { type: "string" },
        companies: { type: "array", items: companyItem },
      },
      required: ["companies"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "career_companies_import",
    title: "Import companies",
    description: "Importa/atualiza empresas (mesmo motor de dedupe do discover).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        idempotency_key: { type: "string" },
        companies: { type: "array", items: companyItem },
      },
      required: ["companies"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "career_companies_list",
    title: "List companies",
    description: "Lista empresas já cadastradas no NEX Career.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        q: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 200 },
        offset: { type: "integer", minimum: 0 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "career_companies_get",
    title: "Get company",
    description: "Retorna detalhe de uma empresa por UUID.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { id: { type: "string", format: "uuid" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "career_companies_enrich",
    title: "Enrich company contacts",
    description: "Persiste contatos públicos de empresas (e-mail, WhatsApp, LinkedIn etc.).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        idempotency_key: { type: "string" },
        contacts: { type: "array", items: contactItem },
      },
      required: ["contacts"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "career_jobs_search",
    title: "Search jobs",
    description: "Salva vagas pesquisadas com deduplicação por URL ou empresa+título+plataforma.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        idempotency_key: { type: "string" },
        jobs: { type: "array", items: jobItem },
      },
      required: ["jobs"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "career_jobs_list",
    title: "List jobs",
    description: "Lista vagas cadastradas no NEX Career.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        q: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 200 },
        offset: { type: "integer", minimum: 0 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "career_jobs_get",
    title: "Get job",
    description: "Retorna detalhe de uma vaga por UUID.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { id: { type: "string", format: "uuid" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "career_applications_prepare",
    title: "Prepare application",
    description:
      "Prepara textos de candidatura (status ready). NÃO envia e-mail/LinkedIn/WhatsApp — aprovação humana no painel NEX.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        jobId: { type: "string", format: "uuid" },
        job_id: { type: "string", format: "uuid" },
        compatibilityAnalysis: { type: "string" },
        recommendedResume: { type: "string" },
        introMessage: { type: "string" },
        emailBody: { type: "string" },
        linkedinMessage: { type: "string" },
        whatsappMessage: { type: "string" },
        guidance: { type: "string" },
        idempotency_key: { type: "string" },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "career_applications_list",
    title: "List applications",
    description: "Lista candidaturas preparadas (sem envio automático).",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "career_history",
    title: "Execution history",
    description: "Histórico de execuções do plugin Career.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "career_execution_get",
    title: "Get execution",
    description: "Detalhe de uma execução por UUID.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { id: { type: "string", format: "uuid" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export function listCareerMcpToolNames() {
  return careerMcpTools.map((tool) => tool.name);
}

export function findCareerMcpTool(name: string) {
  return careerMcpTools.find((tool) => tool.name === name) ?? null;
}
