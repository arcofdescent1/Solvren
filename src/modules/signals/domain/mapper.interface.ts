/**
 * Phase 3 — Mapper interface (§6.4, §11).
 */
import type { MapperContext } from "./mapper-context";
import type { MapperResult } from "./types";

export interface IMapper {
  /** Provider.eventType pattern (e.g. stripe.invoice.payment_failed) */
  readonly mapperKey: string;
  readonly mapperVersion: string;

  /** Whether this mapper can handle the given context */
  canMap(ctx: MapperContext): boolean;

  /** Map raw payload to normalized signal */
  map(ctx: MapperContext): Promise<MapperResult | null>;
}
