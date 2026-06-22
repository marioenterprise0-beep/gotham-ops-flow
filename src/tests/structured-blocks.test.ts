import { describe, it, expect } from "vitest";
import { isFillablePlaceholder, splitCheckboxSegments } from "@/components/gotham/StructuredBlocks";

// Imported directly (not duplicated like the other tests in this
// folder) — StructuredBlocks.tsx has no Supabase/createServerFn
// dependency, only a type-only React import and a trivial cn() helper,
// so it's safe to test the real implementation rather than a copy that
// could silently drift from it.

describe("isFillablePlaceholder", () => {
  it("treats an empty string as fillable", () => {
    expect(isFillablePlaceholder("")).toBe(true);
    expect(isFillablePlaceholder("   ")).toBe(true);
  });

  it("treats a run of underscores as fillable", () => {
    expect(isFillablePlaceholder("____")).toBe(true);
    expect(isFillablePlaceholder("__________")).toBe(true);
  });

  it("treats yes/no and y/n placeholders as fillable", () => {
    expect(isFillablePlaceholder("Yes/No")).toBe(true);
    expect(isFillablePlaceholder("y/n")).toBe(true);
  });

  it("does not treat real sentence content as fillable", () => {
    expect(isFillablePlaceholder("Employee Full Name")).toBe(false);
    expect(isFillablePlaceholder("Overall rating: ____")).toBe(false); // inline blank, not a whole-blank paragraph
  });

  it("does not treat a short underscore run as fillable (avoids false positives on em-dash-style separators)", () => {
    expect(isFillablePlaceholder("__")).toBe(false);
  });
});

describe("splitCheckboxSegments", () => {
  it("returns null when there's no checkbox glyph", () => {
    expect(splitCheckboxSegments("Just regular text")).toBeNull();
  });

  it("splits a single checkbox into one segment", () => {
    const segs = splitCheckboxSegments("☐ Attendance / Tardiness");
    expect(segs).toEqual([{ checked: false, label: "Attendance / Tardiness" }]);
  });

  it("splits multiple checkboxes sharing one line", () => {
    const segs = splitCheckboxSegments("☐ Yes  ☐ No");
    expect(segs).toEqual([
      { checked: false, label: "Yes" },
      { checked: false, label: "No" },
    ]);
  });

  it("honors pre-checked glyphs (☑/☒) even though source PDFs never pre-check a box", () => {
    const segs = splitCheckboxSegments("☑ Reviewed  ☐ Not reviewed");
    expect(segs).toEqual([
      { checked: true, label: "Reviewed" },
      { checked: false, label: "Not reviewed" },
    ]);
  });
});
