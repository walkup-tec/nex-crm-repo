import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listChatbotChannelsFn } from "@/lib/chatbot.functions";
import { channelsAllConnected, droppedChannels, whatsappMask } from "@/lib/chatbot-evo";

type Channel = { id: string; name: string; phone: string; status: string };

const iconClass = "[&_svg]:!size-[19.36px]";

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.41a10.1 10.1 0 0 0 4.65 1.12h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2zm5.76 14.15c-.24.68-1.2 1.25-1.96 1.41-.52.11-1.2.2-3.48-.75-2.92-1.21-4.8-4.17-4.95-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.26-.29.58-.36.77-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.28-.12.55.16.26.72 1.19 1.55 1.93 1.07.95 1.97 1.25 2.25 1.39.28.14.44.12.6-.07.17-.19.7-.81.89-1.09.19-.29.38-.24.64-.14.26.1 1.66.78 1.94.92.29.14.48.22.55.34.07.12.07.68-.17 1.36z"
      />
    </svg>
  );
}

export function WhatsAppChannelStatus({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const loading = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function load() {
      if (loading.current) {
        again.current = true;
        return;
      }
      loading.current = true;
      try {
        const result = await listChatbotChannelsFn();
        if (active && result.ok) {
          setChannels(result.data);
          setVisible(true);
        }
      } finally {
        loading.current = false;
        if (again.current && active) {
          again.current = false;
          void load();
        }
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 2000);
    const onChange = () => void load();
    window.addEventListener("nex-channel-status", onChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("nex-channel-status", onChange);
    };
  }, [enabled]);

  if (!enabled || !visible) return null;

  const dropped = droppedChannels(channels);
  const ready = channelsAllConnected(channels);
  const label = dropped.length ? "WhatsApp desconectado" : ready ? "Todos os números estão conectados" : "WhatsApp";

  function reconnect() {
    setOpen(false);
    void navigate({ to: "/chatbot/whatsapps" });
  }

  if (!dropped.length) {
    return (
      <Button variant="ghost" size="icon" aria-label={label} title={label} className={`${iconClass} ${ready ? "text-success hover:text-success" : "text-muted-foreground hover:text-muted-foreground"}`} onClick={reconnect}>
        <WhatsAppMark />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} title={label} className={`relative ${iconClass} text-destructive hover:text-destructive`}>
          <span className="absolute inset-1 rounded-full animate-balance-wave" />
          <WhatsAppMark />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-semibold">{dropped.length === 1 ? "Número desconectado" : "Números desconectados"}</p>
        <div className="mt-3 grid gap-3">
          {dropped.map((channel) => {
            const number = whatsappMask(channel.phone) || channel.phone || channel.name;
            return (
              <p key={channel.id} className="text-sm">
                <span className="font-medium">{number}</span>
                {channel.name && channel.name !== number ? <span className="mt-0.5 block text-xs text-muted-foreground">{channel.name}</span> : null}
              </p>
            );
          })}
        </div>
        <Button type="button" className="mt-4 w-full" onClick={reconnect}>
          Re-conectar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
