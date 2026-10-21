import Image from "next/image";
import type { CSSProperties } from "react";
import { accentVars, type AccentColor } from "@/lib/color";

interface AssetAvatarProps {
  symbol: string;
  imageUrl: string | null;
  accent: AccentColor;
  size?: number;
}

/** Logo framed by the asset's brand colour; falls back to the ticker's first letter. */
export function AssetAvatar({ symbol, imageUrl, accent, size = 28 }: AssetAvatarProps) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full bg-surface-muted ring-2 ring-accent ring-offset-1 ring-offset-surface"
      style={{ width: size, height: size, ...accentVars(accent) } as CSSProperties}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" width={size} height={size} className="rounded-full" />
      ) : (
        <span aria-hidden="true" className="text-xs font-semibold text-accent">
          {symbol.charAt(0)}
        </span>
      )}
    </span>
  );
}
