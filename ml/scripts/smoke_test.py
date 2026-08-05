"""Verifies the ml/ environment can load the project's actual fight data."""
import pandas as pd
import sklearn
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "packages" / "database" / "prisma" / "data"

fighters = pd.read_csv(DATA_DIR / "fighters.csv")
fights = pd.read_csv(DATA_DIR / "fights.csv")

print(f"pandas {pd.__version__}, scikit-learn {sklearn.__version__}")
print(f"fighters.csv: {len(fighters)} rows, columns: {list(fighters.columns)}")
print(f"fights.csv: {len(fights)} rows, columns: {list(fights.columns)}")
print(f"fights date range: {fights['Event_Date'].min()} to {fights['Event_Date'].max()}")
