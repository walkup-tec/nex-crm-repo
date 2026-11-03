import { z } from "zod";

export const CLAIM_IR_VERSION = "1.0.0";

export const claimOperations = [
  "METRIC_VALUE",
  "PERIOD_COMPARISON",
  "ENTITY_COMPARISON",
  "QUALITATIVE_CLASSIFICATION",
  "CAUSAL_HYPOTHESIS",
  "MONITOR",
  "STRATEGIC_TEST",
] as const;

export type ClaimOperation = (typeof claimOperations)[number];

export const entityLevelSchema = z.enum(["account", "campaign", "adset", "ad"]);

export const metricValueArgsSchema = z
  .object({
    metric: z.string().min(1),
    period_key: z.string().optional(),
  })
  .strict();

export const periodComparisonArgsSchema = z
  .object({
    metric: z.string().min(1),
    baseline_period: z.string().min(1),
    current_period: z.string().min(1),
    operator: z.enum(["delta_pct", "delta_abs"]),
  })
  .strict();

export const entityComparisonArgsSchema = z
  .object({
    metric: z.string().min(1),
    other_entity_id: z.string().min(1),
    other_entity_level: entityLevelSchema,
    operator: z.enum(["delta_pct", "delta_abs", "rank"]),
  })
  .strict();

export const qualitativeArgsSchema = z
  .object({
    metric: z.string().min(1),
    label: z.string().min(1),
    criterion: z.string().min(1),
  })
  .strict();

export const causalArgsSchema = z
  .object({
    premise: z.string().min(1),
    related_metric_refs: z.array(z.string().min(1)).default([]),
    relation: z.string().min(1),
  })
  .strict();

export const monitorCriterionSchema = z
  .object({
    type: z.literal("PERIODIC_REVIEW"),
    metrics: z.array(z.string().min(1)).min(1),
    comparison: z.literal("SAME_METRIC_FUTURE_PERIOD"),
  })
  .strict();

export const monitorArgsSchema = z
  .object({
    metrics: z.array(z.string().min(1)).min(1),
    validation_criterion: monitorCriterionSchema,
  })
  .strict();

export const strategicArgsSchema = z
  .object({
    action_kind: z.enum(["scale_budget", "pause", "replace_creative", "test", "other"]),
    action: z.string().min(1),
    hypothesis: z.string().min(1),
    validation_criterion: z.string().min(1),
    reversal_condition: z.string().optional(),
  })
  .strict();

const claimIrBase = z.object({
  claim_id: z.string().min(1),
  entity_level: entityLevelSchema,
  entity_id: z.string().nullable().default(null),
  metric_refs: z.array(z.string()).default([]),
  comparison_ref: z.string().nullable().default(null),
  hypothesis_ref: z.string().nullable().default(null),
  action_ref: z.string().nullable().default(null),
  requested_evidence_level: z.enum(["E1", "E2", "E3"]).optional(),
});

export const claimIrSchema = z.discriminatedUnion("operation", [
  claimIrBase
    .extend({ operation: z.literal("METRIC_VALUE"), args: metricValueArgsSchema })
    .strict(),
  claimIrBase
    .extend({ operation: z.literal("PERIOD_COMPARISON"), args: periodComparisonArgsSchema })
    .strict(),
  claimIrBase
    .extend({ operation: z.literal("ENTITY_COMPARISON"), args: entityComparisonArgsSchema })
    .strict(),
  claimIrBase
    .extend({
      operation: z.literal("QUALITATIVE_CLASSIFICATION"),
      args: qualitativeArgsSchema,
    })
    .strict(),
  claimIrBase
    .extend({ operation: z.literal("CAUSAL_HYPOTHESIS"), args: causalArgsSchema })
    .strict(),
  claimIrBase.extend({ operation: z.literal("MONITOR"), args: monitorArgsSchema }).strict(),
  claimIrBase
    .extend({ operation: z.literal("STRATEGIC_TEST"), args: strategicArgsSchema })
    .strict(),
]);

export type ClaimIR = z.infer<typeof claimIrSchema>;

export const OPERATION_MIN_EVIDENCE: Record<ClaimOperation, "E1" | "E2" | "E3"> = {
  METRIC_VALUE: "E1",
  PERIOD_COMPARISON: "E2",
  ENTITY_COMPARISON: "E2",
  QUALITATIVE_CLASSIFICATION: "E2",
  CAUSAL_HYPOTHESIS: "E3",
  MONITOR: "E1",
  STRATEGIC_TEST: "E3",
};

export function isClaimOperation(value: unknown): value is ClaimOperation {
  return typeof value === "string" && (claimOperations as readonly string[]).includes(value);
}
