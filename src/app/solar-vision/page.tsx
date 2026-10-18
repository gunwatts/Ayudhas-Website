import type { Metadata } from "next";

import { SolarVision } from "@/components/solar/solar-vision";

import "./solar.css";

export const metadata: Metadata = {
  title: "Solar Vision",
  description:
    "The real Sun, Moon and Earth for your place and time, in live 3D: today's Moon phase, where to look for the Moon and the Sun from your rooftop, rise and set times, and how bright they are.",
  alternates: { canonical: "/solar-vision/" },
};

export default function SolarVisionPage() {
  return <SolarVision />;
}
