import { useEffect, useRef } from "react";
import { AppShell } from "@/components/nex/AppShell";
import { chatbotNoticeTickFn } from "@/lib/chatbot.functions";
import { noticeCue } from "@/lib/chatbot-evo";
import { armNexNotice, playNexNotice } from "@/lib/nex-notice";

function ChatbotNotices() {
  const seen = useRef<{ messages: string[]; queues: string[] } | null>(null);
  useEffect(() => {
    const arm = () => armNexNotice();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    let active = true;
    async function tick() {
      const result = await chatbotNoticeTickFn();
      if (!active || !result.ok) return;
      const cue = noticeCue(seen.current, { messages: result.data.messageIds, queues: result.data.queueIds });
      seen.current = { messages: cue.messages, queues: cue.queues };
      if (cue.play && result.data.sound) playNexNotice();
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);
  return null;
}

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
      <ChatbotNotices />
      <div className="chatbot-app">{children}</div>
    </AppShell>
  );
}
