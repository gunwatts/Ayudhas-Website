# Ayudhas website

The brand website at **https://ayudhas.com**: what Ayudhas means, its tools (Ayudhas Pro on Android, Ayudhas Finance
on the web), and a contact form. The finance app itself lives in the separate repo `Ayudhas-Frontend` at
https://finance.ayudhas.com.

## Stack
- Next.js 16 static export (`out/`) on GitHub Pages, published by `.github/workflows/deploy.yml` on every push to `main`.
- One live 3D world behind the whole page (Three.js). Scroll drives a damped camera through one composed shot per
  scene; the opening shows the Ayudhas mark with every tool on its orbit, later scenes park it in their empty corner.
  The world draws its own drifting nebula sky and near-camera dust, and renders through a post-processing lens
  (`postprocessing`: HDR bloom, exposure, neutral tone mapping, a chromatic fringe). Scroll speed swells the stars,
  widens the lens and the fringe, so moving between scenes feels like travel. Three.js loads in its own chunk after
  the page is idle, so it never delays the first paint.
- Smooth scrolling is Lenis, driven from GSAP's ticker so the page, ScrollTrigger and the world move in the same frame
  (`scroll-director.tsx`). GSAP ScrollTrigger scrubs the hero's 3D letter exit, parallax depth on headings
  (`data-depth`), the Ayudhas Pro phone turning, the store graphic opening up, and the footer wordmark rising.
  In-page links glide through `scrollToHash` (`src/lib/smooth-scroll.ts`), which keeps focus and the address bar right.
- A cursor ring and magnetic buttons on mice and trackpads (`cursor.tsx`).
- **Solar Vision** (`/solar-vision/`, linked from the menu): the real Sun, Moon and Earth for the visitor's place
  and moment, in two live 3D views on one canvas (`src/components/solar/`):
  - *Rooftop sky*: Preetham daylight scattering (three.js `Sky`) lit by the true Sun, with added twilight, airglow
    and moonlit sky, drawn as a clear sky; 2,851 naked-eye stars and 89 constellation figures
    turned for the place and time; the Moon at its true topocentric position, size, phase, tilt and libration,
    shaded with NASA LRO colour and relief (Lommel–Seeliger regolith reflectance). Drag to look, scroll or pinch to
    zoom, "Point my phone" on phones uses the compass and gyroscope.
  - *From space*: the Earth at its true rotation and tilt with yesterday's NASA GIBS satellite image (real clouds),
    city lights on the night side, the Moon at its true direction (distance shortened, or true with a toggle), the
    Sun, and the visitor's place with lines to the Moon and the Sun.
  - Live numbers: Moon phase, % lit, age, direction and height, magnitude, moonlight (lux), distance, size,
    rise and set; Sun direction and height, estimated clear-sky sunlight (W/m² and lux),
    sunrise, sunset, solar noon, day length; the next four Moon phases.
  - Time: live by default; pause, play in real time, rewind ◀◀ or fast-forward ▶▶ at 10 min/s, 1 h/s or 1 day/s;
    a ±24 h timeline slider around wherever you are; and a date-and-time picker (1900–2100) in the chosen place's
    own time zone, which jumps there and holds.
  - Layout: the controls stack in normal flow (top bar, then the tool row; the data sheet sits on the measured time
    bar), so nothing can slide under anything at any screen or text size. On phones the top bar is one row and the
    time bar three short rows (one speed button, the date box behind a calendar button).
  - Full screen (⛶): hides every control and label and asks the browser for real full screen (Android hides its
    status and navigation bars; iPhones do not allow it for web pages, so there the sky fills the browser window).
    The page is edge to edge (`viewport-fit=cover`); a fading "✕ Controls" button brings everything back.
  - App mode (`#app&lat=..&lon=..&name=..&tz=..`, `src/components/solar/app-link.ts`): how the Ayudhas Pro app opens
    Solar Vision full screen. The city comes from the app in the link's fragment, which is never sent to the server;
    the page never asks for the device location, never looks up place names or searches, hides the ceiling builder,
    and hands its back and place buttons to the app (`window.ReactNativeWebView` messages `hello`, `close`, `place`).
  - Ceiling view (`?ceiling`, built from Rooftop sky → Ceiling): the sky straight overhead for projecting onto a
    ceiling, north up and east on the left as seen lying down, with constellation figures and names (English or
    Hindi), the planets and the Moon; no controls; set entirely by the link (place, rotation, mirror, field of view,
    brightness, red night light, dark by day, clock, lighter rendering). `src/components/solar/ceiling.ts` documents
    every option; `deploy/ceiling-pi/` has the Raspberry Pi setup script and guide.
  - All positions are computed in the browser with Astronomy Engine (no server, no API key);
    `src/__tests__/astro.test.ts` checks them against USNO almanac times. Every online service is free, keyless and
    allows commercial use: browser geolocation (asks permission), BigDataCloud client-side reverse geocoding (only
    for the visitor's own device location, as its terms require), OpenStreetMap Nominatim place search (on submit,
    credited on the page) and NASA GIBS imagery. Searched places get their time zone from an offline map
    (`@photostructure/tz-lookup`, CC0), so no call is made for it. Each fails soft. There is no live weather: the
    free weather APIs we found either forbid commercial use or cannot identify a browser app as required.
  - Assets in `public/solar/`: Earth day, night, clouds, normal and specular maps and the Sun by Solar System Scope
    (CC BY 4.0, credited on the page); Moon colour and elevation from NASA's CGI Moon Kit (LRO, public domain);
    star and constellation data from d3-celestial (BSD-3-Clause).
- Everything else is CSS and small React components: word-by-word headings, reveals, glass panels, the tools map's
  3D tilt, the sliding nav and tab pills.
- The contact form posts to `https://api.ayudhas.com/api/v1/contact` (the Ayudhas backend). Messages are read on the
  private **Messages** page of Ayudhas Finance (staff accounts only).

## Motion, performance and fallbacks
- Reduced motion: the world shows still, composed frames that change only between scenes; reveals and loops stop;
  Lenis, the scroll choreography and the cursor ring are off, so scrolling is the browser's own.
- Devices with Save-Data, under 2 GB of memory, no hardware WebGL 2 or a software renderer get the light 2D orbit
  (`orbit-world.tsx`), which is also the poster while the 3D world loads.
- The world pauses in hidden tabs, caps the pixel ratio (1.5 on phones, 2 elsewhere), runs ambient motion at 30 fps on
  phones (bloom at half resolution there), and lowers its resolution on slow GPUs; at the lowest resolution it drops
  the post-processing lens, and if that is still too slow it sets `html.world-lite`, which turns off the page's blur,
  grain and cursor ring. Scenes that are off screen pause their CSS animations.
- Solids are shaded with a generated matcap instead of lights and an environment map, so shaders compile quickly.

## Where things are
- `src/content/site.ts`: all wording about the brand, tools and statuses. Add a tool here first.
- `src/components/`: one file per scene (`meaning`, `universe`, `pro`, `stories`, `future`, `contact`), plus the nav,
  the chapter rail, `motion-director` (reveals, off-screen pausing, pointer spotlight and tilt) and `split-heading`.
- `src/components/solar/`: Solar Vision. `astro.ts` (positions, phases, brightness; pure and unit tested),
  `live.ts` (location, weather, place search, satellite image), `engine.ts` (both 3D scenes), `solar-vision.tsx`
  (the page UI), `phase-icon.tsx`.
- `src/components/world/`: the 3D world. `chapters.ts` is the scene ledger (camera shot and world state per scene;
  tune compositions there), `engine.ts` the renderer, scroll conductor and interactions, `post.ts` the
  post-processing lens, `objects.ts` (sky, stars, dust, mark, tools, floor) and `textures.ts` the procedural pieces. `src/lib/scroll-conductor.ts` holds the pure scroll maths (unit tested).
- `.claude/skills/`: the design and motion skills used to build this (see its README for sources and licence).
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
