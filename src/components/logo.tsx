import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The AGS crest.
 *
 * Rebuilt as vector geometry from the school logo: a navy ring, the serif AGS
 * wordmark under its gold swoosh, the diamond burst above it, and the three
 * navy diamonds to its right.
 *
 * The wordmark uses the self-hosted display serif (`--font-display`) so it is
 * pixel-identical on every device rather than falling back to whatever serif
 * the visitor happens to have.
 */

/** Small rotated squares fanned along an arc, as on the crest. */
const BURST = Array.from({ length: 9 }, (_, index) => {
  const angle = (-74 + index * 18.5) * (Math.PI / 180);
  const radius = 104;
  const size = index === 4 ? 25 : index % 2 === 0 ? 21 : 17;
  return {
    x: 226 + Math.sin(angle) * radius,
    y: 236 - Math.cos(angle) * radius,
    size,
    fill: [1, 5].includes(index)
      ? BRAND.colors.gold
      : [3, 7].includes(index)
        ? BRAND.colors.sky
        : BRAND.colors.navy,
    rotate: (angle * 180) / Math.PI,
  };
});

export function LogoMark({
  className,
  ring = true,
}: {
  className?: string;
  /** The board and small chips read better without the outer ring. */
  ring?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      aria-label={`${BRAND.shortName} crest`}
      className={cn("shrink-0", className)}
    >
      {ring ? (
        <>
          <circle cx="256" cy="256" r="248" fill="#ffffff" />
          <circle
            cx="256"
            cy="256"
            r="233"
            fill="none"
            stroke={BRAND.colors.navy}
            strokeWidth="30"
          />
        </>
      ) : null}

      {BURST.map((shape, index) => (
        <rect
          key={index}
          x={shape.x - shape.size / 2}
          y={shape.y - shape.size / 2}
          width={shape.size}
          height={shape.size}
          rx="2"
          fill={shape.fill}
          transform={`rotate(${shape.rotate + 45} ${shape.x} ${shape.y})`}
        />
      ))}

      {/* Gold swoosh, sweeping up from under the A and out past the S. */}
      <path
        d="M72 344 C 142 400, 282 392, 366 288"
        fill="none"
        stroke={BRAND.colors.gold}
        strokeWidth="26"
        strokeLinecap="round"
      />

      <text
        x="88"
        y="350"
        fill={BRAND.colors.navy}
        fontFamily="var(--font-display), Georgia, 'Times New Roman', serif"
        fontSize="140"
        fontWeight="700"
      >
        AGS
      </text>

      {/* Three diamonds trailing the wordmark. */}
      {[0, 1, 2].map((index) => {
        const x = 380 + (index === 1 ? 22 : 0);
        const y = 252 + index * 46;
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width="27"
            height="27"
            rx="2"
            fill={BRAND.colors.navy}
            transform={`rotate(45 ${x + 13.5} ${y + 13.5})`}
          />
        );
      })}
    </svg>
  );
}

/** Crest plus the school name — the standard lock-up used in app headers. */
export function Logo({
  schoolName,
  className,
  tone = "light",
  compact = false,
}: {
  schoolName?: string | null;
  className?: string;
  /** `dark` inverts the text for the dismissal board. */
  tone?: "light" | "dark";
  /** Uses the short name — the full one does not fit a 256px sidebar. */
  compact?: boolean;
}) {
  const label = compact ? BRAND.shortName : schoolName || BRAND.name;

  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)} title={schoolName ?? undefined}>
      <LogoMark className="size-11 shrink-0" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-bold leading-tight tracking-[-0.02em]",
            compact ? "text-[17px]" : "text-[15px]",
            tone === "dark" ? "text-white" : "text-[var(--color-ink)]",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "block truncate text-[11px] font-semibold uppercase tracking-[0.14em]",
            tone === "dark" ? "text-white/60" : "text-[var(--color-muted)]",
          )}
        >
          Dismissals
        </span>
      </span>
    </span>
  );
}

/** The Arabic name, for the sign-in and landing lock-ups. */
export function LogoArabic({ className }: { className?: string }) {
  return (
    <span dir="rtl" lang="ar" className={cn("block", className)}>
      {BRAND.nameArabic}
    </span>
  );
}
