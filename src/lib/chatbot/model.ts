export type ConversationStatus = 'queue' | 'active' | 'closed';
export interface Contact { id: string; name: string; phone: string; email: string; tags: string[]; companyId: string }
export interface Conversation { id: string; contactId: string; connectionId: string; status: ConversationStatus; assigneeId?: string | undefined; botPaused: boolean; createdAt: string; closeReason?: string }
export interface Message { id: string; conversationId: string; text: string; direction: 'in' | 'out'; status: 'pending' | 'failed' | 'sent'; createdAt: string }
export interface Product { id: string; name: string; category: string; price: number; active: boolean }
export interface Opportunity { id: string; contactId: string; productId: string; title: string; value: number; stage: string; funnel: string }
export interface Schedule { id: string; contactId: string; date: string; text: string; recurrence: string; status: 'draft' | 'cancelled' }
export interface Connection { id: string; name: string; phone: string; status: 'unconfigured' | 'disconnected' | 'connected' }
export interface Agent { id: string; name: string; email: string; team: string; online: boolean }
export interface IntegrationAdapter {
  sendMessage(input: { conversationId: string; text: string; attachment?: File }): Promise<Message>;
  connectWhatsApp(connectionId: string): Promise<{ qrCode: string; expiresAt: string }>;
  assumeConversation(conversationId: string): Promise<Conversation>;
  subscribe(companyId: string, onEvent: (event: unknown) => void): () => void;
}
export function assumeConversation(conversation: Conversation, agentId: string): Conversation {
  if (conversation.status !== 'queue') throw new Error('Este atendimento já foi assumido.');
  return { ...conversation, status: 'active', assigneeId: agentId, botPaused: true };
}
export function closeConversation(conversation: Conversation, reason: string): Conversation {
  if (!reason.trim()) throw new Error('Selecione um motivo de encerramento.');
  return { ...conversation, status: 'closed', closeReason: reason, botPaused: true };
}
export function transferConversation(conversation: Conversation, agent: Agent): Conversation {
  if (!agent.online) throw new Error('O atendente está offline.');
  return { ...conversation, assigneeId: agent.id, status: 'active', botPaused: true };
}
export function isExcelFile(name: string) { return /\.(xlsx|xls)$/i.test(name); }
export const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
