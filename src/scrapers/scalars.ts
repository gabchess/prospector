/** Both scrapers pull fields out of untyped JSON the site's own API returns.
 * These two helpers take the first scalar they find and never stringify an
 * object by accident. */
export function isScalar(v: unknown): v is string | number {
  return typeof v === "string" || typeof v === "number";
}

export function scalarText(...candidates: unknown[]): string {
  for (const v of candidates) {
    if (isScalar(v)) return String(v);
  }
  return "";
}
