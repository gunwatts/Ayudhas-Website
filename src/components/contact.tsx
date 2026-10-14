"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CONTACT_TOPICS, SITE } from "@/content/site";
import { type ContactErrors, type ContactFields, sendContact, validateContact } from "@/lib/contact";

import { type Prefill, PREFILL_EVENT } from "./pro";
import { SplitHeading } from "./split-heading";

const EMPTY: ContactFields = { name: "", email: "", topic: "", message: "", website: "" };
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

/** Scene 7: the contact form. Messages are stored by the Ayudhas server and read by the creator; no email is sent. */
export function Contact() {
  const uid = useId();
  const [f, setF] = useState<ContactFields>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onPrefill = (e: Event) => {
      const d = (e as CustomEvent<Prefill>).detail;
      setF((v) => ({ ...v, topic: d.topic, message: v.message || d.message }));
      setStatus({ kind: "idle" });
      window.setTimeout(() => messageRef.current?.focus({ preventScroll: true }), 600);
    };
    window.addEventListener(PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(PREFILL_EVENT, onPrefill);
  }, []);

  const set = (k: keyof ContactFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setF((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k as keyof ContactErrors]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateContact(f);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = (["name", "email", "topic", "message"] as const).find((k) => found[k]);
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStatus({ kind: "sending" });
    const r = await sendContact(f);
    if (r.ok) {
      setStatus({ kind: "sent" });
      setF(EMPTY);
    } else {
      setErrors(r.fieldErrors ?? {});
      setStatus({ kind: "error", message: r.message });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SITE.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const id = (k: string) => `${uid}-${k}`;
  const described = (k: keyof ContactErrors, hint = false) => (errors[k] ? `${id(k)}-error` : hint ? `${id(k)}-hint` : undefined);

  return (
    <section id="contact" className="scene contact" aria-labelledby="contact-title" data-chapter>
      <div className="wrap contact-grid">
        <div className="contact-intro reveal">
          <span className="label">Contact the creator</span>
          <SplitHeading id="contact-title" parts={["Say hello, report a bug, or suggest the next tool."]} />
          <p className="lede">
            Questions, feedback, product ideas, collaborations and business inquiries are all welcome. Every message is read by
            the person who builds Ayudhas.
          </p>
          <div className="glass email-card">
            <span className="label">Or email directly</span>
            <p className="email-row">
              <a href={`mailto:${SITE.email}`} className="email">{SITE.email}</a>
              <button type="button" className="btn btn-ghost copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </p>
          </div>
        </div>

        <form ref={formRef} className="glass contact-form reveal" onSubmit={submit} noValidate aria-describedby={`${uid}-privacy`}>
          {status.kind === "sent" ? (
            <div className="sent" role="status">
              <span className="sent-mark" aria-hidden>✓</span>
              <h3>Message received.</h3>
              <p>Thank you. You&apos;ll get a reply at the email you gave, usually within a few days.</p>
              <button type="button" className="btn btn-ghost" onClick={() => setStatus({ kind: "idle" })}>Send another message</button>
            </div>
          ) : (
            <>
              <div className="form-row">
                <Field id={id("name")} label="Your name" error={errors.name}>
                  <input id={id("name")} name="name" autoComplete="name" maxLength={100} value={f.name} onChange={set("name")}
                    aria-invalid={!!errors.name} aria-describedby={described("name")} />
                </Field>
                <Field id={id("email")} label="Email" error={errors.email} hint="Only used to reply to you.">
                  <input id={id("email")} name="email" type="email" autoComplete="email" maxLength={254} value={f.email} onChange={set("email")}
                    aria-invalid={!!errors.email} aria-describedby={described("email", true)} />
                </Field>
              </div>
              <Field id={id("topic")} label="What is it about?" error={errors.topic}>
                <select id={id("topic")} name="topic" value={f.topic} onChange={set("topic")} aria-invalid={!!errors.topic} aria-describedby={described("topic")}>
                  <option value="" disabled>Choose a topic</option>
                  {CONTACT_TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field id={id("message")} label="Message" error={errors.message} hint={`${f.message.trim().length} / 5000`}>
                <textarea ref={messageRef} id={id("message")} name="message" rows={6} maxLength={5000} value={f.message} onChange={set("message")}
                  aria-invalid={!!errors.message} aria-describedby={described("message", true)} />
              </Field>
              {/* Spam trap: hidden from people and screen readers; bots tend to fill it in. */}
              <div className="hp" aria-hidden>
                <label htmlFor={id("website")}>Leave this empty</label>
                <input id={id("website")} name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
              </div>
              {status.kind === "error" && <p className="form-error" role="alert">{status.message}</p>}
              <div className="form-foot">
                <p id={`${uid}-privacy`} className="field-hint">Stored on the Ayudhas server and read only by the creator. No newsletter, no sharing.</p>
                <button type="submit" className="btn btn-primary" disabled={status.kind === "sending"}>
                  {status.kind === "sending" ? "Sending…" : "Send message"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
