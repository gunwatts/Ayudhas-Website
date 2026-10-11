import { useId } from "react";

/** The Ayudhas mark: an "A" shaped like a raised implement, with an orbit and a moving point (a tool in use). */
export function Logo({ size = 32 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--cyan)" />
          <stop offset=".5" stopColor="var(--blue)" />
          <stop offset="1" stopColor="var(--violet)" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="34" rx="25" ry="9" fill="none" stroke={`url(#${id})`} strokeWidth="2.5" transform="rotate(-18 32 34)" opacity=".65" />
      <path d="M32 10 48 52h-7.5l-3.2-8.6H26.7L23.5 52H16zm0 13-3.3 11.5h6.6z" fill={`url(#${id})`} />
      <circle cx="52" cy="24" r="3.6" fill="var(--cyan)" />
    </svg>
  );
}
