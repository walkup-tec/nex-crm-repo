import { z } from "zod";

export const evidenceComparisonSchema = z
  .object({
    type: z.enum(["period_vs_period", "campaign_vs_campaign", "adset_vs_adset", "ad_vs_ad", "other"]),
    entity_ids: z.array(z.string()).optional().default([]),
    compatible: z.boolean(),
    absolute_difference: z.number().nullable().optional(),
    relative_difference_pct: z.number().nullable().optional(),
    volumes: z.record(z.number()).optional(),
  })
  .nullable()
  .optional();

export const structuredRecommendationSchema = z.object({
  id: z.string().min(1),
  entity_id: z.string().min(1),
  level: z.enum(["campaign", "adset", "ad"]),
  indicators_used: z.array(z.string().min(1)).min(1),
  evidence: z.array(z.string().min(1)).default([]),
  hypothesis: z.string().nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]),
  recommended_action: z.string().min(1),
  action_kind: z.enum(["scale_budget", "pause", "replace_creative", "test", "monitor", "other"]),
  validation_criterion: z.string().min(1),
  trace_ids: z.array(z.string()).optional().default([]),
  comparison: evidenceComparisonSchema,
  evidence_level: z.enum(["E0", "E1", "E2", "E3"]).optional(),
  arbitrary_targets: z
    .array(
      z.object({
        metric: z.string().min(1),
        value: z.number(),
        foundation: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),
  uses_external_commercial_data: z.boolean().optional().default(false),
});

export type StructuredRecommendation = z.infer<typeof structuredRecommendationSchema>;

export const structuredClaimSchema = z.object({
  id: z.string().min(1),
  entity_id: z.string().nullable().optional().default(null),
  level: z.enum(["account", "campaign", "adset", "ad"]).default("account"),
  metrics_used: z.array(z.string()).default([]),
  trace_ids: z.array(z.string()).optional().default([]),
  claim_kind: z.enum(["descriptive", "performance_judgment", "indirect_recommendation"]),
  text: z.string().min(1),
});

export type StructuredClaim = z.infer<typeof structuredClaimSchema>;

export const structuredAnalysisSchema = z.object({
  format: z.string().optional(),
  claim_ir: z.array(z.unknown()).optional().default([]),
  stage1_markdown: z.string().default(""),
  stage2_markdown: z.string().default(""),
  observations: z.array(z.unknown()).optional().default([]),
  recommendations: z.array(z.unknown()).default([]),
  executive_points: z.array(z.unknown()).optional().default([]),
  stage4_markdown: z.string().default(""),
  metric_traceability: z.unknown().optional(),
});
