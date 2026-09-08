import { describe, expect, it } from "vitest";
import { buildStoragePath, validateUpload } from "@/lib/security/upload";

describe("upload validation", () => {
  it("accepts images and videos for workshop media", () => {
    expect(validateUpload({ type: "image/jpeg", size: 1024 }, "RECEPTION")).toMatchObject({ ok: true, extension: "jpg", isVideo: false });
    expect(validateUpload({ type: "video/mp4", size: 50 * 1024 * 1024 }, "DIAGNOSTIC")).toMatchObject({ ok: true, extension: "mp4", isVideo: true });
  });
  it("refuses wrong MIME types and oversized files", () => {
    expect(validateUpload({ type: "application/x-msdownload", size: 10 }, "RECEPTION").ok).toBe(false);
    expect(validateUpload({ type: "image/jpeg", size: 100 * 1024 * 1024 }, "RECEPTION").ok).toBe(false);
    expect(validateUpload({ type: "image/jpeg", size: 0 }, "RECEPTION").ok).toBe(false);
    expect(validateUpload({ type: "image/jpeg", size: 10 }, "DOCUMENT").ok).toBe(false);
    expect(validateUpload({ type: "application/pdf", size: 10 }, "DOCUMENT").ok).toBe(true);
  });
  it("never uses the user-provided file name in the storage path", () => {
    const path = buildStoragePath("11111111-1111-4111-8111-111111111111", "SAV", "jpg");
    expect(path).toMatch(/^11111111-1111-4111-8111-111111111111\/SAV\/[0-9a-f-]{36}\.jpg$/);
  });
});
