/** OpenAPI exclusivo do plugin NEX Career Intelligence (não altera o contrato Meta Ads). */
export function chatgptCareerOpenApiDocument(serverUrl: string) {
  const base = serverUrl.replace(/\/$/, "");
  const bearer = [{ bearerAuth: [] }];
  const jsonObject = {
    description: "JSON",
    content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "NEX Career Intelligence — ChatGPT Integration",
      version: "1.0.0",
      description:
        "API autenticada para o plugin NEX Career Intelligence persistir e consultar empresas, vagas, contatos e candidaturas. Autenticação REST/MCP direto: Bearer CHATGPT_INTEGRATION_SECRET. MCP Streamable HTTP em /api/integrations/chatgpt/career/mcp. ChatGPT Web: OAuth 2.1 authorization_code + PKCE S256 (AS metadata em /.well-known/oauth-authorization-server; PRM em /.well-known/oauth-protected-resource). Tokens OAuth assinados com CAREER_MCP_OAUTH_SIGNING_SECRET (separado do Bearer). career_applications_prepare só prepara rascunho — sem envio automático.",
    },
    servers: [{ url: base }],
    paths: {
      "/api/integrations/chatgpt/career/health": {
        get: {
          operationId: "career_health",
          summary: "Health do módulo Career",
          security: bearer,
          responses: { "200": jsonObject, "401": { description: "Não autenticado" } },
        },
      },
      "/api/integrations/chatgpt/career/companies/discover": {
        post: {
          operationId: "career_companies_discover",
          summary: "Salvar empresas descobertas (com deduplicação)",
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    idempotency_key: { type: "string" },
                    companies: { type: "array", items: { type: "object", additionalProperties: true } },
                  },
                },
              },
            },
          },
          responses: {
            "200": jsonObject,
            "401": { description: "Não autenticado" },
            "429": { description: "Rate limit" },
          },
        },
      },
      "/api/integrations/chatgpt/career/companies": {
        get: {
          operationId: "career_companies_list",
          summary: "Listar empresas já cadastradas",
          security: bearer,
          parameters: [
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "offset", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": jsonObject, "401": { description: "Não autenticado" } },
        },
        post: {
          operationId: "career_companies_import",
          summary: "Importar/atualizar empresas",
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    idempotency_key: { type: "string" },
                    companies: { type: "array", items: { type: "object", additionalProperties: true } },
                  },
                },
              },
            },
          },
          responses: { "200": jsonObject, "401": { description: "Não autenticado" } },
        },
      },
      "/api/integrations/chatgpt/career/companies/{id}": {
        get: {
          operationId: "career_companies_get",
          summary: "Detalhe de empresa",
          security: bearer,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": jsonObject, "404": { description: "Não encontrada" } },
        },
      },
      "/api/integrations/chatgpt/career/companies/enrich": {
        post: {
          operationId: "career_companies_enrich",
          summary: "Enriquecer contatos públicos de empresas",
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    idempotency_key: { type: "string" },
                    contacts: { type: "array", items: { type: "object", additionalProperties: true } },
                  },
                },
              },
            },
          },
          responses: { "200": jsonObject },
        },
      },
      "/api/integrations/chatgpt/career/jobs/search": {
        post: {
          operationId: "career_jobs_search",
          summary: "Salvar vagas pesquisadas (com deduplicação)",
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    idempotency_key: { type: "string" },
                    jobs: { type: "array", items: { type: "object", additionalProperties: true } },
                  },
                },
              },
            },
          },
          responses: { "200": jsonObject },
        },
      },
      "/api/integrations/chatgpt/career/jobs": {
        get: {
          operationId: "career_jobs_list",
          summary: "Listar vagas",
          security: bearer,
          responses: { "200": jsonObject },
        },
      },
      "/api/integrations/chatgpt/career/jobs/{id}": {
        get: {
          operationId: "career_jobs_get",
          summary: "Detalhe de vaga",
          security: bearer,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": jsonObject },
        },
      },
      "/api/integrations/chatgpt/career/applications/prepare": {
        post: {
          operationId: "career_applications_prepare",
          summary: "Preparar textos de candidatura (sem envio automático)",
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["jobId"],
                  properties: {
                    jobId: { type: "string", format: "uuid" },
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
              },
            },
          },
          responses: { "200": jsonObject },
        },
      },
      "/api/integrations/chatgpt/career/applications": {
        get: {
          operationId: "career_applications_list",
          summary: "Listar candidaturas preparadas",
          security: bearer,
          responses: { "200": jsonObject },
        },
      },
      "/api/integrations/chatgpt/career/history": {
        get: {
          operationId: "career_history",
          summary: "Histórico de execuções",
          security: bearer,
          responses: { "200": jsonObject },
        },
      },
      "/api/integrations/chatgpt/career/executions/{id}": {
        get: {
          operationId: "career_execution_get",
          summary: "Detalhe de execução",
          security: bearer,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": jsonObject },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "REST/MCP direto: CHATGPT_INTEGRATION_SECRET. ChatGPT Web usa OAuth JWT (CAREER_MCP_OAUTH_SIGNING_SECRET), não este Bearer.",
        },
      },
    },
  };
}
