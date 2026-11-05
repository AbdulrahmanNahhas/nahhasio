// Numbering is a review suggestion within the explicitly selected installment.
export function episodeNumber(filename: string): number | null {
  const name =
    filename
      .split("/")
      .at(-1)
      ?.replace(/\.[^.]+$/, "") ?? "";
  const value =
    /S\d{1,3}E(\d{1,4})(?:\D|$)/i.exec(name)?.[1] ??
    /(?:^|[ ._-])(?:E(?:P(?:ISODE)?)?|الحلقة)[ ._-]*(\d{1,4})(?:\D|$)/i.exec(name)?.[1] ??
    /(?:^| - )(\d{1,4})(?:[ ._-]|$)/.exec(name)?.[1];
  if (!value) return null;
  const number = Number(value);
  return number > 0 && !(number >= 1900 && number <= 2100) ? number : null;
}
export function episodeTitle(filename: string): string {
  return (
    filename
      .split("/")
      .at(-1)
      ?.replace(/\.[^.]+$/, "")
      .replaceAll("_", " ") ?? ""
  );
}
