"use client";

/**
 * A bird illustration, rendered as a CSS background rather than an <img>.
 *
 * This is the part that actually stops Pinterest's browser extension. Its save
 * button needs a real <img> element to attach to — it does not offer to pin CSS
 * backgrounds. The `nopin` meta tag and per-image attributes are polite
 * requests that a misconfigured or third-party extension can ignore; having no
 * <img> in the document leaves nothing to hook.
 *
 * Accessibility is kept explicitly: role="img" plus an accessible name, which is
 * what an <img alt> would have provided.
 */
export function BirdArt({
  src,
  label,
  className,
  style,
}: {
  src: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      role="img"
      aria-label={label}
      style={{
        ...style,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center bottom",
        backgroundSize: "contain",
      }}
    />
  );
}
