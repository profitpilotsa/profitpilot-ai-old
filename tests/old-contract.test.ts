import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(path.join(process.cwd(), "client", "src", "pages", "Home.tsx"), "utf8");
const componentLine = (signature: string) => home.split("\n").find((line) => line.includes(signature)) ?? "";

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
  it("keeps OLD Costs routes and integrates semantics inside their components", () => {
    for (const route of ['path === "/costs" ? CostOverview', 'path === "/cost-settings" ? CostSettings', 'path === "/subscriptions" ? Subscriptions', 'path === "/shipping-costs" ? () => <ManagementTable type="shipping" />']) expect(home).toContain(route);
    for (const signature of ["function CostOverview()", "function CostSettings()", "function ManagementTable", "function Subscriptions()"]) expect(componentLine(signature)).toContain("<CostSemanticPanel");
    expect(home).not.toContain("<Screen />{isCostRoute");
    expect(home).not.toContain("Phase2BExperience");
  });
  it("keeps the missing-cost presentation explicit", () => {
    const panel = readFileSync(path.join(process.cwd(), "client", "src", "components", "CostSemanticPanel.tsx"), "utf8");
    expect(panel).toContain("never presented as SAR 0.00");
  });
  it("keeps OLD inventory and cash routes while using Step 2 adapters", () => {
    for (const item of ['function InventoryIntelligence()', 'function CashAwareDecision()', 'demoInventoryDisplays()', 'demoCashAwareDecision(qty)', 'Save decision']) expect(home).toContain(item);
    expect(home).toContain("Demo decision marked for review; it is not persisted or executed.");
    expect(home).not.toContain("Phase2BStep2Experience");
  });
});
