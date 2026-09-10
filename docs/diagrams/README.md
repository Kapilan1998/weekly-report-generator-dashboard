# Diagrams

## ER diagram

| File | Use it for |
|---|---|
| `er-diagram.png` | The submission Drive folder, and slides. 2480×1660, white background. **Google Slides cannot import SVG**, so this is the one to insert there. |
| `er-diagram.svg` | Reading on screen and printing. Vector, so it stays sharp at any zoom. |
| `generate_er_diagram.py` | Regenerating both after a schema change. |

The same diagram also exists as a Mermaid block in [`../DATA_MODEL.md`](../DATA_MODEL.md),
which **GitHub renders inline** — that is the version a reviewer browsing the repo will see.

## Regenerating after a migration

The diagram is generated from a schema declared at the top of the script, rather than being
hand-drawn. That is deliberate: the Mermaid copy in `DATA_MODEL.md` had quietly drifted from
the migrations — it still said `planned_pct` after the column was renamed to
`planned_percent`, and it never gained the `enabled` column that `V3` added. Nothing tied it
back to the real schema, so nothing caught it.

It happened again with `V4`'s `token_version`, which is worth admitting: generating the SVG
from a declared list makes the three copies agree with *each other*, but nothing yet compares
that list against the migrations. Step 1 below is still a manual habit, not a check.

After adding or changing a column:

1. Update the `TABLES` list in `generate_er_diagram.py` (and `ENUMS`, if an enum changed).
2. Regenerate the SVG:

   ```bash
   python docs/diagrams/generate_er_diagram.py
   ```

3. Re-export the PNG. There is no headless converter in this repo, so the simplest route is
   to open `er-diagram.svg` in a browser and export at 2× — or, since the SVG is vector, take
   a screenshot of it displayed at 2480px wide.
4. Update the Mermaid block in `DATA_MODEL.md` to match.

Column names and types in all three must be exactly what the migrations under
`db/migration/` create — currently `V1` through `V4`. `ddl-auto=validate` means the entities already have to agree with the migrations, so
the migrations are the single source of truth for this diagram too.
