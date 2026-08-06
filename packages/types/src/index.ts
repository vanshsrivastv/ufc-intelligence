// Shared contract types between apps/web and apps/api.
// These are the DTO shapes returned over the wire — deliberately NOT the
// same as the Prisma models, so the frontend never depends on backend
// internals and the API is free to reshape its persistence layer without
// breaking consumers.

export interface WeightClassDto {
  id: string;
  name: string;
  weightLimitLbs: number;
  isWomens: boolean;
}

export interface FighterSummaryDto {
  id: string;
  slug: string;
  name: string;
  nickname: string | null;
  record: FighterRecord;
  weightClass: WeightClassDto | null;
  photoUrl: string | null;
  // Required attribution when photoUrl is sourced from Wikimedia Commons
  // (see prisma/fetch-wikipedia-photos.ts) - null when there's no photo
  // or it came from elsewhere.
  photoCredit: string | null;
  photoLicense: string | null;
  photoLicenseUrl: string | null;
  rank: number | null; // null = unranked
}

export interface FighterRecord {
  wins: number;
  losses: number;
  draws: number;
  noContests: number;
}

export interface FighterDetailDto extends FighterSummaryDto {
  dob: string | null;
  nationality: string | null;
  heightCm: number | null;
  reachCm: number | null;
  gym: string | null;
  coach: string | null;
  careerStats: FighterCareerStats;
  // Completed fights only, most recent first - never a SCHEDULED bout
  // (see upcomingFight for that).
  recentFights: FightSummaryDto[];
  upcomingFight: FightSummaryDto | null;
}

export interface FighterCareerStats {
  // null = not enough recorded data to compute this rate, rather than a
  // real zero — the frontend should render these as "—", not "0".
  sigStrikesLandedPerMin: number | null;
  sigStrikeAccuracyPct: number | null;
  takedownAvgPer15Min: number | null;
  takedownAccuracyPct: number | null;
  takedownDefensePct: number | null;
  submissionAvgPer15Min: number | null;
  koTkoWins: number;
  submissionWins: number;
  decisionWins: number;
}

export type FightMethod =
  | "KO"
  | "TKO"
  | "SUBMISSION"
  | "DECISION_UNANIMOUS"
  | "DECISION_SPLIT"
  | "DECISION_MAJORITY"
  | "DQ"
  | "NO_CONTEST"
  | "PENDING";

export type FightStatus = "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED";
export type EventStatus = "UPCOMING" | "LIVE" | "COMPLETED";

export interface FightSummaryDto {
  id: string;
  event: { slug: string; name: string; date: string };
  fighterA: FighterSummaryDto;
  fighterB: FighterSummaryDto;
  weightClass: WeightClassDto | null;
  isTitleFight: boolean;
  cardPosition: number;
  status: FightStatus;
  method: FightMethod;
  round: number | null;
  time: string | null;
  winnerId: string | null;
}

export interface EventSummaryDto {
  id: string;
  slug: string;
  name: string;
  date: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  status: EventStatus;
}

export interface EventDetailDto extends EventSummaryDto {
  fights: FightSummaryDto[];
}

export interface PreviousMeetingDto {
  id: string;
  eventName: string;
  date: string;
  method: FightMethod;
  winnerId: string | null;
}

export interface FightDetailDto {
  id: string;
  event: { slug: string; name: string; date: string };
  weightClass: WeightClassDto | null;
  isTitleFight: boolean;
  status: FightStatus;
  method: FightMethod;
  round: number | null;
  time: string | null;
  fighterA: FighterSummaryDto;
  fighterB: FighterSummaryDto;
  winnerId: string | null;
  stats: FightStatRoundDto[];
  previousMeetings: PreviousMeetingDto[];
  // Age and record as they actually stood on the day of THIS fight, not
  // today's values - a fighter's current age and career-total record
  // are the wrong numbers next to a fight that may have happened
  // decades ago. See FighterDetailDto for the always-current equivalent
  // (correct on the Compare page, where "right now" is the point).
  fighterAAtFightTime: FighterAtFightTimeDto;
  fighterBAtFightTime: FighterAtFightTimeDto;
}

export interface FighterAtFightTimeDto {
  age: number | null; // null if dob unknown
  record: FighterRecord; // entering this fight - does not include this fight's own result
  koTkoWins: number;
  submissionWins: number;
}

export interface RankingEntryDto {
  rank: number; // 0 = champion
  fighter: FighterSummaryDto;
  effectiveDate: string;
  // Derived from fight recency relative to the dataset's own most recent
  // event (not wall-clock time) — see RankingsService.computeActivityStatus.
  status: "active" | "inactive";
}

export interface FightStatRoundDto {
  round: number; // 0 = fight totals
  fighterId: string;
  sigStrikesLanded: number;
  sigStrikesAttempted: number;
  takedownsLanded: number;
  takedownsAttempted: number;
  controlTimeSeconds: number;
  knockdowns: number;
  submissionAttempts: number;
}

export interface PredictionFactor {
  factor: string; // e.g. "takedown_defense"
  favors: "A" | "B";
  weight: number; // 0-1, relative contribution
  explanation: string; // plain-language, e.g. "Fighter A's takedown defense is significantly higher"
}

export interface PredictionDto {
  fightId: string;
  modelVersion: string;
  winnerProbabilityA: number;
  winnerProbabilityB: number;
  koProbability: number;
  subProbability: number;
  decisionProbability: number;
  confidenceScore: number;
  topFactors: PredictionFactor[];
  generatedAt: string;
}

// Paginated list envelope used across all list endpoints
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
