(() => {
  const rows = [];
  const seen = new Set();
  const misses = { cards: 0, name: 0, website: 0, headquarters: 0 };

  function clean(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  const US_STATES = new Set([
    "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia","ks",
    "ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj","nm","ny",
    "nc","nd","oh","ok","or","pa","ri","sc","sd","tn","tx","ut","vt","va","wa","wv",
    "wi","wy","dc",
  ]);
  const CA_PROV = new Set(["on","qc","bc","ab","mb","sk","ns","nb","nl","pe","nt","yt","nu"]);
  const AU_STATES = new Set(["nsw","vic","qld","wa","sa","tas","act","nt"]);
  const COUNTRY = {
    "united states": "US", usa: "US", us: "US",
    "united kingdom": "UK", uk: "UK", england: "UK", scotland: "UK", wales: "UK",
    "northern ireland": "UK",
    canada: "CA",
    australia: "AU",
  };

  function countryFromHq(hq) {
    if (!hq) return null;
    const parts = hq.split(",").map((p) => p.trim()).filter(Boolean);
    const last = (parts[parts.length - 1] || "").toLowerCase();
    if (!last) return null;
    if (COUNTRY[last]) return COUNTRY[last];
    if (US_STATES.has(last)) return "US";
    if (CA_PROV.has(last)) return "CA";
    if (AU_STATES.has(last)) return "AU";
    return last.toUpperCase().length === 2 ? last.toUpperCase() : last;
  }

  function unwrapWebsite(href) {
    if (!href) return null;
    try {
      const u = new URL(href, "https://clutch.co");
      if (u.hostname === "r.clutch.co" || u.pathname.includes("redirect")) {
        const dest = u.searchParams.get("u");
        if (dest) return dest;
      }
      const host = u.hostname.toLowerCase().replace(/^www\./, "");
      if (!host || host === "clutch.co" || host.endsWith(".clutch.co")) return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  function domainOf(href) {
    const dest = unwrapWebsite(href);
    if (!dest) return null;
    try {
      const host = new URL(dest, "https://example.com").hostname.toLowerCase().replace(/^www\./, "");
      if (!host || host === "clutch.co" || host.endsWith(".clutch.co") || !host.includes(".")) return null;
      return host;
    } catch {
      return null;
    }
  }

  function pickWebsiteHref(card) {
    const primary = card.querySelector("a.website-link__item") || card.querySelector("a[data-link='website']") || card.querySelector("a.visit-website");
    if (primary && primary.getAttribute("href")) return primary.getAttribute("href");
    const redirect = card.querySelector("a[href*='r.clutch.co/redirect']");
    if (redirect && redirect.getAttribute("href")) return redirect.getAttribute("href");
    const ext = card.querySelector("a[href^='http']:not([href*='clutch.co'])");
    if (ext && ext.getAttribute("href")) return ext.getAttribute("href");
    return "";
  }

  function pickHq(card) {
    const primary = card.querySelector(".provider__highlights-item.location");
    if (primary) return clean(primary.textContent);
    const itemprop = card.querySelector("[itemprop='address'], [itemprop='addressLocality']");
    if (itemprop) return clean(itemprop.textContent);
    const locality = card.querySelector(".locality, .provider-info__location");
    if (locality) return clean(locality.textContent);
    return "";
  }

  const cards = document.querySelectorAll("li.provider-list-item");
  misses.cards = cards.length;
  const push = (row) => {
    const key = (row.url || row.name || "").toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  for (const card of cards) {
    const nameA = card.querySelector("a.provider__title-link") || card.querySelector("h3 a");
    const name = clean(nameA && nameA.textContent);
    if (!name) {
      misses.name += 1;
      continue;
    }
    const profile = (nameA && nameA.getAttribute("href")) || "";
    const url = profile ? new URL(profile, "https://clutch.co").toString().split("?")[0] : null;
    const website = domainOf(pickWebsiteHref(card));
    const loc = pickHq(card);
    const size = clean(card.querySelector(".employees-count") && card.querySelector(".employees-count").textContent);
    const rating = clean(card.querySelector(".sg-rating__number") && card.querySelector(".sg-rating__number").textContent);
    if (!website) misses.website += 1;
    if (!loc) misses.headquarters += 1;
    push({
      name,
      website,
      headquarters: loc || null,
      country: countryFromHq(loc),
      size: size || null,
      rating: rating || null,
      services: null,
      url,
    });
  }

  const body = (document.body && document.body.innerText || "").toLowerCase();
  return {
    rows,
    misses,
    emptyState: /no results|0 companies|we couldn't find/i.test(body) && rows.length === 0,
    hasResultChrome: rows.length > 0 || /providers|companies|agencies/i.test(body),
    blocked: /just a moment|attention required|verify you are|captcha|access denied|cf-browser/i.test(body),
  };
})()
