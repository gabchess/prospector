import { describe, expect, it } from "vitest";
import { parseCsvLine, toCsvField } from "./csv.js";

describe("parseCsvLine", () => {
  it("keeps a comma inside a quoted field", () => {
    expect(parseCsvLine('"DMi Partners, Inc",dmi.com')).toEqual([
      "DMi Partners, Inc",
      "dmi.com",
    ]);
  });

  it("unescapes a doubled quote", () => {
    expect(parseCsvLine('"Say ""hi""",x')).toEqual(['Say "hi"', "x"]);
  });
});

describe("toCsvField", () => {
  it("quotes a field that contains a comma and round-trips it", () => {
    const field = toCsvField("Brandwoven, Inc");
    expect(field).toBe('"Brandwoven, Inc"');
    expect(parseCsvLine(field)).toEqual(["Brandwoven, Inc"]);
  });

  it("neutralizes a leading formula character", () => {
    expect(toCsvField('=HYPERLINK("http://evil")')).toBe(
      `"'=HYPERLINK(""http://evil"")"`,
    );
    expect(toCsvField("+1 555")).toBe("'+1 555");
    expect(toCsvField("Acme")).toBe("Acme");
  });
});
