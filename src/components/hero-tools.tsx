"use client";

import { DESTINATIONS, STATUS_LABEL } from "@/content/site";
import { emit } from "@/lib/world-events";

/**
 * Labels that float under each tool in the 3D world (the world positions them every frame). They are real links,
 * so the same objects can be reached by keyboard and touch: each opens that tool on the tools map.
 * Hidden unless the 3D world is running.
 */
export function HeroTools() {
  return (
    <div className="tool-tags">
      {DESTINATIONS.map((d) => (
        <a
          key={d.id}
          href="#universe"
          className={`tool-tag ${d.status}`}
          data-tool-tag={d.id}
          style={{ ["--hue" as string]: `var(${d.hue})` }}
          onClick={() => emit("ayudhas:select-destination", { id: d.id })}
        >
          <span className="tool-tag-dot" aria-hidden />
          <span className="tool-tag-name">{d.name}</span>
          <span className="sr-only">, {STATUS_LABEL[d.status]}. Show it on the tools map.</span>
        </a>
      ))}
    </div>
  );
}
