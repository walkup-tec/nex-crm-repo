import { useEffect, useState } from "react";
import { getClientBalanceAlertFn } from "@/lib/meta-credit.functions";

export type MetaCreditAlertView = {
  low: boolean;
  missingTopup: boolean;
  balanceLow: boolean;
  paymentError: boolean;
};

const emptyAlert: MetaCreditAlertView = {
  low: false,
  missingTopup: false,
  balanceLow: false,
  paymentError: false,
};

export function useLowBalance(enabled: boolean): MetaCreditAlertView {
  const [alert, setAlert] = useState<MetaCreditAlertView>(emptyAlert);
  useEffect(() => {
    if (!enabled) {
      setAlert(emptyAlert);
      return;
    }
    let active = true;
    const load = () => {
      void getClientBalanceAlertFn().then((result) => {
        if (!active) return;
        if (!result.ok) {
          console.error("meta_balance_alert", result.message);
          return;
        }
        setAlert({
          low: result.data.low === true,
          missingTopup: result.data.missingTopup === true,
          balanceLow: result.data.balanceLow === true,
          paymentError: result.data.paymentError === true,
        });
      });
    };
    load();
    const timer = window.setInterval(load, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled]);
  return alert;
}
