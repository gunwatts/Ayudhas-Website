import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => { throw e; });
});

test("the gateway says what Ayudhas is, and every scene is reachable", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Ayudhas" })).toBeVisible();
  await expect(page.getByText("Tools for a Life in Motion.")).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Sections (mobile)" }).getByRole("link", { name: "Contact" }).click();
  } else {
    await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Contact" }).click();
  }
  await expect(page.getByRole("heading", { name: /Say hello/ })).toBeInViewport();
  for (const id of ["meaning", "universe", "pro", "stories", "future", "contact"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the meaning scene separates the Sanskrit meaning from the brand's reading", async ({ page }) => {
  await page.goto("/#meaning");
  await expect(page.getByText("आयुध").first()).toBeVisible();
  await expect(page.getByText("What it means in Sanskrit")).toBeVisible();
  await expect(page.getByText("How Ayudhas reads it")).toBeVisible();
});

test("choosing a destination shows its honest status", async ({ page }) => {
  await page.goto("/#universe");
  const map = page.getByRole("group", { name: "Destinations" });
  await map.getByRole("button", { name: /Panchang/ }).click();
  const card = page.locator("article.destination");
  await expect(card.getByRole("heading", { name: "Panchang" })).toBeVisible();
  await expect(card.getByText("Android · closed testing")).toBeVisible();
  await map.getByRole("button", { name: /Finance/ }).click();
  await expect(card.getByText("Live on the web")).toBeVisible();
  await expect(card.getByRole("link", { name: /Open Ayudhas Finance/ })).toHaveAttribute("href", "https://finance.ayudhas.com");
});

test("Ayudhas Pro tabs switch screens and the test invite prefills the form", async ({ page }) => {
  await page.goto("/#pro");
  await page.getByRole("tab", { name: "Panchang" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Daily tithi and nakshatra");
  await expect(page.getByText("Coming to Google Play")).toBeVisible();
  await page.getByRole("link", { name: /Ask to join the test/ }).click();
  await expect(page.getByLabel("Message")).toHaveValue(/join the Ayudhas Pro test/);
});

test("contact form validates, then sends to the API", async ({ page }) => {
  let sent: unknown = null;
  await page.route("**/api/v1/contact", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 202, contentType: "application/json", body: '{"status":"received"}' });
  });
  await page.goto("/#contact");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Email").fill("asha@example.com");
  await page.getByLabel("What is it about?").selectOption("suggestion");
  await page.getByLabel("Message").fill("Please add a habit tracker one day.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Message received.");
  expect(sent).toMatchObject({ name: "Asha", email: "asha@example.com", topic: "suggestion", website: "" });
});

test("contact form explains a server failure", async ({ page }) => {
  await page.route("**/api/v1/contact", (route) => route.fulfill({ status: 429, body: "{}" }));
  await page.goto("/#contact");
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Email").fill("asha@example.com");
  await page.getByLabel("What is it about?").selectOption("bug");
  await page.getByLabel("Message").fill("The widget froze once today.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".form-error")).toContainText("Too many messages");
});

test("old finance links forward to finance.ayudhas.com, keeping the query", async ({ page }) => {
  await page.route("https://finance.ayudhas.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>finance</h1>" }));
  await page.goto("/loans/view/?id=7");
  await page.waitForURL("https://finance.ayudhas.com/loans/view/?id=7");
});

test("with reduced motion, everything is still readable", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Ayudhas" })).toBeVisible();
  await page.locator("#stories").scrollIntoViewIfNeeded();
  await expect(page.locator(".story-steps li")).toHaveCount(4);
  await expect(page.locator(".story-steps li").first()).toHaveClass(/now/);
  await ctx.close();
});

test("the 3D world either starts or hands over to the 2D orbit, without errors", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-world", /^(ready|fallback)$/, { timeout: 20_000 });
  if ((await page.locator("html").getAttribute("data-world")) === "ready") {
    await expect(page.locator(".world canvas")).toHaveAttribute("data-quality", /\d/);
    await expect(page.locator(".orbit-world")).toBeHidden();
  } else {
    await expect(page.locator(".orbit-world canvas")).toBeVisible();
    await expect(page.locator(".tool-tags")).toBeHidden();
  }
});

test("headings revealed word by word keep their full accessible names", async ({ page }) => {
  await page.goto("/");
  for (const name of [
    "An instrument in the hand of the one who uses it.",
    "Every tool is a place you can visit.",
    "Ayudhas Pro: tasks, time and Panchang in your pocket.",
    "What a good tool feels like.",
    "A map with room to grow.",
  ]) await expect(page.getByRole("heading", { level: 2, name, exact: true })).toHaveCount(1);
});

test("a floating tool label opens that tool on the tools map", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-world", /^(ready|fallback)$/, { timeout: 20_000 });
  test.skip((await page.locator("html").getAttribute("data-world")) !== "ready", "the 3D world does not run in this browser");
  const label = page.locator('[data-tool-tag="panchang"]');
  await expect(label).toBeVisible({ timeout: 10_000 });
  await label.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Destinations" }).getByRole("button", { name: /Panchang/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("article.destination").getByRole("heading", { name: "Panchang" })).toBeVisible();
});

test("the bar tucks away while reading down and returns on the way up", async ({ page, isMobile }) => {
  test.skip(isMobile, "checked once, on desktop");
  await page.goto("/");
  const header = page.locator("header.nav");
  await page.mouse.wheel(0, 2400);
  await expect(header).toHaveAttribute("data-hidden", "true");
  await page.mouse.wheel(0, -400);
  await expect(header).not.toHaveAttribute("data-hidden", "true");
});

test("SEO files and metadata point at ayudhas.com", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://ayudhas.com/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /https:\/\/ayudhas\.com\/og\.png/);
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://ayudhas.com/sitemap.xml");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>https://ayudhas.com/</loc>");
  const legacy = await (await request.get("/login/")).text();
  expect(legacy).toContain('content="noindex');
});

test("in-page links glide to their section, update the address and move focus there", async ({ page, isMobile }) => {
  test.skip(isMobile, "the desktop navigation holds the links");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Stories" }).click();
  await expect(page).toHaveURL(/#stories$/);
  await expect(page.locator("#stories")).toBeFocused();
  await expect(page.getByRole("heading", { name: "What a good tool feels like." })).toBeInViewport();
});

test("Solar Vision opens from the menu and shows the live Sun and Moon for a place", async ({ browser, isMobile, baseURL }) => {
  const ctx = await browser.newContext({
    baseURL, ...(isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {}),
    geolocation: { latitude: 51.5074, longitude: -0.1278 }, permissions: ["geolocation"],
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { throw e; });
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Sections (mobile)" }).getByRole("link", { name: /Solar Vision/ }).click();
  } else {
    await page.getByRole("link", { name: "Solar Vision" }).first().click();
  }
  await expect(page).toHaveURL(/\/solar-vision\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Solar Vision" })).toBeAttached();
  await expect(page.getByRole("tab", { name: "Rooftop sky" })).toHaveAttribute("aria-selected", "true");
  // The numbers run without the 3D view: phase, lit fraction, and rise and set times.
  const panel = page.getByRole("complementary", { name: "Live data" });
  await expect(panel).toContainText(/% lit/, { timeout: 20_000 });
  await expect(panel).toContainText("Sunrise");
  await expect(page.locator(".sv-place small")).toContainText("51.51°N 0.13°W", { timeout: 20_000 });
  await page.getByRole("tab", { name: "From space" }).click();
  await expect(page.getByRole("tab", { name: "From space" })).toHaveAttribute("aria-selected", "true");
  await ctx.close();
});

test("Solar Vision finds a city by name and shows its local time", async ({ page }) => {
  await page.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ lat: "51.5074", lon: "-0.1278", name: "London", display_name: "London, England, United Kingdom",
      address: { city: "London", state: "England", country: "United Kingdom" } }]),
  }));
  await page.goto("/solar-vision/");
  await page.locator(".sv-place").click();
  const dialog = page.getByRole("dialog", { name: "Choose a place" });
  await dialog.getByLabel("Or search a city").fill("London");
  await dialog.getByRole("button", { name: "Search" }).click();
  await dialog.getByRole("button", { name: /London/ }).click();
  await expect(page.locator(".sv-place-name")).toHaveText("London");
  await expect(page.getByRole("complementary", { name: "Live data" })).toContainText("Europe/London", { timeout: 20_000 });
  await expect(page.locator(".sv-clock time")).toContainText(/GMT|BST/);
});

test("Solar Vision can pause, rewind and jump to a chosen date and time", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, timezoneId: "Asia/Kolkata" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { throw e; });
  await page.goto("/solar-vision/");
  const status = page.locator(".sv-live");
  const clock = page.locator(".sv-time time");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(status).toHaveText(/Paused/i);
  const held = await clock.innerText();
  await page.waitForTimeout(1500);
  await expect(clock).toHaveText(held);
  await page.getByRole("button", { name: /^Rewind/ }).click();
  await expect(status).toHaveText(/Rewind/i);
  // Phones keep the date box behind a calendar button.
  const toggle = page.getByRole("button", { name: "Go to a date and time" });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByLabel("Go to date & time").fill("2027-01-01T21:30");
  await expect(status).toHaveText(/Paused/i);
  await expect(clock).toContainText("1 Jan, 2027");
  await expect(clock).toContainText("09:30");
  await page.getByRole("button", { name: "Back to now" }).click();
  await expect(status).toHaveText(/Live/i);
  await ctx.close();
});

test("Solar Vision's full screen hides every control and brings them back", async ({ page }) => {
  page.on("pageerror", (e) => { throw e; });
  await page.goto("/solar-vision/");
  const bars = page.locator(".sv-head, .sv-time");
  await expect(bars.first()).toBeVisible();
  await page.getByRole("button", { name: /Full screen/ }).click();
  await expect(page.locator(".sv-head")).toBeHidden();
  await expect(page.locator(".sv-time")).toBeHidden();
  await page.getByRole("button", { name: "Show the controls again" }).click();
  await expect(page.locator(".sv-head")).toBeVisible();
  await expect(page.locator(".sv-time")).toBeVisible();
});
