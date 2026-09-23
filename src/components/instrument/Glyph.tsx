import { GLYPH } from "@/domain/types";
import styles from "./Glyph.module.css";

type GlyphName = keyof typeof GLYPH;

type GlyphProps = {
  name: GlyphName;
  size?: "sm" | "md" | "lg" | "xl";
  pulse?: boolean;
  dim?: boolean;
  className?: string;
};

export function Glyph({
  name,
  size = "md",
  pulse = false,
  dim = false,
  className = "",
}: GlyphProps) {
  return (
    <span
      className={[
        styles.glyph,
        styles[size],
        pulse ? styles.pulse : "",
        dim ? styles.dim : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      {GLYPH[name]}
    </span>
  );
}
