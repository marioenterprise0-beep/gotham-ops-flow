import { describe, it, expect } from "vitest";

// Pure sanitization logic duplicated from
// src/lib/inventory-changes.functions.ts (which has createServerFn/
// Supabase middleware dependencies, so it isn't imported directly here —
// same convention as the other tests in this folder).
//
// Guards against the real vulnerability fixed earlier: inventory change
// request payloads are unvalidated client JSON, and SignedImage renders
// any http(s)-looking image_url directly via <img src> with no domain
// check — so a crafted payload could make an inventory item's "image"
// silently load from an attacker-controlled URL once a manager approves
// it, leaking every later viewer's IP/UA to that host.
function sanitizeImageUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.includes("://") ? null : v;
}

describe("sanitizeImageUrl", () => {
  it("rejects http(s) URLs", () => {
    expect(sanitizeImageUrl("http://attacker.example/tracker.png")).toBeNull();
    expect(sanitizeImageUrl("https://attacker.example/tracker.png")).toBeNull();
  });

  it("rejects any scheme, not just http(s)", () => {
    expect(sanitizeImageUrl("javascript://alert(1)")).toBeNull();
    expect(sanitizeImageUrl("ftp://example.com/x")).toBeNull();
  });

  it("rejects empty, whitespace, null, and non-string input", () => {
    expect(sanitizeImageUrl("")).toBeNull();
    expect(sanitizeImageUrl("   ")).toBeNull();
    expect(sanitizeImageUrl(null)).toBeNull();
    expect(sanitizeImageUrl(undefined)).toBeNull();
    expect(sanitizeImageUrl(42)).toBeNull();
  });

  it("allows a bare storage path, what the real upload flow produces", () => {
    expect(sanitizeImageUrl("inventory/abc-123/1700000000-photo.jpg")).toBe(
      "inventory/abc-123/1700000000-photo.jpg",
    );
  });
});
