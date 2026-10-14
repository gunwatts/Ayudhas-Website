# Project skills

Claude Code loads each `<name>/SKILL.md` in this folder as a project skill.

## Source

Copied from Meng To's agent skills, https://github.com/MengTo/skills, commit
`83a47fee32f0b6349bff1fede99257a5ef03dc93` (MIT, see `LICENSE-MengTo-Skills.txt`). Each copy keeps its `SKILL.md` and
any `references/`, `scripts/` or `REFERENCES.md`. The `demo/` folders are left out: they are large, and the
scroll-world demo bundles the Kage page and artwork, which carry no reuse licence. Where a skill links to
`demo/index.html`, read it upstream. The Codex-only `agents/openai.yaml` files are left out too.

| Skill | Used for on ayudhas.com |
|---|---|
| `build-threejs-scroll-worlds` | The persistent WebGL world behind every scene, its scroll conductor and camera path |
| `add-mouse-driven-orbit` | The damped pointer parallax on the world camera and tool objects |
| `animation-systems` | Motion tokens: durations, easing, stagger, reduced-motion policy |
| `staggered-word-reveal` | Word-by-word scene headings |
| `webgl-landing-steering` | Keeping the 3D layer subordinate to the message and CTAs |
| `3d-retina-resolution` | DPR caps and the adaptive pixel-ratio governor |
| `optimize-web-animations` | Pausing off-screen CSS animations and the render loop |
| `css-border-gradient`, `glass-dark-ui` | The refined panel edges and selective glass |
| `build-awwwards-quality-sites` | Art-direction checklist |
| `audit-reference-originality` | Checking the site against the Kage reference |

## Deliberate deviations

- `build-awwwards-quality-sites` asks for GSAP plus a smooth-scroll engine. This site keeps native scrolling and CSS
  transitions instead, as `build-threejs-scroll-worlds` and the Kage reference do: the camera is damped, the page is
  not, so anchors, the keyboard and assistive technology behave normally and no animation library ships.
- The same skill discourages hand-drawn SVG and CSS illustration. The existing constellation, phone screens and logo
  are kept: they are data graphics and brand marks built from the site's own content.
