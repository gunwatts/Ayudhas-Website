"use client";

import { useEffect, useRef, useState } from "react";

import { STORIES } from "@/content/site";
import { useInView, useReducedMotion } from "@/lib/motion";

import { SplitHeading } from "./split-heading";

/** Scene 5: short, illustrative journeys (not testimonials). Steps advance on their own while on screen. */
export function Stories() {
  const [storyId, setStoryId] = useState(STORIES[0].id);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduce = useReducedMotion();
  const story = STORIES.find((s) => s.id === storyId)!;

  useEffect(() => {
    if (!inView || reduce || paused) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % story.steps.length), 2800);
    return () => window.clearInterval(id);
  }, [inView, reduce, paused, story.steps.length]);

  const choose = (id: string) => { setStoryId(id); setStep(0); };

  return (
    <section id="stories" className="scene stories" aria-labelledby="stories-title" data-chapter>
      <div className="wrap">
        <div className="scene-head reveal">
          <span className="label">The philosophy, in practice</span>
          <SplitHeading id="stories-title" parts={["What a good tool feels like."]} />
          <p className="lede">Four everyday situations and the tool that helps. These are illustrations, not customer stories.</p>
        </div>
        <div className="stories-grid" ref={ref}>
          <div className="story-picker" role="group" aria-label="Choose a story">
            {STORIES.map((s) => (
              <button key={s.id} type="button" className="glass story-btn" aria-pressed={s.id === storyId} onClick={() => choose(s.id)}>
                <b>{s.title}</b><small>{s.tool}</small>
              </button>
            ))}
          </div>
          <div className="glass story-stage" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div className="story-top">
              <h3>{story.title}</h3>
              <button type="button" className="btn btn-ghost story-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
                {paused ? "▶ Play" : "❚❚ Pause"}
              </button>
            </div>
            <ol className="story-steps">
              {story.steps.map((s, i) => (
                <li key={s.title} className={i === step ? "now" : i < step ? "past" : ""}>
                  <button type="button" onClick={() => { setStep(i); setPaused(true); }} aria-current={i === step ? "step" : undefined}>
                    <span className="story-time">{s.title}</span>
                    <span className="story-text">{s.text}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="story-progress" aria-hidden><i style={{ width: `${((step + 1) / story.steps.length) * 100}%` }} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
