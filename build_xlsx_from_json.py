import json
from pathlib import Path
import pandas as pd

src = Path('data/torre_base.json')
out = Path('Torre de Expsansão.xlsx')

with src.open('r', encoding='utf-8') as f:
    rows = json.load(f)

df = pd.DataFrame(rows)
df.to_excel(out, index=False, engine='openpyxl')
print(f'Gerado: {out} com {len(df)} linha(s)')
