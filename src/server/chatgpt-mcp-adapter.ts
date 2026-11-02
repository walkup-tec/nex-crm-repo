/**
 * Adaptador fino para MCP / tool-calling futuro.
 * Não duplica a consulta — delega a getMetaAnalysisExecutionTool.
 */
import {
  getMetaAnalysisExecutionToolDefinition,
  type ChatgptMetaAnalysisPayload,
} from "@/lib/chatgpt-integration";

export const chatgptMcpTools = [getMetaAnalysisExecutionToolDefinition] as const;

export async function invokeChatgptMcpTool(
  name: string,
  args: { execution_id?: string },
): Promise<
  | { ok: true; data: ChatgptMetaAnalysisPayload }
  | { ok: false; status: number; error: string; message: string }
> {
  if (name !== getMetaAnalysisExecutionToolDefinition.name) {
    return {
      ok: false,
      status: 400,
      error: "unknown_tool",
      message: `Ferramenta desconhecida: ${name}`,
    };
  }
  const executionId = args.execution_id?.trim() ?? "";
  const { getMetaAnalysisExecutionTool } = await import("@/server/chatgpt-integration.server");
  const result = await getMetaAnalysisExecutionTool({ execution_id: executionId });
  if (!result.ok) return result;
  return { ok: true, data: result.payload };
}
