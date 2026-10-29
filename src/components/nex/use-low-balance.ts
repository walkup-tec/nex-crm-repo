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
    void getClientBalanceAlertFn().then((result) => {
      if (!active || !result.ok) return;
      setAlert({
        low: result.data.low === true,
        missingTopup: result.data.missingTopup === true,
        balanceLow: result.data.balanceLow === true,
        paymentError: result.data.paymentError === true,
      });
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return alert;
}
