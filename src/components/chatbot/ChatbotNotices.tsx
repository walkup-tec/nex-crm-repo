import { useEffect, useRef } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { chatbotNoticeTickFn } from "@/lib/chatbot.functions";
import { noticeCue, noticePlayer } from "@/lib/chatbot-evo";
import { armNexNotice, playNexNotice } from "@/lib/nex-notice";

type NoticeIntent = { type: "intent"; signature: string; tabId: string; visible: boolean };

function hearsChatbot(role: string | undefined, chatbot: boolean | undefined) {
  return role === "client_admin" || (role === "client_user" && chatbot === true);
}

export function ChatbotNotices() {
  const session = useRouteContext({ strict: false }) as { role?: string; permissions?: { chatbot?: boolean } | null } | undefined;
  const hear = hearsChatbot(session?.role, session?.permissions?.chatbot);
  const seen = useRef<{ messages: string[]; queues: string[] } | null>(null);
  const tabId = useRef(`tab-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!hear) return;
    const arm = () => armNexNotice();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("nex-notice");
    let active = true;

    function playOnce(signature: string) {
      if (!channel) {
        playNexNotice();
        return;
      }
      const mine: NoticeIntent = {
        type: "intent",
        signature,
        tabId: tabId.current,
        visible: document.visibilityState === "visible",
      };
      const intents = [{ tabId: mine.tabId, visible: mine.visible }];
      const onMessage = (event: MessageEvent<NoticeIntent>) => {
        const data = event.data;
        if (data?.type !== "intent" || data.signature !== signature) return;
        intents.push({ tabId: data.tabId, visible: data.visible });
      };
      channel.addEventListener("message", onMessage);
      channel.postMessage(mine);
      window.setTimeout(() => {
        channel.removeEventListener("message", onMessage);
        if (noticePlayer(tabId.current, intents)) playNexNotice();
      }, 180);
    }

    async function tick() {
      const result = await chatbotNoticeTickFn();
      if (!active || !result.ok) return;
      const previous = seen.current;
      const cue = noticeCue(previous, { messages: result.data.messageIds, queues: result.data.queueIds });
      seen.current = { messages: cue.messages, queues: cue.queues };
      if (!cue.play || !result.data.sound || !previous) return;
      const fresh = [
        ...cue.messages.filter((id) => !previous.messages.includes(id)),
        ...cue.queues.filter((id) => !previous.queues.includes(id)),
      ];
      if (fresh.length) playOnce(fresh.slice().sort().join("|"));
    }

    void tick();
    const timer = window.setInterval(() => void tick(), 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      channel?.close();
    };
  }, [hear]);

  return null;
}
