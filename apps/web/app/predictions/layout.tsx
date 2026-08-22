import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UFC Fight Predictor — Win Probability Between Any Two Fighters",
  description:
    "Pick any two UFC fighters and see an explainable win-probability prediction based on Elo, physical stats, and fight history.",
};

export default function PredictionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
