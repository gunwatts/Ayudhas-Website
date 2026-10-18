# Live sky on the ceiling

Solar Vision's **ceiling view** shows the real sky straight above your home: the stars, constellation figures and
names (English or Hindi), the planets and the Moon, where they are right now, all night, with nothing else on screen.
A small projector points it at the ceiling; a Raspberry Pi opens it at every boot.

## What you need

| Part | Notes |
|---|---|
| LED projector, **native 1080p** | LED light lasts 20,000–30,000 hours. A throw ratio around 1.2–1.4 gives a ~2 m wide sky from a bedside table 2.5 m below the ceiling. |
| Raspberry Pi 5 (4 GB), official 27 W power supply, case with fan | Or any old laptop or mini PC with Chrome. |
| Micro-HDMI to HDMI cable, a microSD card (16 GB+) | Raspberry Pi OS (64-bit, with desktop), from Raspberry Pi Imager. |
| Optional: a smart plug with a schedule | Turns the projector on at dusk and off at dawn, so its light source is only used at night. |

## Make your link

On any phone or computer, open **ayudhas.com/solar-vision/**, choose your place, then **Rooftop sky → Ceiling**.
Set the names (English or हिंदी), brightness, red night light and the rest, then **Copy link**. Tick
**Lighter (Raspberry Pi)** for a Pi. Every option is in the link, so the Pi needs no clicks:

| In the link | Effect |
|---|---|
| `ceiling` | Ceiling view (required) |
| `lat`, `lon`, `name` | Your place. Without them the browser's location, then Hyderabad |
| `rotate=90` | Turn the picture so north points the right way in your room (degrees, clockwise) |
| `flip` | Mirror it, for projectors set to rear projection (if east and west look swapped) |
| `fov=100` | How much sky, top to bottom (60–140 degrees) |
| `names=hi` / `names=off` | Hindi names, or none |
| `lines=off` | Hide the constellation figures |
| `bright=0.7` | Overall brightness |
| `red` | Deep-red night light |
| `day=sky` | Show the daytime sky too (by default it fades to black after sunrise and back at dusk) |
| `info` | A small clock and Moon phase in a corner |
| `lite` | Lighter rendering for a Raspberry Pi |

## Set up the Pi (once)

1. Flash **Raspberry Pi OS (64-bit)** with Raspberry Pi Imager; set Wi-Fi, a user and auto-login.
2. On the Pi, open a terminal and run (with your own link, in quotes):

   ```bash
   curl -fsSLO https://raw.githubusercontent.com/gunwatts/Ayudhas-Website/main/deploy/ceiling-pi/setup.sh
   bash setup.sh "https://ayudhas.com/solar-vision/?ceiling&lat=17.385&lon=78.487&name=Hyderabad&lite"
   sudo reboot
   ```

The Pi now boots straight into the sky. The script installs fonts for Hindi names, stops the screen from blanking,
starts Chromium full screen (and restarts it if it ever closes), and refreshes it once a day at 17:30.

## Point it right

Lie in bed looking up. **North should be at the top of the picture as you see it** with your head towards north.
If not, change `rotate` (90, 180 or 270, then fine-tune). If the familiar shapes look mirrored (east and west
swapped), add `flip`. Move the mouse or press a key to show a "Leave ceiling view" button; Esc leaves too.

## Notes

- Positions are computed on the Pi from the clock and your coordinates; the internet is only needed to load the
  page. Keep the Pi's clock right (it syncs itself over Wi-Fi).
- Projectors cannot show pure black: a faint glow of the picture's edge is normal. A matte, darker ceiling helps.
- By day the page shows black and stops drawing, so the Pi idles. Switching the projector off by day (a smart plug
  schedule) saves its light source for the night.
