import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { ValidatedClaim, ValidatedRecommendation } from "@/lib/nex-intelligence/ai-output/types";

function renderApprovedMarkdown(approved: ValidatedRecommendation[]): string {
  void approved;
  throw new Error("legacy_publication_path_disabled");
}

export function renderClaimsMarkdown(claims: ValidatedClaim[], emptyLabel: string): string {
  void claims;
  void emptyLabel;
  throw new Error("legacy_publication_path_disabled");
}

function renderLimitations(
  quality: MetaDataQualityReport,
  rejected: ValidatedRecommendation[],
  needsReview: ValidatedRecommendation[],
  rejectedClaims: ValidatedClaim[],
  parseError?: string,
  narrativeNote?: string,
): string {
  void quality;
  void rejected;
  void needsReview;
  void rejectedClaims;
  void parseError;
  void narrativeNote;
  throw new Error("legacy_publication_path_disabled");
}

export function composeExecutiveFromApproved(
  approvedClaims: ValidatedClaim[],
  approvedRecs: ValidatedRecommendation[],
  sanitizedFallback: string,
): string {
  void approvedClaims;
  void approvedRecs;
  void sanitizedFallback;
  throw new Error("legacy_publication_path_disabled");
}

export function composePublishedMarkdown(input: {
  stage1: string;
  stage2: string;
  stage4: string;
  approved: ValidatedRecommendation[];
  rejected: ValidatedRecommendation[];
  needsReview: ValidatedRecommendation[];
  approvedObservations?: ValidatedClaim[];
  rejectedClaims?: ValidatedClaim[];
  quality: MetaDataQualityReport;
  parseError?: string;
  narrativeNote?: string;
}): string {
  void input;
  throw new Error("legacy_publication_path_disabled");
}
