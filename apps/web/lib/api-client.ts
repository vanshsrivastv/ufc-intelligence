import type {
  EventDetailDto,
  EventSummaryDto,
  FighterDetailDto,
  FighterSummaryDto,
  PaginatedResult,
  PredictionDto,
  RankingEntryDto,
  WeightClassDto,
} from "@ufc-intelligence/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

class ApiError extends Error {
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

export const api = {
  fighters: {
    list: (params?: { search?: string; weightClass?: string; page?: number }) => {
      const query = new URLSearchParams();
      if (params?.search) query.set("search", params.search);
      if (params?.weightClass) query.set("weightClass", params.weightClass);
      if (params?.page) query.set("page", String(params.page));
      const qs = query.toString();
      return request<PaginatedResult<FighterSummaryDto>>(
        `/fighters${qs ? `?${qs}` : ""}`,
      );
    },
    getBySlug: (slug: string) =>
      request<FighterDetailDto>(`/fighters/${slug}`),
  },
  events: {
    list: (params?: { status?: "UPCOMING" | "LIVE" | "COMPLETED"; page?: number }) => {
      const query = new URLSearchParams();
      if (params?.status) query.set("status", params.status);
      if (params?.page) query.set("page", String(params.page));
      const qs = query.toString();
      return request<PaginatedResult<EventSummaryDto>>(
        `/events${qs ? `?${qs}` : ""}`,
      );
    },
    getBySlug: (slug: string) => request<EventDetailDto>(`/events/${slug}`),
  },
  rankings: {
    listWeightClasses: () => request<WeightClassDto[]>("/rankings/weight-classes"),
    list: (weightClass: string) =>
      request<RankingEntryDto[]>(`/rankings?weightClass=${encodeURIComponent(weightClass)}`),
  },
  predictions: {
    getMatchup: (fighterA: string, fighterB: string) =>
      request<PredictionDto>(
        `/predictions/matchup?fighterA=${encodeURIComponent(fighterA)}&fighterB=${encodeURIComponent(fighterB)}`,
      ),
  },
};