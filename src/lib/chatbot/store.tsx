import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Contact, Conversation, Message, Product, Opportunity, Schedule, Connection, Agent } from './model';
export interface WorkspaceData { activeConversationId?: string; contacts: Contact[]; conversations: Conversation[]; messages: Message[]; products: Product[]; opportunities: Opportunity[]; schedules: Schedule[]; connections: Connection[]; agents: Agent[]; funnels: string[]; stages: string[]; fields: string[] }
const initial: WorkspaceData = { contacts: [], conversations: [], messages: [], products: [], opportunities: [], schedules: [], connections: [], agents: [], funnels: ['Funil principal'], stages: ['Novos leads', 'Qualificação', 'Proposta', 'Negociação', 'Ganho'], fields: [] };
const WorkspaceContext = createContext<{ data: WorkspaceData; update: (fn: (state: WorkspaceData) => WorkspaceData) => void } | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initial);
  const attendant = useRef<Agent | null>(null);
  function update(fn: (state: WorkspaceData) => WorkspaceData) {
    setData((current) => {
      const next = fn(current);
      const owner = attendant.current;
      if (!owner || next.agents.some((agent) => agent.id === owner.id)) return next;
      return { ...next, agents: [owner, ...next.agents] };
    });
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user || !active) return;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const roleList = (roles ?? []).map((row) => row.role);
      const master = roleList.includes("master");
      if (!master && !roleList.includes("client_admin")) return;
      const name = profile?.full_name?.trim() || user.email || "Master";
      const email = profile?.email?.trim() || user.email || "";
      if (!active) return;
      const owner: Agent = { id: user.id, name, email, team: master ? "Master" : "Atendimento", online: true };
      attendant.current = owner;
      setData((current) => {
        if (current.agents.some((agent) => agent.id === user.id)) return current;
        return { ...current, agents: [owner, ...current.agents] };
      });
    })();
    return () => {
      active = false;
    };
  }, []);
  return <WorkspaceContext.Provider value={{ data, update }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() { const context = useContext(WorkspaceContext); if (!context) throw new Error('Workspace indisponível'); return context; }
export const uid = () => crypto.randomUUID();
