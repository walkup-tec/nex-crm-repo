import { useEffect, useState } from "react";
import { getClientBalanceAlertFn } from "@/lib/meta-credit.functions";

export function useLowBalance(enabled: boolean) {
  const [low, setLow] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void getClientBalanceAlertFn().then((result) => {
      if (active && result.ok) setLow(result.data.low);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return low;
}
