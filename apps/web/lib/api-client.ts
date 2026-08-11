import type {
  EventDetailDto,
  EventSummaryDto,
  FighterDetailDto,
  FighterSummaryDto,
  FightDetailDto,
  PaginatedResult,
  PredictionDto,
  RankingEntryDto,
  WeightClassDto,
} from "@ufc-intelligence/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export interface StatsOverview {
  fighters: number;
  fights: number;
  events: number;
  weightClasses: number;
}

export interface ChampionSummary {
  fighterId: string;
  slug: string;
  name: string;
  photoUrl: string | null;
  weightClass: string;
  record: string;
}

export interface LeaderboardEntry {
  id: string;
  slug: string;
  name: string;
  wins?: number;
  finishes?: number;
  kos?: number;
  submissions?: number;
  streak?: number;
  titleFights?: number;
  elo?: number;
  accuracyPct?: number;
  age?: number;
  fights?: number;
}

export interface Leaderboards {
  mostWins: LeaderboardEntry[];
  mostFinishes: LeaderboardEntry[];
  mostKOWins: LeaderboardEntry[];
  mostSubmissionWins: LeaderboardEntry[];
  longestWinStreak: LeaderboardEntry[];
  mostTitleFights: LeaderboardEntry[];
  bestStrikeAccuracy: LeaderboardEntry[];
  youngestChampions: LeaderboardEntry[];
  oldestChampions: LeaderboardEntry[];
  mostActiveFighters: LeaderboardEntry[];
  methodBreakdown: { koTko: number; submission: number; decision: number; total: number };
}

export interface UpcomingEventSummary {
  id: string;
  slug: string;
  name: string;
  date: string;
  venue: string | null;
  city: string | null;
}

export interface HeadlinerFighter {
  slug: string;
  name: string;
  photoUrl: string | null;
}

export interface Headliner {
  fightId: string;
  eventName: string;
  eventDate: string;
  isTitleFight: boolean;
  weightClass: string | null;
  fighterA: HeadlinerFighter;
  fighterB: HeadlinerFighter;
}

export interface TrendingFighter {
  slug: string;
  name: string;
  photoUrl: string | null;
  weightClass: string;
  rank: number;
  lastFightDate: string;
}

export interface DashboardData {
  upcomingEvents: UpcomingEventSummary[];
  headliner: Headliner | null;
  trendingFighters: TrendingFighter[];
}

export interface EloDivisionLeader {
  id: string;
  slug: string;
  name: string;
  elo: number;
  weightClass: string;
}

export interface EloDistributionBucket {
  bucketStart: number;
  bucketLabel: string;
  count: number;
}

export interface EloStats {
  // Fighters with a computed rating - never all 4,520, see
  // Fighter.eloRating's schema comment.
  count: number;
  average: number | null;
  median: number | null;
  leaderboard: LeaderboardEntry[];
  distribution: EloDistributionBucket[];
  topByDivision: EloDivisionLeader[];
}

export const api = {
  fighters: {
    list: (params?: {
      search?: string;
      weightClass?: string;
      gender?: "men" | "women";
      activity?: "active" | "inactive";
      championOnly?: boolean;
      documentedOnly?: boolean;
      sort?: "documented_first" | "name_asc" | "recent" | "oldest" | "elo_desc" | "elo_asc";
      page?: number;
      pageSize?: number;
    }) => {
      const query = new URLSearchParams();
      if (params?.search) query.set("search", params.search);
      if (params?.weightClass) query.set("weightClass", params.weightClass);
      if (params?.gender) query.set("gender", params.gender);
      if (params?.activity) query.set("activity", params.activity);
      if (params?.championOnly) query.set("championOnly", "true");
      if (params?.documentedOnly) query.set("documentedOnly", "true");
      if (params?.sort) query.set("sort", params.sort);
      if (params?.page) query.set("page", String(params.page));
      if (params?.pageSize) query.set("pageSize", String(params.pageSize));
      const qs = query.toString();
      return request<PaginatedResult<FighterSummaryDto>>(
        `/fighters${qs ? `?${qs}` : ""}`,
      );
    },
    getBySlug: (slug: string) =>
      request<FighterDetailDto>(`/fighters/${slug}`),
  },
  events: {
    list: (params?: {
      status?: "UPCOMING" | "LIVE" | "COMPLETED";
      search?: string;
      sort?: "date_asc" | "date_desc" | "recent";
      page?: number;
    }) => {
      const query = new URLSearchParams();
      if (params?.status) query.set("status", params.status);
      if (params?.search) query.set("search", params.search);
      if (params?.sort) query.set("sort", params.sort);
      if (params?.page) query.set("page", String(params.page));
      const qs = query.toString();
      return request<PaginatedResult<EventSummaryDto>>(
        `/events${qs ? `?${qs}` : ""}`,
      );
    },
    getBySlug: (slug: string) => request<EventDetailDto>(`/events/${slug}`),
  },
  fights: {
    getById: (id: string) => request<FightDetailDto>(`/fights/${id}`),
  },
  rankings: {
    listWeightClasses: () => request<WeightClassDto[]>("/rankings/weight-classes"),
    list: (weightClass: string) =>
      request<RankingEntryDto[]>(`/rankings?weightClass=${encodeURIComponent(weightClass)}`),
    listByElo: (weightClass: string) =>
      request<RankingEntryDto[]>(`/rankings/elo?weightClass=${encodeURIComponent(weightClass)}`),
  },
  predictions: {
    getMatchup: (fighterA: string, fighterB: string) =>
      request<PredictionDto>(
        `/predictions/matchup?fighterA=${encodeURIComponent(fighterA)}&fighterB=${encodeURIComponent(fighterB)}`,
      ),
  },
  stats: {
    getOverview: () => request<StatsOverview>("/stats/overview"),
    getChampions: () => request<ChampionSummary[]>("/stats/champions"),
    getLeaderboards: () => request<Leaderboards>("/stats/leaderboards"),
    getDashboard: () => request<DashboardData>("/stats/dashboard"),
    getEloStats: () => request<EloStats>("/stats/elo"),
  },
};