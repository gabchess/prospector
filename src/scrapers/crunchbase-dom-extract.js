(() => {
  const skip = new Set([
    "discover", "search", "lists", "add", "new", "compare",
    "advanced", "query", "saved", "organizations", "people",
  ]);
  const isOrg = (href) => {
    if (!href) return false;
    const m = href.match(/\/organization\/([^/?#]+)/i);
    if (!m || !m[1]) return false;
    const slug = decodeURIComponent(m[1]).toLowerCase();
    return slug.length > 0 && !skip.has(slug);
  };
  const permalinkOf = (href) => {
    const m = href.match(/\/organization\/([^/?#]+)/i);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  };
  const clean = (s) => {
    if (s == null) return null;
    const t = String(s).replace(/\s+/g, " ").trim();
    return t || null;
  };
  const looksDomain = (s) => {
    if (!s || s.includes("crunchbase.com")) return false;
    return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(s.trim());
  };
  const looksFunding = (s) => {
    if (!s) return false;
    return /[$€£]|\b(usd|seed|series|pre-seed|angel|undisclosed|grant|debt|million|billion)\b/i.test(s);
  };
  const looksHeadcount = (s) => {
    if (!s) return false;
    return (
      /^c_\d+/i.test(s) ||
      /^\d{1,3}(,\d{3})*$/.test(s.trim()) ||
      (s.includes("-") && /\d/.test(s) && s.length < 40) ||
      s.toLowerCase().includes("employee")
    );
  };
  const headerAlias = (text) => {
    const t = text.toLowerCase();
    if ((t.includes("website") || t.includes("domain")) && !t.includes("crunchbase")) return "domain";
    if (t.includes("industr") || t.includes("categorie") || t.includes("sector")) return "industry";
    if (t.includes("headquarter") || t.includes("location") || t === "hq" || t.includes("country") || t.includes("city")) {
      return "headquarters";
    }
    if (t.includes("employee") || t.includes("headcount") || t.includes("staff") || t.includes("size")) {
      return "headcount";
    }
    if (t.includes("funding") || t.includes("raised")) return "funding";
    if (t.includes("organization") || t.includes("company") || t.includes("name")) return "name";
    return null;
  };

  const rows = [];
  const seen = new Set();
  const push = (row) => {
    const permalink = row.permalink || (row.url ? permalinkOf(row.url) : null);
    const key = (permalink || row.url || row.name || "").toLowerCase();
    if (!key || seen.has(key) || (!row.name && !permalink)) return;
    seen.add(key);
    rows.push({
      name: clean(row.name),
      domain: clean(row.domain),
      country: clean(row.country),
      headquarters: clean(row.headquarters),
      headcount: clean(row.headcount),
      industry: clean(row.industry),
      funding: clean(row.funding),
      url: row.url,
      permalink,
    });
  };

  const tables = Array.from(document.querySelectorAll("table"));
  for (const table of tables) {
    const headers = Array.from(table.querySelectorAll("th")).map((th) => headerAlias(th.textContent || ""));
    const bodyRows = Array.from(table.querySelectorAll("tbody tr, tr")).filter((tr) => !tr.querySelector("th"));
    for (const tr of bodyRows) {
      const cells = Array.from(tr.querySelectorAll("td"));
      if (cells.length === 0) continue;
      const link = tr.querySelector('a[href*="/organization/"]');
      if (!link || !isOrg(link.href)) continue;
      const rec = {
        name: clean(link.textContent) || clean(link.getAttribute("title")),
        domain: null,
        country: null,
        headquarters: null,
        headcount: null,
        industry: null,
        funding: null,
        url: link.href,
        permalink: permalinkOf(link.href),
      };
      cells.forEach((td, i) => {
        const field = headers[i];
        const text = clean(td.textContent);
        if (!field || !text) {
          if (!rec.domain && looksDomain(text)) rec.domain = text;
          return;
        }
        if (field === "name" && !rec.name) rec.name = text;
        if (field === "domain") rec.domain = text;
        if (field === "headquarters") rec.headquarters = text;
        if (field === "headcount") rec.headcount = text;
        if (field === "industry") rec.industry = text;
        if (field === "funding") rec.funding = text;
      });
      push(rec);
    }
  }

  const anchors = Array.from(document.querySelectorAll('a[href*="/organization/"]'));
  for (const a of anchors) {
    if (!isOrg(a.href)) continue;
    const block = a.closest('[class*="row"], [class*="card"], [class*="item"], li, article, tr') || a.parentElement;
    const texts = ((block && block.innerText) || a.textContent || "")
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    const rec = {
      name: clean(a.textContent) || clean(a.getAttribute("title")),
      domain: texts.find(looksDomain) || null,
      country: null,
      headquarters: texts.find((t) => /united states|united kingdom|canada|australia|, [A-Z]{2}$/i.test(t)) || null,
      headcount: texts.find(looksHeadcount) || null,
      industry: null,
      funding: texts.find(looksFunding) || null,
      url: a.href,
      permalink: permalinkOf(a.href),
    };
    push(rec);
  }

  const body = (document.body && document.body.innerText ? document.body.innerText : "").toLowerCase();
  const emptyState =
    body.includes("no results") ||
    body.includes("0 companies") ||
    body.includes("didn't find any") ||
    body.includes("did not find any");
  const hasResultChrome =
    Boolean(document.querySelector('a[href*="/organization/"]')) ||
    body.includes("companies") ||
    body.includes("results");
  return { rows, emptyState, hasResultChrome };
})()
