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

test("SEO files and metadata point at ayudhas.com", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://ayudhas.com/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /https:\/\/ayudhas\.com\/og\.png/);
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://ayudhas.com/sitemap.xml");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>https://ayudhas.com/</loc>");
  const legacy = await (await request.get("/login/")).text();
  expect(legacy).toContain('content="noindex');
});
