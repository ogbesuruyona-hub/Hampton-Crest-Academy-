import { describe, expect, it } from "vitest";
import {
  bookCoverSource,
  initialBookCoverState,
  nextBookCoverState,
  normalizeBookCoverUrl,
} from "./bookCover";

describe("book cover presentation", () => {
  it("keeps a valid persistent cover URL", () => {
    expect(normalizeBookCoverUrl(" https://images.example.com/book.webp ")).toBe(
      "https://images.example.com/book.webp",
    );
    expect(initialBookCoverState("https://images.example.com/book.webp")).toBe("loading");
  });

  it("uses the fallback for a missing cover without producing an empty src", () => {
    expect(normalizeBookCoverUrl(undefined)).toBeNull();
    expect(normalizeBookCoverUrl("   ")).toBeNull();
    expect(initialBookCoverState("")).toBe("fallback");
  });

  it("uses the fallback after a real image error without retry loops", () => {
    expect(nextBookCoverState("loading", "failed")).toBe("fallback");
    expect(nextBookCoverState("fallback", "failed")).toBe("fallback");
  });

  it("accepts same-origin assets and rejects unsafe protocols", () => {
    expect(normalizeBookCoverUrl("/assets/covers/book.webp")).toBe("/assets/covers/book.webp");
    expect(normalizeBookCoverUrl("javascript:alert(1)")).toBeNull();
  });

  it("keeps controlled Supabase covers direct and proxies other external hosts", () => {
    expect(
      bookCoverSource({ id: "book-1", cover_url: "https://project.supabase.co/storage/cover.webp" }),
    ).toBe("https://project.supabase.co/storage/cover.webp");
    expect(
      bookCoverSource({ id: "book 2", cover_url: "https://encrypted-tbn0.gstatic.com/cover.jpg" }),
    ).toBe("/api/books/book%202/cover");
  });
});
