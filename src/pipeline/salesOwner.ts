/** Titles that do not satisfy the sales-owner reading of the ICP, even when
 * they also carry Founder. A co-founder who is CTO owns engineering, not the
 * commercial function. */
export const NON_SALES_TITLE =
  /\b(CTO|CFO|CPO|CIO|Chief Technology|Chief Financial|Chief Product|Engineer|Developer)\b/i;

export function ownsSales(title: string): boolean {
  return title.trim().length > 0 && !NON_SALES_TITLE.test(title);
}
