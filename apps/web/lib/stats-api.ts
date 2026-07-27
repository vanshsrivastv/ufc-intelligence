const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
  accuracyPct?: number;
}

export interface Leaderboards {
  mostWins: LeaderboardEntry[];
  mostFinishes: LeaderboardEntry[];
  mostKOWins: LeaderboardEntry[];
  mostSubmissionWins: LeaderboardEntry[];
  longestWinStreak: LeaderboardEntry[];
  mostTitleFights: LeaderboardEntry[];
  bestStrikeAccuracy: LeaderboardEntry[];
  methodBreakdown: { koTko: number; submission: number; decision: number; total: number };
}

export const statsApi = {
  getOverview: async (): Promise<StatsOverview> => {
    const res = await fetch(`${API_URL}/stats/overview`);
    return res.json();
  },
  getChampions: async (): Promise<ChampionSummary[]> => {
    const res = await fetch(`${API_URL}/stats/champions`);
    return res.json();
  },
  getLeaderboards: async (): Promise<Leaderboards> => {
    const res = await fetch(`${API_URL}/stats/leaderboards`);
    return res.json();
  },
};