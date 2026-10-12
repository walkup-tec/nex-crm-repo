import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Contact, Conversation, Message, Product, Opportunity, Schedule, Connection, Agent } from './model';
export interface WorkspaceData { activeConversationId?: string; contacts: Contact[]; conversations: Conversation[]; messages: Message[]; products: Product[]; opportunities: Opportunity[]; schedules: Schedule[]; connections: Connection[]; agents: Agent[]; funnels: string[]; stages: string[]; fields: string[] }
const initial: WorkspaceData = { contacts: [], conversations: [], messages: [], products: [], opportunities: [], schedules: [], connections: [], agents: [], funnels: ['Funil principal'], stages: ['Novos leads', 'Qualificação', 'Proposta', 'Negociação', 'Ganho'], fields: [] };
const WorkspaceContext = createContext<{ data: WorkspaceData; update: (fn: (state: WorkspaceData) => WorkspaceData) => void } | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) { const [data, setData] = useState(initial); return <WorkspaceContext.Provider value={{ data, update: setData }}>{children}</WorkspaceContext.Provider> }
export function useWorkspace() { const context = useContext(WorkspaceContext); if (!context) throw new Error('Workspace indisponível'); return context; }
export const uid = () => crypto.randomUUID();
