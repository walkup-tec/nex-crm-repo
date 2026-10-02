import logoAsset from "@/assets/nex-logo-header-final.png";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center">
      <img
        src={logoAsset}
        alt="NEX Marketing Digital"
        className={compact ? "h-9 w-12 object-cover object-left" : "h-12 w-auto max-w-44 object-contain"}
      />
    </div>
  );
}
