// Loads and evaluates the trained win-probability model (see ml/README.md
// for how win_probability_v1.json is produced). Kept separate from
// predictions.service.ts on purpose: this file has no Prisma/NestJS
// dependency, so the exact same inference math can be exercised from a
// standalone script for parity-checking against the Python training
// pipeline, without spinning up the whole API.
// Namespace imports, not default imports - apps/api's tsconfig.json has
// no esModuleInterop, and fs/path are plain CommonJS modules with no
// real default export. A default import silently resolves to undefined
// under Nest's webpack-based dev build (confirmed live: "Cannot read
// properties of undefined (reading 'join')") even though it type-checks
// fine and even runs fine under tsx, which uses a different, more
// forgiving module loader - exactly why this only surfaced once the
// actual API server was run, not from an isolated tsx script.
import * as fs from "fs";
import * as path from "path";

export interface NumericModelFeature {
  feature: string;
  mean: number;
  std: number;
  weight: number;
}

export interface CategoricalModelGroup {
  categories: string[];
  weights: Record<string, number>;
}

export interface PredictionModel {
  modelVersion: string;
  trainedAt: string;
  intercept: number;
  numeric: NumericModelFeature[];
  categorical: Record<string, CategoricalModelGroup>;
  missingIndicatorFeatures: string[];
  recentFormMinFights: number;
}

let cachedModel: PredictionModel | null = null;

export function loadPredictionModel(): PredictionModel {
  if (cachedModel) return cachedModel;
  const modelPath = path.join(__dirname, "model", "win_probability_v1.json");
  cachedModel = JSON.parse(fs.readFileSync(modelPath, "utf-8")) as PredictionModel;
  return cachedModel;
}

// The 14 base differential features this model was trained on. Every
// name here must exactly match a base column produced by
// ml/scripts/build_features.py - this is the contract between the
// Python training pipeline and this file, and there's no type system
// spanning both languages to catch a drift here automatically.
export const BASE_NUMERIC_FEATURES = [
  "elo_diff",
  "experience_diff",
  "win_rate_diff",
  "recent_form_diff",
  "strike_accuracy_diff",
  "takedown_accuracy_diff",
  "ko_rate_diff",
  "sub_rate_diff",
  "decision_rate_diff",
  "finish_rate_diff",
  "avg_fight_duration_diff",
  "height_diff_cm",
  "reach_diff_cm",
  "age_diff_years",
] as const;

export type BaseNumericFeature = (typeof BASE_NUMERIC_FEATURES)[number];

// null means "this diff is missing" (mirrors build_features.py's NaN),
// which only ever happens for the subset of features listed in
// missingIndicatorFeatures - every other feature always has a real
// default (see FighterModelInputs in predictions.service.ts) and can
// never be null here.
export type FeatureDiffs = Record<BaseNumericFeature, number | null>;

export interface MatchupResult {
  probabilityA: number;
  contributions: Record<string, number>; // per base feature, this fight's signed contribution to the logit
}

function standardize(value: number, mean: number, std: number): number {
  return std > 0 ? (value - mean) / std : 0;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function evaluateMatchup(
  diffs: FeatureDiffs,
  categoricalValues: Record<string, string>,
  model: PredictionModel,
): MatchupResult {
  let logit = model.intercept;
  const contributions: Record<string, number> = {};

  for (const nf of model.numeric) {
    const isMissingFlag = nf.feature.endsWith("_missing");
    const baseName = isMissingFlag ? nf.feature.slice(0, -"_missing".length) : nf.feature;
    const diffValue = diffs[baseName as BaseNumericFeature];

    const rawValue = isMissingFlag ? (diffValue === null ? 1 : 0) : diffValue ?? 0;
    const contribution = nf.weight * standardize(rawValue, nf.mean, nf.std);
    logit += contribution;

    // Only the base feature's own contribution is worth surfacing as an
    // "explanation" - its paired _missing flag is bookkeeping, not
    // something a user would recognize as a reason a fight was picked.
    if (!isMissingFlag) contributions[baseName] = contribution;
  }

  for (const [groupName, group] of Object.entries(model.categorical)) {
    const value = categoricalValues[groupName];
    // A category the model never saw in training (or none provided)
    // contributes nothing - same as how an unseen dummy column would be
    // all-zero on the training side (see build_feature_matrix's reindex).
    logit += group.weights[value] ?? 0;
  }

  return { probabilityA: sigmoid(logit), contributions };
}
