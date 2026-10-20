/**
 * Everything the website says about Ayudhas and its tools lives here, separate from layout and animation.
 * To add a tool: add a destination (and, if it has screens, a product section). Keep statuses honest:
 * "live" only for things people can use today.
 */

export const SITE = {
  name: "Ayudhas",
  url: "https://ayudhas.com",
  tagline: "Tools for a Life in Motion.",
  description:
    "Ayudhas is a growing collection of useful digital tools: the Ayudhas app for tasks, time, alarms and Panchang on Google Play, and Ayudhas Finance on the web.",
  email: "gunwatts@gmail.com",
  financeUrl: "https://finance.ayudhas.com",
  playUrl: "https://play.google.com/store/apps/details?id=com.gunwatts.lifetracker",
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.ayudhas.com").replace(/\/$/, ""),
};

export type Status = "live-android" | "live-web" | "android-testing" | "planned";

export const STATUS_LABEL: Record<Status, string> = {
  "live-android": "On Google Play",
  "live-web": "Live on the web",
  "android-testing": "Android · closed testing",
  planned: "Planned",
};

export type Destination = {
  id: string;
  name: string;
  realm: string;
  status: Status;
  hue: string; // CSS colour token name, see globals.css
  summary: string;
  points: string[];
  product: string;
  action?: { label: string; href: string };
};

export const DESTINATIONS: Destination[] = [
  {
    id: "tasks",
    name: "Tasks",
    realm: "Productivity",
    status: "live-android",
    hue: "--blue",
    summary: "One-time tasks and repeating routines, with reminders that keep them in view.",
    points: [
      "Daily, weekly and monthly routines",
      "Reminders, including advance reminders before a due date",
      "Done, postpone or skip with a reason",
      "Streaks and a Dedication Score",
    ],
    product: "Ayudhas app",
    action: { label: "See the Ayudhas app", href: "#pro" },
  },
  {
    id: "time",
    name: "Time",
    realm: "Daily life",
    status: "live-android",
    hue: "--cyan",
    summary: "See where your hours go: work, learning, food, exercise, sleep, travel and more.",
    points: [
      "Start an activity in a few taps or from the home-screen widget",
      "“Start earlier” when you forgot to press start",
      "Daily and range analytics",
      "Your own categories and activities",
    ],
    product: "Ayudhas app",
    action: { label: "See the Ayudhas app", href: "#pro" },
  },
  {
    id: "panchang",
    name: "Panchang",
    realm: "Calendar & tradition",
    status: "live-android",
    hue: "--amber",
    summary: "The Hindu calendar for any day: tithi, nakshatra and the times of sun and moon.",
    points: [
      "Tithi and nakshatra for the day",
      "Sunrise, sunset, moonrise and moonset",
      "Moon-phase view and trends across the year",
      "Works offline, for dates within the included data",
      "Sunrise and sunset alarms for a city you choose",
    ],
    product: "Ayudhas app",
    action: { label: "See the Ayudhas app", href: "#pro" },
  },
  {
    id: "finance",
    name: "Finance",
    realm: "Money & utilities",
    status: "live-web",
    hue: "--emerald",
    summary: "Income, expenses, budgets, loans, money held for others, savings and investments.",
    points: [
      "Every rupee as one transaction; balances are always calculated",
      "Loans taken and given, with repayments",
      "Budgets, savings goals and reports",
      "Sign up with Google, or with an invite code",
    ],
    product: "Ayudhas Finance",
    action: { label: "Open Ayudhas Finance", href: "https://finance.ayudhas.com" },
  },
  {
    id: "next",
    name: "Next tools",
    realm: "Future",
    status: "planned",
    hue: "--violet",
    summary: "Ayudhas is built to grow. New tools will join the same map when they are ready.",
    points: ["No dates or features announced yet", "Suggestions are welcome through the contact form"],
    product: "Ayudhas",
    action: { label: "Suggest a tool", href: "#contact" },
  },
];

/** The Android app on Google Play (package com.gunwatts.lifetracker), formerly Life Tracker. */
export const APP = {
  name: "Ayudhas",
  platform: "Android",
  status: "Available on Google Play",
  formerly: "Life Tracker",
  promise: "Plan tasks, track your time, wake up on time and stay on course.",
  traits: ["Works offline", "Your data stays on your device", "Password-protected backups", "Home-screen widget"],
  tools: [
    {
      id: "tasks",
      name: "Task Manager",
      lines: [
        "Create one-time tasks and repeating routines",
        "Set reminders; mark done or snooze straight from the notification",
        "Track streaks, insights and your Dedication Score",
        "See what is due today, what is coming up and what is done",
      ],
    },
    {
      id: "time",
      name: "Time Tracker",
      lines: [
        "Start an activity in a few taps, or from the widget",
        "Fix a forgotten start with “Start earlier”",
        "Daily and range analytics of your top activities",
        "Add your own categories and activities",
      ],
    },
    {
      id: "clock",
      name: "Clock",
      lines: [
        "Alarms that ring even when the app is closed",
        "Wake-up missions: maths, typing, memory, a QR code or a photo",
        "Sunrise and sunset alarms for a city you choose",
        "Stopwatch, timer and world clock",
      ],
    },
    {
      id: "panchang",
      name: "Panchang",
      lines: [
        "Daily tithi and nakshatra",
        "Sunrise, sunset, moonrise and moonset",
        "Solar Vision: the live 3D Sun, Moon and Earth",
        "Offline; shown on devices set to an Indian time zone",
      ],
    },
  ],
  /** Also in the app, without a screen of their own on the site. */
  more: ["finance (money, accounts and loans)", "water reminders", "quick notes"],
};

/** The early-access edition, where new tools are tested before they reach the Ayudhas app. */
export const PRO = {
  name: "Ayudhas Pro",
  status: "Closed testing on Google Play",
  formerly: "Life Tracker Pro",
};

/** Privacy policies, linked from the Play Store listings. */
export const POLICIES = [
  { slug: "ayudhasapp", app: "Ayudhas", packageId: "com.gunwatts.lifetracker", formerly: "Life Tracker" },
  { slug: "ayudhaspro", app: "Ayudhas Pro", packageId: "com.gunwatts.lifetrackerpro", formerly: "Life Tracker Pro" },
] as const;

export type Story = { id: string; title: string; tool: string; steps: { title: string; text: string }[] };

/** Illustrative scenarios (not testimonials): what using each tool looks like. */
export const STORIES: Story[] = [
  {
    id: "morning",
    title: "A morning with a list",
    tool: "Tasks · Ayudhas app",
    steps: [
      { title: "7:00", text: "The phone shows today: four tasks, one of them a weekly routine." },
      { title: "9:30", text: "The reminder for the electricity bill arrives. Pay it, then mark it done right from the notification." },
      { title: "13:00", text: "The stand-up moved. Postpone it to tomorrow without opening the app." },
      { title: "21:00", text: "Three of four done. The streak continues and the Dedication Score ticks up." },
    ],
  },
  {
    id: "week",
    title: "Where did the week go?",
    tool: "Time · Ayudhas app",
    steps: [
      { title: "Monday", text: "Tap Work when the laptop opens; tap Exercise on the way out." },
      { title: "Wednesday", text: "Forgot to start the timer for a class. “Start earlier” sets the real start time." },
      { title: "Sunday", text: "The range analytics show the week's top activities: work, sleep, travel." },
      { title: "Next week", text: "Less travel, one more learning block. A decision based on real hours." },
    ],
  },
  {
    id: "panchang",
    title: "Planning around the calendar",
    tool: "Panchang · Ayudhas app",
    steps: [
      { title: "A date in mind", text: "A family event is being planned for a weekend next month." },
      { title: "Look it up", text: "Open Panchang and browse to that date. No internet needed." },
      { title: "Read the day", text: "Tithi, nakshatra, sunrise and moon times for that day, on one screen." },
      { title: "Decide", text: "The family picks the day with the details in front of them." },
    ],
  },
  {
    id: "money",
    title: "Keeping money straight",
    tool: "Finance · on the web",
    steps: [
      { title: "Salary day", text: "Record the income into the bank account." },
      { title: "A loan to a friend", text: "Log it as money lent; repayments reduce what is outstanding." },
      { title: "Holding cash for family", text: "Track it separately, so it is never mistaken for your own." },
      { title: "Month end", text: "Budgets and reports show where it went, calculated from every entry." },
    ],
  },
];

export const CONTACT_TOPICS = [
  { value: "question", label: "Question" },
  { value: "feedback", label: "Feedback" },
  { value: "suggestion", label: "Product suggestion" },
  { value: "collaboration", label: "Collaboration" },
  { value: "bug", label: "Bug report" },
  { value: "business", label: "Business inquiry" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

/** Every route the finance app used to serve at the root domain. Each now forwards to finance.ayudhas.com. */
export const LEGACY_FINANCE_PATHS = [
  "accounts", "budgets", "categories", "custody", "custody/view", "expenses", "income", "investments",
  "investments/view", "lent", "loans", "loans/view", "login", "messages", "notes", "people", "recurring",
  "reports", "savings", "settings", "signup", "transactions",
];
