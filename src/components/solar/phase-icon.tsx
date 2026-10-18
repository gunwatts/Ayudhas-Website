import { useId } from "react";

/**
 * The Moon's phase as a small disc: the lit limb is a half circle, the terminator an ellipse whose width follows
 * the lit fraction. Waxing Moons are lit on the right as seen from the northern hemisphere, on the left from the
 * southern (where the sky is seen "upside down").
 */
export function PhaseIcon({ phaseAngle, illuminated, southern, size = 48 }: {
  phaseAngle: number;
  illuminated: number;
  southern: boolean;
  size?: number;
}) {
  const gradient = `sv-moon-lit-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const r = 50;
  const waxing = ((phaseAngle % 360) + 360) % 360 < 180;
  const litRight = waxing !== southern;
  const k = Math.min(1, Math.max(0, illuminated));
  const rx = Math.abs(1 - 2 * k) * r;
  // Outer limb on the lit side, then back along the terminator.
  const limbSweep = litRight ? 1 : 0;
  const termSweep = k > 0.5 ? (litRight ? 1 : 0) : (litRight ? 0 : 1);
  const d = `M50 0 A${r} ${r} 0 0 ${limbSweep} 50 100 A${rx.toFixed(2)} ${r} 0 0 ${termSweep} 50 0 Z`;
  return (
    <svg className="sv-phase" width={size} height={size} viewBox="-2 -2 104 104" role="img" aria-label={`${Math.round(k * 100)}% of the Moon lit`}>
      <defs>
        <radialGradient id={gradient} cx="40%" cy="38%" r="70%">
          <stop offset="0" stopColor="#fbf6e9" />
          <stop offset="1" stopColor="#c9c3b3" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="#1b1f33" stroke="rgb(255 255 255 / 0.18)" strokeWidth="1.5" />
      {k > 0.005 && <path d={d} fill={`url(#${gradient})`} />}
    </svg>
  );
}
