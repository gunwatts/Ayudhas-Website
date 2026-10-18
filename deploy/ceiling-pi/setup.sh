#!/usr/bin/env bash
# Turns a Raspberry Pi (Raspberry Pi OS Bookworm, desktop) into a live-sky ceiling projector driver.
# It starts Chromium full screen on Solar Vision's ceiling view at every boot, keeps the screen from blanking,
# installs Devanagari fonts for Hindi names, and restarts the browser once a day so it runs for months unattended.
#
# Usage (on the Pi, as the desktop user, not root):
#   bash setup.sh "https://ayudhas.com/solar-vision/?ceiling&lat=17.385&lon=78.487&name=Hyderabad&lite"
# Get your own link from Solar Vision: Rooftop sky → Ceiling → Copy link.
set -euo pipefail

URL="${1:-}"
if [[ -z "$URL" || "$URL" != *"ceiling"* ]]; then
  echo "Give the ceiling link as the first argument (Solar Vision → Ceiling → Copy link)." >&2
  exit 1
fi
if [[ $EUID -eq 0 ]]; then
  echo "Run this as the desktop user (it asks for sudo where needed), not as root." >&2
  exit 1
fi

echo "→ Installing fonts for Hindi names and the browser (if missing)…"
sudo apt-get update -qq
sudo apt-get install -y -qq fonts-noto-core >/dev/null
command -v chromium >/dev/null || command -v chromium-browser >/dev/null || sudo apt-get install -y -qq chromium >/dev/null
BROWSER="$(command -v chromium || command -v chromium-browser)"

echo "→ Keeping the screen on (no blanking)…"
sudo raspi-config nonint do_blanking 1 || true

echo "→ Writing the launcher…"
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/ayudhas-sky.sh" <<LAUNCH
#!/usr/bin/env bash
# Keeps the ceiling sky on screen: if the browser ever closes (or is restarted at night), it opens again.
URL='$URL'
while true; do
  "$BROWSER" --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble \\
    --ignore-gpu-blocklist --enable-gpu-rasterization --check-for-update-interval=31536000 \\
    --autoplay-policy=no-user-gesture-required --password-store=basic "\$URL"
  sleep 3
done
LAUNCH
chmod +x "$HOME/.local/bin/ayudhas-sky.sh"

echo "→ Starting it with the desktop at every boot…"
# Raspberry Pi OS Bookworm uses labwc (Wayland) on current images and wayfire on early ones; set up both.
mkdir -p "$HOME/.config/labwc"
touch "$HOME/.config/labwc/autostart"
grep -q "ayudhas-sky.sh" "$HOME/.config/labwc/autostart" || echo "$HOME/.local/bin/ayudhas-sky.sh &" >> "$HOME/.config/labwc/autostart"
if [[ -f "$HOME/.config/wayfire.ini" ]] && ! grep -q "ayudhas-sky" "$HOME/.config/wayfire.ini"; then
  printf '\n[autostart]\nayudhas_sky = %s\n' "$HOME/.local/bin/ayudhas-sky.sh" >> "$HOME/.config/wayfire.ini"
fi

echo "→ Refreshing the browser once a day (17:30), so it never runs for weeks without a restart…"
( crontab -l 2>/dev/null | grep -v "ayudhas-sky-refresh" ; echo "30 17 * * * pkill -f -- '--kiosk' # ayudhas-sky-refresh" ) | crontab -

echo
echo "Done. Reboot to start the sky:  sudo reboot"
echo "To change the view later, run this script again with a new link."
