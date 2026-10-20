import Link from "next/link";

import { POLICIES, SITE } from "@/content/site";

export type Policy = (typeof POLICIES)[number];

export const POLICY_UPDATED = "20 October 2026";

/**
 * The privacy policy for one Android app, linked from its Play Store listing. Both apps share one code base and
 * behave the same, so one text serves both. Keep it in step with the apps: everything stays on the phone, the
 * only network use is Solar Vision, and there is no account, analytics, advertising or crash reporting.
 */
export function PrivacyPolicy({ policy }: { policy: Policy }) {
  const { app, packageId, formerly } = policy;
  return (
    <main className="legal">
      <p className="label"><Link href="/">Ayudhas</Link> · <Link href="/privacypolicy/">Privacy policies</Link></p>
      <h1>{app} privacy policy</h1>
      <p className="legal-meta">
        Android app <code>{packageId}</code>, formerly called {formerly}. Last updated {POLICY_UPDATED}.
      </p>

      <section aria-labelledby="summary">
        <h2 id="summary">In short</h2>
        <ul>
          <li>Everything you enter in {app} stays on your phone. We do not have a server that receives it.</li>
          <li>There is no account or sign-in, no advertising, no analytics and no tracking.</li>
          <li>{app} never asks for your location, contacts, microphone or files.</li>
          <li>The only part that uses the internet is Solar Vision, which opens a page on ayudhas.com.</li>
          <li>We do not sell or share any data, because we do not collect any.</li>
        </ul>
      </section>

      <section aria-labelledby="stored">
        <h2 id="stored">What the app keeps on your phone</h2>
        <p>
          To work, {app} saves what you enter in a private database inside the app on your phone: tasks, routines and
          their history; time-tracker activities; alarms and their settings, including any reference photo you take
          for a photo mission; finance records; water logs; quick notes; Panchang preferences, the cities you choose,
          and app settings. Other apps cannot read this storage, and none of it is sent to us or to anyone else.
        </p>
      </section>

      <section aria-labelledby="permissions">
        <h2 id="permissions">Permissions and why they are used</h2>
        <dl>
          <dt>Notifications</dt>
          <dd>To show task reminders, water reminders, the daily Tithi (if you turn it on) and ringing alarms.</dd>
          <dt>Alarms and reminders (exact alarms)</dt>
          <dd>So alarms and reminders go off at the exact minute you set.</dd>
          <dt>Camera</dt>
          <dd>
            Only for alarm missions you set up yourself: scanning a QR code or barcode, or taking a photo to match a
            reference photo. Photos are compared on the phone and are never uploaded. The camera is not used for
            anything else.
          </dd>
          <dt>Run at startup</dt>
          <dd>To set your alarms and reminders again after the phone restarts.</dd>
          <dt>Vibration, keep awake, full-screen alerts and foreground service</dt>
          <dd>So a ringing alarm can wake the screen, play its sound and vibrate until you stop it.</dd>
          <dt>Internet</dt>
          <dd>Only for Solar Vision (below).</dd>
        </dl>
        <p>You can turn any permission off in Android settings. The features that need it will then stop working.</p>
      </section>

      <section aria-labelledby="internet">
        <h2 id="internet">Solar Vision and the internet</h2>
        <p>
          Solar Vision shows the live Sun, Moon and Earth by opening{" "}
          <Link href="/solar-vision/">ayudhas.com/solar-vision</Link> inside the app. It does not use your phone&apos;s
          location: you pick a city from a list in the app. The app puts that city&apos;s name, coordinates and time zone
          in the part of the link after <code>#</code>, which browsers never send to a server, and the page works out
          the sky on your phone.
        </p>
        <p>
          Like any web page, loading it means your phone asks our web host (GitHub Pages) for the page and NASA&apos;s
          GIBS service for a satellite image of the Earth. Those services receive your IP address and ordinary
          request details, as they would for any visitor, under their own privacy policies. We do not receive or keep
          these logs. Nothing you entered in {app} is sent.
        </p>
      </section>

      <section aria-labelledby="backups">
        <h2 id="backups">Backups</h2>
        <p>
          You can export a backup file from Settings → Backup and choose where to save or share it. It is your file:
          we never see it. If you set a password, the file is encrypted with AES-256-GCM using a key derived from
          your password (PBKDF2-SHA256); the password is not stored anywhere, so a forgotten password cannot be
          recovered.
        </p>
        <p>
          Android&apos;s own device backup may include app data in your Google account backup if you have it turned
          on. That is handled by Google under your Google account settings, not by us.
        </p>
      </section>

      <section aria-labelledby="delete">
        <h2 id="delete">Keeping and deleting your data</h2>
        <p>
          Your data stays on your phone until you delete it. You can delete single items in the app, clear all of it
          with Android&apos;s &quot;Clear storage&quot; for {app}, or uninstall the app, which removes everything it
          stored. Backup files you exported are yours to keep or delete. Because we hold no data about you, there is
          nothing for us to delete on our side.
        </p>
      </section>

      <section aria-labelledby="children">
        <h2 id="children">Children</h2>
        <p>
          {app} is a general productivity app and is not directed at children under 13. It collects no personal
          information from anyone, including children.
        </p>
      </section>

      <section aria-labelledby="contact-us">
        <h2 id="contact-us">Contacting us</h2>
        <p>
          If you write to us by email or through the contact form on ayudhas.com, we use your name, email address and
          message only to reply to you. Questions about this policy: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Changes to this policy</h2>
        <p>
          If {app} starts handling data differently, we will update this page and the date at the top before the
          change reaches the app.
        </p>
      </section>
    </main>
  );
}
