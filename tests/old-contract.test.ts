import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(path.join(process.cwd(), "client", "src", "pages", "Home.tsx"), "utf8");

describe("OLD visual and interaction contract", () => {
  it("retains the approved route map", () => {
    for (const route of ['href: "/"', 'href: "/decisions"', 'href: "/products"', 'href: "/inventory"', 'href: "/cash"', 'href: "/true-cost"', 'href: "/costs"', 'href: "/marketing"', 'href: "/brain"', 'href: "/analyst"']) expect(home).toContain(route);
  });
  it("retains navigation groups and major OLD surfaces", () => {
    for (const item of ['Workspace', 'Intelligence', 'Costs · التكاليف', 'Business Brain', 'Marketing · الإعلانات والتسويق', 'What needs your attention?', 'Store health', 'Product Profitability', 'True Cost Engine', 'Cash-Aware Decision']) expect(home).toContain(item);
  });
  it("retains critical decision and AI affordances", () => {
    for (const item of ['Save decision', 'Ask ProfitPilot', 'AI Analyst', 'Review true cost breakdown']) expect(home).toContain(item);
  });
});
