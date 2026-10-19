import { describe, expect, it } from "vitest";

import { appLink, parseAppLink } from "@/components/solar/app-link";

describe("app mode link", () => {
  it("is off without #app or without a full place", () => {
    expect(parseAppLink("")).toBeNull();
    expect(parseAppLink("#lat=1&lon=2")).toBeNull();
    expect(parseAppLink("#app")).toBeNull();
    expect(parseAppLink("#app&lat=abc&lon=78")).toBeNull();
    expect(parseAppLink("#app&lat=91&lon=78")).toBeNull();
    expect(parseAppLink("#app&lat=17&lon=181")).toBeNull();
  });

  it("reads the place, name and time zone", () => {
    expect(parseAppLink("#app&lat=17.385&lon=78.4867&name=Hyderabad&tz=Asia%2FKolkata")).toEqual({
      lat: 17.385, lon: 78.4867, name: "Hyderabad", tz: "Asia/Kolkata",
    });
  });

  it("labels an unnamed place by its coordinates and drops a malformed time zone", () => {
    expect(parseAppLink("#app&lat=-33.8688&lon=151.2093&tz=<script>")).toEqual({
      lat: -33.8688, lon: 151.2093, name: "-33.87, 151.21", tz: undefined,
    });
  });

  it("builds a link that reads back the same", () => {
    const place = { lat: 51.5074, lon: -0.1278, name: "London", tz: "Europe/London" };
    const link = appLink("https://ayudhas.com/solar-vision/", place);
    expect(link).toBe("https://ayudhas.com/solar-vision/#app&lat=51.5074&lon=-0.1278&name=London&tz=Europe%2FLondon");
    expect(parseAppLink(link.slice(link.indexOf("#")))).toEqual(place);
  });
});
