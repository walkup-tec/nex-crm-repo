import { AppShell } from "@/components/nex/AppShell";

export function ChatbotFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell live notes={false} title={title} subtitle={subtitle}>
      <div className="chatbot-app">{children}</div>
    </AppShell>
  );
}
