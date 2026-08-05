"""Builds the point-in-time training table for the fight prediction model.

The core rule this file exists to enforce: every feature describing a
fighter must reflect only what was true *before* the fight being labeled -
never career totals that include it or anything after it. fighters.csv's
Wins/Losses/SLpM/etc. columns are career-to-date-as-of-now snapshots, not
point-in-time ones, so they are only used here for genuinely static
attributes (height, reach, date of birth, stance) that don't change with
fight outcomes. Every outcome-derived stat (win rate, strike accuracy,
finish-method breakdown, Elo, recent form) is instead computed by walking
fights.csv in chronological order and snapshotting each fighter's running
totals immediately before updating them with that fight's own result.

Output: one row per (fight, corner orientation) - each fight appears twice,
once as (A, B) and once as (B, A) with the label flipped, so the model
can't learn anything from which corner a fighter happened to be listed in.
"""
import re
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "packages" / "database" / "prisma" / "data"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "training_table.csv"

ELO_BASE = 1500.0
ELO_K = 32.0
# A finish should move a rating more than a decision - same principle as
# margin-of-victory adjustments in other sports' Elo systems (e.g.
# FiveThirtyEight's NFL/NBA Elo). Draws get no bonus either way.
ELO_FINISH_MULTIPLIER = 1.5

# Mirrors packages/database/prisma/scrape-upcoming.ts's WEIGHT_LIMITS keys,
# so a weight class means the same thing on both the training side and the
# live-serving side. fights.csv's Weight_Class column carries decades of
# UFC-specific noise on top of the plain class name (tournament and
# "Ultimate Fighter"/"Road to UFC" show bouts, "Title"/"Interim" suffixes),
# so this only pattern-matches the canonical class name inside the string
# rather than trying to parse the string's structure.
WEIGHT_CLASS_KEYWORDS = [
    "strawweight",
    "flyweight",
    "bantamweight",
    "featherweight",
    "lightweight",
    "welterweight",
    "middleweight",
    "light heavyweight",
    "heavyweight",
    "catch weight",
]


def normalize_weight_class(raw: str) -> str:
    lowered = raw.lower()
    # Order matters: "light heavyweight" must be checked before
    # "heavyweight", or "heavyweight" would match first as a substring.
    for keyword in ["light heavyweight"] + [k for k in WEIGHT_CLASS_KEYWORDS if k != "light heavyweight"]:
        if keyword in lowered:
            return keyword.replace(" ", "_")
    # Historical tournament/exhibition bouts and anything else that
    # doesn't name a class - closest honest label, matching the Node
    # scraper's own fallback for the same situation.
    return "open_weight"


def parse_height_cm(raw: str) -> float:
    match = re.match(r"(\d+)'\s*(\d+)\"", str(raw))
    if not match:
        return float("nan")
    feet, inches = int(match.group(1)), int(match.group(2))
    return round((feet * 12 + inches) * 2.54, 1)


def parse_reach_cm(raw: str) -> float:
    match = re.match(r"(\d+(?:\.\d+)?)\"", str(raw))
    if not match:
        return float("nan")
    return round(float(match.group(1)) * 2.54, 1)


def load_static_attributes(fighters_csv: Path) -> dict:
    df = pd.read_csv(fighters_csv)
    df["height_cm"] = df["Height"].apply(parse_height_cm)
    df["reach_cm"] = df["Reach"].apply(parse_reach_cm)
    df["dob"] = pd.to_datetime(df["DOB"], errors="coerce")
    attrs = {}
    for row in df.itertuples():
        attrs[row.Fighter_Name] = {
            "height_cm": row.height_cm,
            "reach_cm": row.reach_cm,
            "dob": row.dob,
            "stance": row.Stance if isinstance(row.Stance, str) else None,
        }
    return attrs


def new_fighter_state() -> dict:
    return {
        "elo": ELO_BASE,
        "fights": 0,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "ko_wins": 0,
        "sub_wins": 0,
        "decision_wins": 0,
        "sig_landed": 0,
        "sig_attempted": 0,
        "td_landed": 0,
        "td_attempted": 0,
        "total_fight_time_sec": 0,
        "last_5_results": [],  # 1 = win, 0 = loss/draw, most recent last
    }


def win_rate(state: dict) -> float:
    return state["wins"] / state["fights"] if state["fights"] > 0 else 0.5


def recent_form(state: dict) -> float:
    results = state["last_5_results"]
    return sum(results) / len(results) if results else 0.5


def strike_accuracy(state: dict) -> float:
    return state["sig_landed"] / state["sig_attempted"] if state["sig_attempted"] > 0 else float("nan")


def takedown_accuracy(state: dict) -> float:
    return state["td_landed"] / state["td_attempted"] if state["td_attempted"] > 0 else float("nan")


def ko_rate(state: dict) -> float:
    return state["ko_wins"] / state["wins"] if state["wins"] > 0 else 0.0


def sub_rate(state: dict) -> float:
    return state["sub_wins"] / state["wins"] if state["wins"] > 0 else 0.0


def decision_rate(state: dict) -> float:
    return state["decision_wins"] / state["wins"] if state["wins"] > 0 else 0.0


def finish_rate(state: dict) -> float:
    return (state["ko_wins"] + state["sub_wins"]) / state["wins"] if state["wins"] > 0 else 0.0


def avg_fight_duration(state: dict) -> float:
    return state["total_fight_time_sec"] / state["fights"] if state["fights"] > 0 else float("nan")


def snapshot(state: dict) -> dict:
    return {
        "elo": state["elo"],
        "fights": state["fights"],
        "win_rate": win_rate(state),
        "recent_form": recent_form(state),
        "strike_accuracy": strike_accuracy(state),
        "takedown_accuracy": takedown_accuracy(state),
        "ko_rate": ko_rate(state),
        "sub_rate": sub_rate(state),
        "decision_rate": decision_rate(state),
        "finish_rate": finish_rate(state),
        "avg_fight_duration_sec": avg_fight_duration(state),
    }


def method_bucket(method: str) -> str:
    if method in ("KO/TKO", "TKO - Doctor's Stoppage"):
        return "ko"
    if method == "Submission":
        return "sub"
    if method.startswith("Decision"):
        return "decision"
    return "other"  # DQ, No Contest, Overturned, Could Not Continue - no clean win-method bucket


def elo_expected(elo_a: float, elo_b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 400.0))


def update_elo(elo_a: float, elo_b: float, actual_a: float, is_finish: bool) -> tuple[float, float]:
    expected_a = elo_expected(elo_a, elo_b)
    k = ELO_K * (ELO_FINISH_MULTIPLIER if is_finish else 1.0)
    delta = k * (actual_a - expected_a)
    return elo_a + delta, elo_b - delta


def apply_result(state: dict, won: bool, drew: bool, method: str, sig_landed, sig_att, td_landed, td_att, fight_time):
    state["fights"] += 1
    if drew:
        state["draws"] += 1
    elif won:
        state["wins"] += 1
        bucket = method_bucket(method)
        if bucket == "ko":
            state["ko_wins"] += 1
        elif bucket == "sub":
            state["sub_wins"] += 1
        elif bucket == "decision":
            state["decision_wins"] += 1
    else:
        state["losses"] += 1

    state["last_5_results"].append(1 if won and not drew else 0)
    state["last_5_results"] = state["last_5_results"][-5:]

    state["sig_landed"] += sig_landed
    state["sig_attempted"] += sig_att
    state["td_landed"] += td_landed
    state["td_attempted"] += td_att
    state["total_fight_time_sec"] += fight_time


def age_years(dob, event_date) -> float:
    if pd.isna(dob) or pd.isna(event_date):
        return float("nan")
    return round((event_date - dob).days / 365.25, 2)


def stance_matchup(stance_a, stance_b) -> str:
    if not stance_a or not stance_b:
        return "unknown"
    ordered = sorted([stance_a.lower(), stance_b.lower()])
    return f"{ordered[0]}_vs_{ordered[1]}"


def build_row(focal, other, focal_snap, other_snap, focal_attrs, other_attrs, event_date, weight_class, label) -> dict:
    return {
        "event_date": event_date,
        "weight_class": weight_class,
        "focal_name": focal,
        "other_name": other,
        "elo_diff": focal_snap["elo"] - other_snap["elo"],
        "experience_diff": focal_snap["fights"] - other_snap["fights"],
        "win_rate_diff": focal_snap["win_rate"] - other_snap["win_rate"],
        "recent_form_diff": focal_snap["recent_form"] - other_snap["recent_form"],
        "strike_accuracy_diff": focal_snap["strike_accuracy"] - other_snap["strike_accuracy"],
        "takedown_accuracy_diff": focal_snap["takedown_accuracy"] - other_snap["takedown_accuracy"],
        "ko_rate_diff": focal_snap["ko_rate"] - other_snap["ko_rate"],
        "sub_rate_diff": focal_snap["sub_rate"] - other_snap["sub_rate"],
        "decision_rate_diff": focal_snap["decision_rate"] - other_snap["decision_rate"],
        "finish_rate_diff": focal_snap["finish_rate"] - other_snap["finish_rate"],
        "avg_fight_duration_diff": focal_snap["avg_fight_duration_sec"] - other_snap["avg_fight_duration_sec"],
        "height_diff_cm": focal_attrs["height_cm"] - other_attrs["height_cm"],
        "reach_diff_cm": focal_attrs["reach_cm"] - other_attrs["reach_cm"],
        "age_diff_years": age_years(focal_attrs["dob"], event_date) - age_years(other_attrs["dob"], event_date),
        "stance_matchup": stance_matchup(focal_attrs["stance"], other_attrs["stance"]),
        "label": label,
    }


def main():
    static_attrs = load_static_attributes(DATA_DIR / "fighters.csv")
    fights = pd.read_csv(DATA_DIR / "fights.csv")
    fights["Event_Date"] = pd.to_datetime(fights["Event_Date"], errors="coerce")
    fights = fights.sort_values("Event_Date").reset_index(drop=True)

    states: dict[str, dict] = {}
    rows: list[dict] = []
    skipped_unknown_fighter = 0

    empty_attrs = {"height_cm": float("nan"), "reach_cm": float("nan"), "dob": pd.NaT, "stance": None}

    for fight in fights.itertuples():
        f1, f2 = fight.Fighter_1, fight.Fighter_2
        if f1 not in states:
            states[f1] = new_fighter_state()
        if f2 not in states:
            states[f2] = new_fighter_state()
        attrs_f1 = static_attrs.get(f1, empty_attrs)
        attrs_f2 = static_attrs.get(f2, empty_attrs)
        if f1 not in static_attrs or f2 not in static_attrs:
            skipped_unknown_fighter += 1  # still usable for career stats, just missing physical diffs

        is_draw_or_nc = fight.Winner == "Draw/NC"
        f1_won = (not is_draw_or_nc) and fight.Winner == f1
        f2_won = (not is_draw_or_nc) and fight.Winner == f2

        weight_class = normalize_weight_class(fight.Weight_Class)
        snap_f1 = snapshot(states[f1])
        snap_f2 = snapshot(states[f2])

        # Draws/no-contests update running state (they're real fight
        # history) but never become labeled training rows - there's no
        # sensible binary "who won" label for either.
        if not is_draw_or_nc:
            rows.append(
                build_row(f1, f2, snap_f1, snap_f2, attrs_f1, attrs_f2, fight.Event_Date, weight_class, label=1 if f1_won else 0)
            )
            rows.append(
                build_row(f2, f1, snap_f2, snap_f1, attrs_f2, attrs_f1, fight.Event_Date, weight_class, label=1 if f2_won else 0)
            )

        is_finish = method_bucket(fight.Method) in ("ko", "sub")
        actual_f1 = 0.5 if is_draw_or_nc else (1.0 if f1_won else 0.0)
        new_elo_f1, new_elo_f2 = update_elo(states[f1]["elo"], states[f2]["elo"], actual_f1, is_finish)
        states[f1]["elo"], states[f2]["elo"] = new_elo_f1, new_elo_f2

        apply_result(
            states[f1], won=f1_won, drew=is_draw_or_nc, method=fight.Method,
            sig_landed=fight.F1_Sig_Landed, sig_att=fight.F1_Sig_Att,
            td_landed=fight.F1_TD_Landed, td_att=fight.F1_TD_Att,
            fight_time=fight.Total_Fight_Time_Sec,
        )
        apply_result(
            states[f2], won=f2_won, drew=is_draw_or_nc, method=fight.Method,
            sig_landed=fight.F2_Sig_Landed, sig_att=fight.F2_Sig_Att,
            td_landed=fight.F2_TD_Landed, td_att=fight.F2_TD_Att,
            fight_time=fight.Total_Fight_Time_Sec,
        )

    table = pd.DataFrame(rows)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(OUTPUT_PATH, index=False)

    print(f"Processed {len(fights)} fights -> {len(table)} training rows (2 per non-draw/NC fight).")
    print(f"Excluded as draw/no-contest: {(fights['Winner'] == 'Draw/NC').sum()} fight(s).")
    print(f"Fights with at least one fighter missing physical attributes: {skipped_unknown_fighter}")
    print(f"Label balance: {table['label'].mean():.3f} (should be ~0.5 - it's exactly 0.5 by construction of the A/B duplication)")
    print(f"Date range: {table['event_date'].min()} to {table['event_date'].max()}")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
