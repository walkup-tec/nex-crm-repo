import logoAsset from "@/assets/nex-logo-header-final.png.asset.json";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center">
      <img
        src={logoAsset.url}
        alt="NEX Marketing Digital"
        className={compact ? "h-9 w-12 object-cover object-left" : "h-12 w-auto max-w-44 object-contain"}
      />
    </div>
  );
}
