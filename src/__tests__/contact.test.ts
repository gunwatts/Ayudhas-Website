import { describe, expect, it, vi } from "vitest";

import { type ContactFields, sendContact, validateContact } from "@/lib/contact";

const good: ContactFields = { name: "Asha", email: "asha@example.com", topic: "feedback", message: "Love the Panchang view!", website: "" };

describe("validateContact", () => {
  it("accepts a complete message", () => expect(validateContact(good)).toEqual({}));
  it("flags each missing or bad field", () => {
    const e = validateContact({ name: " ", email: "nope", topic: "", message: "hi", website: "" });
    expect(Object.keys(e).sort()).toEqual(["email", "message", "name", "topic"]);
  });
});

describe("sendContact", () => {
  it("posts trimmed JSON to the contact endpoint", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "received" }), { status: 202 }));
    const r = await sendContact({ ...good, name: "  Asha  " }, fetcher as unknown as typeof fetch);
    expect(r).toEqual({ ok: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/contact$/);
    expect(JSON.parse(init.body as string).name).toBe("Asha");
  });
  it("maps server field errors", async () => {
    const body = { error: { code: "invalid", message: "bad", details: [{ field: "email", message: "value is not a valid email address" }] } };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(body), { status: 422 }));
    const r = await sendContact(good, fetcher as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.email).toMatch(/valid email/);
  });
  it("explains rate limits and network failures", async () => {
    const limited = await sendContact(good, (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch);
    expect(!limited.ok && limited.message).toMatch(/Too many/);
    const offline = await sendContact(good, (async () => { throw new TypeError("fail"); }) as unknown as typeof fetch);
    expect(!offline.ok && offline.message).toMatch(/Couldn't reach/);
  });
});
