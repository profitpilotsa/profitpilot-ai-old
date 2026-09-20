import { CircleHelp, Database } from "lucide-react";
import type { CostConfigurationView, CostDisplayStatus } from "@/application/trueCostAdapter";

const label = (value: string) => value === "not_configured" ? "Not configured" : value === "no_data" ? "No data" : value[0].toUpperCase() + value.slice(1);
const tone = (status: CostDisplayStatus) => status === "actual" ? "teal" : status === "estimated" ? "violet" : status === "no_data" ? "red" : "amber";

/** Presentation-only disclosure for already-prepared cost-rule view data. */
export function CostSemanticPanel({ rules, title = "Cost rule details" }: { rules: CostConfigurationView[]; title?: string }) {
  return <div className="panel soft panel-pad" style={{ marginTop: 14 }} aria-label={title}><div className="section-head"><div><h3>{title}</h3><p>Source, scope, calculation, and completeness remain explicit.</p></div><Database size={16} color="#9c90f5" /></div>{rules.map((rule) => <div className="metric-row" key={rule.id}><div><strong style={{ display: "block" }}>{rule.name}</strong><span>{rule.scope} · {rule.calculation.replace("_", " ")} · {rule.recurrence.replace("_", " ")} · effective {rule.effectiveFrom}</span></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><strong className={rule.amount.unavailable ? "warn" : ""}>{rule.amount.display}</strong><span className={`tag ${tone(rule.enabled ? rule.status : "not_configured")}`}>{rule.enabled ? label(rule.status) : "Disabled"}</span></div></div>)}<div className="flow-stack"><CircleHelp size={14} /><span>Missing values remain incomplete; they are never presented as SAR 0.00.</span></div></div>;
}
