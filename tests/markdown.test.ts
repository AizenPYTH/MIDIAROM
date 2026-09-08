import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/utils/markdown";

describe("renderMarkdown", () => {
  it("renders headings, lists, emphasis and links", () => {
    const html = renderMarkdown("## Titre\n\nUn **gras** et *italique* [lien](/cgv).\n\n- a\n- b\n\n1. un\n2. deux");
    expect(html).toContain("<h2>Titre</h2>");
    expect(html).toContain("<strong>gras</strong>");
    expect(html).toContain("<em>italique</em>");
    expect(html).toContain('<a href="/cgv">lien</a>');
    expect(html).toContain("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
    expect(html).toContain("<ol>");
  });
  it("escapes HTML so CMS content cannot inject markup", () => {
    const html = renderMarkdown('<script>alert(1)</script> [x](javascript:alert(1))');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="javascript:');
  });
});
