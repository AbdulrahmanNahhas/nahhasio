import type { Page } from "@playwright/test";

// A portrait PNG delivered through the native resource URL contract.
const portrait =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAAEsCAYAAACG+vy+AAADH0lEQVR4nO3ToRXCQBQAwV8L5aDhUQIyZaQIij0auLc2ESPGr9l5Pc8F7M3VAXBnBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAgGgWAQCAaBYBAIBoFgEAjzOz4L2DMIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAiEeby/C9gzCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIhD9QZXdP/G4yIgAAAABJRU5ErkJggg==";

export async function installArtworkFixture(page: Page) {
  // Chromium has no WebKit custom-scheme registration. Emulate its same-origin resource
  // handler only in the fixture, keeping the packaged CSP and opaque bridge URLs intact.
  await page.addInitScript(() => {
    const prefix = "nahhasio://app/_artwork/";
    const resource = (value: string) =>
      value.startsWith(prefix)
        ? `${location.origin}/_fixture_artwork/${value.slice(prefix.length)}`
        : value;
    const attribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name: string, value: string) {
      return attribute.call(
        this,
        name,
        this instanceof HTMLImageElement && name === "src" ? resource(value) : value,
      );
    };
    const source = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...source,
      set(value: string) {
        source.set!.call(this, resource(value));
      },
    });
  });
  await page.route("**/_fixture_artwork/**", (route) =>
    route.fulfill({ contentType: "image/png", body: Buffer.from(portrait, "base64") }),
  );
}
