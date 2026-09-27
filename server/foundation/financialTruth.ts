import { assertNoDirectFinancialMutation } from "../phase1";
export const FinancialTruthWorkflow = { sourceIngestion: "source_ingestion", reconciliation: "reconciliation", governedRecalculation: "governed_recalculation" } as const;
export type FinancialTruthWorkflow = typeof FinancialTruthWorkflow[keyof typeof FinancialTruthWorkflow];
export function rejectDirectFinancialOutputEdit(): never { return assertNoDirectFinancialMutation(); }
