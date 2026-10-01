export type MaskKind = "doc" | "phone" | "money" | "percent" | "date" | "day";

const digits = (v: string) => v.replace(/\D/g, "");

export function applyMask(kind: MaskKind, value: string): string {
  const d = digits(value);
  switch (kind) {
    case "doc":
      if (d.length <= 11)
        return d.slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      return d.slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    case "phone": {
      const p = d.slice(0, 11);
      if (p.length <= 2) return p ? `(${p}` : "";
      if (p.length <= 7) return `(${p.slice(0, 2)}) ${p.slice(2)}`;
      return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
    }
    case "money": {
      if (!d) return "";
      const n = Number(d.slice(0, 13)) / 100;
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    case "percent": {
      if (!d) return "";
      return `${(Number(d.slice(0, 5)) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;
    }
    case "date":
      return d.slice(0, 8).replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2");
    case "day": {
      const n = Math.min(Number(d.slice(0, 2)) || 0, 28);
      return d ? String(n || "") : "";
    }
  }
}
