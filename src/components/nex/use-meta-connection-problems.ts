import { useEffect, useState } from "react";
import { listMetaConnectionProblemsFn } from "@/lib/users.functions";
import type { MetaConnectionProblem } from "@/lib/user-access";

export function useMetaConnectionProblems(enabled: boolean) {
  const [problems, setProblems] = useState<MetaConnectionProblem[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function load() {
      const result = await listMetaConnectionProblemsFn();
      if (!active || !result.ok) return;
      setProblems(result.data);
    }
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled]);
  return problems;
}
