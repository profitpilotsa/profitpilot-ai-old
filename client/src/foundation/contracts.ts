import type { DataMode, DataProvenance, PlatformConnection, PlatformName, Store } from "@/domain/types";

/** The UI requests capability data without knowing whether it is demo, API, database, or an adapter. */
export interface DataSourceContext { organizationId?: string; storeId?: string; mode: DataMode; }
export interface DataSource<T> { readonly mode: DataMode; read(context: DataSourceContext): Promise<T>; }
export interface SourceRegistry { get<T>(capability: string, mode: DataMode): DataSource<T> | undefined; }

export type EngineStatus = "no_data" | "incomplete" | "estimated" | "actual";
export interface EngineResult<T> { status: EngineStatus; value?: T; provenance: DataProvenance[]; missingInputs: string[]; }
export interface BusinessEngine<TInput, TOutput> { evaluate(input: TInput, context: DataSourceContext): Promise<EngineResult<TOutput>>; }
export type TrueCostEngine = BusinessEngine<unknown, unknown>;
export type ProfitEngine = BusinessEngine<unknown, unknown>;
export type InventoryEngine = BusinessEngine<unknown, unknown>;
export type CashEngine = BusinessEngine<unknown, unknown>;
export type DecisionEngine = BusinessEngine<unknown, unknown>;

/** Adapter boundary only. OAuth, webhooks, and synchronization are intentionally out of Phase 0. */
export interface PlatformAdapter { readonly platform: PlatformName; describeConnection(connection: PlatformConnection): Promise<PlatformConnection>; validateStore(store: Store): Promise<{ valid: boolean; reason?: string }>; }
export interface PlatformAdapterRegistry { get(platform: PlatformName): PlatformAdapter | undefined; }
