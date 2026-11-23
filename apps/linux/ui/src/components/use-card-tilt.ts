import { useState } from "react";

const hoverTilts = [
  "motion-safe:group-hover/card:-rotate-2 motion-safe:group-focus-visible/card:-rotate-2",
  "motion-safe:group-hover/card:-rotate-1 motion-safe:group-focus-visible/card:-rotate-1",
  "motion-safe:group-hover/card:-rotate-0.5 motion-safe:group-focus-visible/card:-rotate-0.5",
  "motion-safe:group-hover/card:rotate-0.5 motion-safe:group-focus-visible/card:rotate-0.5",
  "motion-safe:group-hover/card:rotate-1 motion-safe:group-focus-visible/card:rotate-1",
  "motion-safe:group-hover/card:rotate-2 motion-safe:group-focus-visible/card:rotate-2",
] as const;

export function useCardTilt() {
  const [hoverTilt, setHoverTilt] = useState<string>(hoverTilts[0]);
  function chooseTilt() {
    const alternatives = hoverTilts.filter((tilt) => tilt !== hoverTilt);
    setHoverTilt(alternatives[Math.floor(Math.random() * alternatives.length)]);
  }
  return { hoverTilt, chooseTilt };
}
