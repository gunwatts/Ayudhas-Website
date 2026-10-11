# Ayudhas website

The brand website at **https://ayudhas.com**: what Ayudhas means, its tools (Ayudhas Pro on Android, Ayudhas Finance
on the web), and a contact form. The finance app itself lives in the separate repo `Ayudhas-Frontend` at
https://finance.ayudhas.com.

## Stack
- Next.js 16 static export (`out/`) on GitHub Pages, published by `.github/workflows/deploy.yml` on every push to `main`.
- No UI or animation libraries: CSS (glass panels, scroll-linked reveals with `animation-timeline`), a Canvas 2D orbit
  scene, and small React components. Everything respects `prefers-reduced-motion`; the canvas pauses off-screen.
- The contact form posts to `https://api.ayudhas.com/api/v1/contact` (the Ayudhas backend). Messages are read on the
  private **Messages** page of Ayudhas Finance (staff accounts only).

## Where things are
- `src/content/site.ts`: all wording about the brand, tools and statuses. Add a tool here first.
- `src/components/`: one file per scene (`orbit-world`, `meaning`, `universe`, `pro`, `stories`, `future`, `contact`).
- `src/app/[...legacy]/`: old finance addresses on ayudhas.com forward to finance.ayudhas.com (query and #hash kept).
- `public/`: `CNAME` (ayudhas.com), `og.png` share image, icons, Ayudhas Pro images from its store listing.

## Commands
| Task | Command |
|---|---|
| Install | `npm ci` |
| Develop | `npm run dev` (http://localhost:3001) |
| Check | `npm run typecheck && npm run lint && npm test` |
| Production build | `npm run build` (writes `out/`) |
| Browser tests | build, serve `out/` on :3001 (`python -m http.server 3001 -d out`), then `npm run test:e2e` |
| Deploy | push to `main` (or Actions → Deploy to GitHub Pages → Run workflow) |
