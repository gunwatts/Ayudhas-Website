import type { ReactNode } from "react";

/** A plain run of words, or one unit kept whole (such as a gradient product name) with optional trailing punctuation. */
export type HeadingPart = string | { text: string; className?: string; after?: string };

/**
 * A display heading that rises in word by word, each word in its own mask, when it scrolls into view (see
 * MotionDirector). Screen readers get the whole phrase from aria-label; the split words are presentational.
 * Without JavaScript, or with reduced motion, it is an ordinary heading.
 */
export function SplitHeading({ as: Tag = "h2", id, className, parts }: {
  as?: "h1" | "h2" | "h3";
  id?: string;
  className?: string;
  parts: HeadingPart[];
}) {
  const full = parts.map((p) => (typeof p === "string" ? p : p.text + (p.after ?? ""))).join("");
  const words: ReactNode[] = [];
  let index = 0;
  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi];
    if (typeof part !== "string") {
      words.push(
        <span key={`p${pi}`} className="w">
          <span style={{ ["--i" as string]: index++ }}><span className={part.className}>{part.text}</span>{part.after}</span>
        </span>,
      );
      continue;
    }
    const tokens = part.split(/(\s+)/);
    for (let ti = 0; ti < tokens.length; ti++) {
      const token = tokens[ti];
      if (!token) continue;
      if (/^\s+$/.test(token)) words.push(" ");
      else words.push(<span key={`p${pi}-${ti}`} className="w"><span style={{ ["--i" as string]: index++ }}>{token}</span></span>);
    }
  }
  return (
    <Tag id={id} className={`split ${className ?? ""}`.trim()} aria-label={full}>
      <span aria-hidden="true">{words}</span>
    </Tag>
  );
}
