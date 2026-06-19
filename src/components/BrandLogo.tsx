import logoAsset from "@/assets/logo-pykidda.png.asset.json";

type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function BrandLogo({ size = 36, withWordmark = true, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoAsset.url}
        alt="PY Kidda logo"
        width={size}
        height={size}
        className="rounded-md object-contain"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className="font-black tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--gradient-sunrise)", fontSize: size * 0.55 }}
          >
            PY Kidda
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">Be a PY Kidda with us</span>
        </span>
      )}
    </span>
  );
}
