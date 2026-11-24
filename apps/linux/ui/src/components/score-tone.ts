const tones = {
  high: { background: "bg-score-high", text: "text-score-high" },
  good: { background: "bg-score-good", text: "text-score-good" },
  mid: { background: "bg-score-mid", text: "text-score-mid" },
  low: { background: "bg-score-low", text: "text-score-low" },
};

export function scoreTone(value: number) {
  if (value >= 90) return tones.high;
  if (value >= 75) return tones.good;
  if (value >= 60) return tones.mid;
  return tones.low;
}
