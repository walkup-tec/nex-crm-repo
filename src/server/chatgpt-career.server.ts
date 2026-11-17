import {
  authenticateChatgptIntegration,
} from "@/server/chatgpt-integration.server";
import { consumeRateLimit } from "@/lib/chatgpt-integration";
import { chatgptCareerOpenApiDocument } from "@/lib/chatgpt-career-openapi";
import {
  enrichCareerContacts,
  pluginGetCompany,
  pluginGetExecution,
  pluginGetJob,
  pluginListApplications,
  pluginListCompanies,
  pluginListHistory,
  pluginListJobs,
  prepareCareerApplication,
  upsertCareerCompanies,
  upsertCareerJobs,
} from "@/server/career.server";

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("cf-connecting-ip") || "unknown";
}

function audit(event: string, fields: Record<string, unknown>) {
  console.info("chatgpt_career_audit", JSON.stringify({ event, ...fields }));
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function careerPath(pathname: string) {
  const marker = "/api/integrations/chatgpt/career";
  const idx = pathname.indexOf(marker);
  if (idx < 0) return "";
  return pathname.slice(idx + marker.length).replace(/\/+$/, "") || "/";
}

export function handleChatgptCareerOpenApiRequest(request: Request): Response {
  const authError = authenticateChatgptIntegration(request);
  if (authError) return authError;
  const appUrl = (process.env["APP_URL"]?.trim() || new URL(request.url).origin).replace(/\/$/, "");
  return json(200, chatgptCareerOpenApiDocument(appUrl));
}

export async function handleChatgptCareerRequest(request: Request): Promise<Response> {
  const authError = authenticateChatgptIntegration(request);
  if (authError) {
    audit("auth_rejected", { path: request.url, status: authError.status });
    return authError;
  }

  const rate = consumeRateLimit(`chatgpt-career:${clientKey(request)}`);
  if (!rate.allowed) {
    return json(
      429,
      { error: "rate_limited", message: "Limite de requisições excedido." },
      { "retry-after": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))) },
    );
  }

  const url = new URL(request.url);
  const path = careerPath(url.pathname);
  const method = request.method.toUpperCase();

  try {
    if (path === "/openapi" && method === "GET") {
      return handleChatgptCareerOpenApiRequest(request);
    }

    // MCP tem rota dedicada (/career/mcp); se o splat capturar, delega sem alterar o REST.
    if (path === "/mcp") {
      const { handleChatgptCareerMcpRequest } = await import("@/server/chatgpt-career-mcp.server");
      return handleChatgptCareerMcpRequest(request);
    }

    if ((path === "/health" || path === "/overview") && method === "GET") {
      const { pluginListCompanies, pluginListJobs, pluginListHistory } = await import("@/server/career.server");
      const [companies, jobs, history] = await Promise.all([
        pluginListCompanies({ limit: 1, offset: 0 }),
        pluginListJobs({ limit: 1, offset: 0 }),
        pluginListHistory(),
      ]);
      return json(200, {
        ok: true,
        companies: companies.total,
        jobs: jobs.total,
        executions: history.items.length,
      });
    }

    if (path === "/companies/discover" && method === "POST") {
      const body = (await readJson(request)) as {
        companies?: unknown[];
        idempotency_key?: string;
      } | null;
      const companies = Array.isArray(body?.companies) ? body.companies : [];
      const result = await upsertCareerCompanies({
        companies: companies as never[],
        actorSource: "plugin",
        idempotencyKey: body?.idempotency_key ?? null,
        kind: "companies_discover",
      });
      audit("companies_discover", { execution_id: result.executionId, ...result.counts });
      return json(200, {
        execution_id: result.executionId,
        replay: result.replay,
        received: result.counts.received,
        created: result.counts.created,
        updated: result.counts.updated,
        duplicates: result.counts.duplicates,
        errors: result.counts.errors,
      });
    }

    if (path === "/companies/enrich" && method === "POST") {
      const body = (await readJson(request)) as {
        contacts?: unknown[];
        idempotency_key?: string;
      } | null;
      const result = await enrichCareerContacts({
        contacts: (Array.isArray(body?.contacts) ? body.contacts : []) as never[],
        actorSource: "plugin",
        idempotencyKey: body?.idempotency_key ?? null,
      });
      return json(200, {
        execution_id: result.executionId,
        replay: result.replay,
        ...result.counts,
      });
    }

    if (path === "/companies" && method === "GET") {
      const data = await pluginListCompanies({
        q: url.searchParams.get("q") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 50),
        offset: Number(url.searchParams.get("offset") ?? 0),
      });
      return json(200, data);
    }

    if (path === "/companies" && method === "POST") {
      const body = (await readJson(request)) as {
        companies?: unknown[];
        idempotency_key?: string;
      } | null;
      const result = await upsertCareerCompanies({
        companies: (Array.isArray(body?.companies) ? body.companies : []) as never[],
        actorSource: "plugin",
        idempotencyKey: body?.idempotency_key ?? null,
        kind: "import",
      });
      return json(200, {
        execution_id: result.executionId,
        replay: result.replay,
        ...result.counts,
      });
    }

    const companyMatch = /^\/companies\/([^/]+)$/.exec(path);
    if (companyMatch && method === "GET") {
      return json(200, await pluginGetCompany(companyMatch[1]!));
    }

    if (path === "/jobs/search" && method === "POST") {
      const body = (await readJson(request)) as {
        jobs?: unknown[];
        idempotency_key?: string;
      } | null;
      const result = await upsertCareerJobs({
        jobs: (Array.isArray(body?.jobs) ? body.jobs : []) as never[],
        actorSource: "plugin",
        idempotencyKey: body?.idempotency_key ?? null,
      });
      return json(200, {
        execution_id: result.executionId,
        replay: result.replay,
        ...result.counts,
      });
    }

    if (path === "/jobs" && method === "GET") {
      return json(
        200,
        await pluginListJobs({
          q: url.searchParams.get("q") ?? undefined,
          limit: Number(url.searchParams.get("limit") ?? 50),
          offset: Number(url.searchParams.get("offset") ?? 0),
        }),
      );
    }

    if (path === "/jobs" && method === "POST") {
      const body = (await readJson(request)) as {
        jobs?: unknown[];
        idempotency_key?: string;
      } | null;
      const result = await upsertCareerJobs({
        jobs: (Array.isArray(body?.jobs) ? body.jobs : []) as never[],
        actorSource: "plugin",
        idempotencyKey: body?.idempotency_key ?? null,
      });
      return json(200, {
        execution_id: result.executionId,
        replay: result.replay,
        ...result.counts,
      });
    }

    const jobMatch = /^\/jobs\/([^/]+)$/.exec(path);
    if (jobMatch && method === "GET") {
      return json(200, await pluginGetJob(jobMatch[1]!));
    }

    if (path === "/applications/prepare" && method === "POST") {
      const body = (await readJson(request)) as {
        jobId?: string;
        job_id?: string;
        compatibilityAnalysis?: string;
        recommendedResume?: string;
        introMessage?: string;
        emailBody?: string;
        linkedinMessage?: string;
        whatsappMessage?: string;
        guidance?: string;
        idempotency_key?: string;
      } | null;
      const jobId = body?.jobId || body?.job_id || "";
      if (!jobId) return json(400, { error: "invalid_request", message: "Informe jobId." });
      const result = await prepareCareerApplication({
        jobId,
        compatibilityAnalysis: body?.compatibilityAnalysis,
        recommendedResume: body?.recommendedResume,
        introMessage: body?.introMessage,
        emailBody: body?.emailBody,
        linkedinMessage: body?.linkedinMessage,
        whatsappMessage: body?.whatsappMessage,
        guidance: body?.guidance,
        actorSource: "plugin",
        idempotencyKey: body?.idempotency_key ?? null,
      });
      return json(200, {
        execution_id: result.executionId,
        application_id: result.applicationId,
        replay: result.replay,
        ...result.counts,
      });
    }

    if (path === "/applications" && method === "GET") {
      return json(200, await pluginListApplications());
    }

    if (path === "/history" && method === "GET") {
      return json(200, await pluginListHistory());
    }

    const executionMatch = /^\/executions\/([^/]+)$/.exec(path);
    if (executionMatch && method === "GET") {
      return json(200, await pluginGetExecution(executionMatch[1]!));
    }

    return json(404, { error: "not_found", message: `Rota career não encontrada: ${method} ${path}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha interna.";
    audit("error", { path, method, message });
    if (/não encontrada|nao encontrada/i.test(message)) {
      return json(404, { error: "not_found", message });
    }
    if (/migração|migration/i.test(message)) {
      return json(503, { error: "migration_required", message });
    }
    return json(500, { error: "internal_error", message: "Falha ao processar a solicitação Career." });
  }
}
