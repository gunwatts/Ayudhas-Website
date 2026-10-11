import { CONTACT_TOPICS, type ContactTopic, SITE } from "@/content/site";

export type ContactFields = { name: string; email: string; topic: ContactTopic | ""; message: string; website: string };
export type ContactErrors = Partial<Record<"name" | "email" | "topic" | "message", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same rules as the server (app/schemas/finance.py ContactIn), so most mistakes are caught before sending. */
export function validateContact(f: ContactFields): ContactErrors {
  const e: ContactErrors = {};
  if (!f.name.trim()) e.name = "Enter your name";
  else if (f.name.trim().length > 100) e.name = "Use at most 100 characters";
  if (!EMAIL.test(f.email.trim())) e.email = "Enter an email address like name@example.com";
  if (!CONTACT_TOPICS.some((t) => t.value === f.topic)) e.topic = "Choose what your message is about";
  const len = f.message.trim().length;
  if (len < 10) e.message = "Write at least 10 characters";
  else if (len > 5000) e.message = "Keep it under 5,000 characters";
  return e;
}

export type SendResult = { ok: true } | { ok: false; message: string; fieldErrors?: ContactErrors };

export async function sendContact(f: ContactFields, fetcher: typeof fetch = fetch): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetcher(`${SITE.apiBaseUrl}/api/v1/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...f, name: f.name.trim(), email: f.email.trim(), message: f.message.trim() }),
    });
  } catch {
    return { ok: false, message: `Couldn't reach the server. Check your connection, or email ${SITE.email}.` };
  }
  if (res.ok) return { ok: true };
  let body: { error?: { message?: string; details?: { field: string | null; message: string }[] } } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const fieldErrors: ContactErrors = {};
  for (const d of body?.error?.details ?? []) {
    if (d.field === "name" || d.field === "email" || d.field === "topic" || d.field === "message") fieldErrors[d.field] = d.message;
  }
  if (res.status === 429) return { ok: false, message: "Too many messages from your connection. Please try again in an hour." };
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
  return { ok: false, message: `Something went wrong on our side. Please try again, or email ${SITE.email}.` };
}
