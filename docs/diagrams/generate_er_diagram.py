# -*- coding: utf-8 -*-
"""Generates er-diagram.svg from the schema declared below.

Kept as a script rather than hand-edited XML so the image can be regenerated when a
migration adds a column. The Mermaid copy in ../DATA_MODEL.md had silently drifted from the
migrations (renamed percent columns, a missing V3 column) precisely because nothing tied it
back to the schema.

Run:  python docs/diagrams/generate_er_diagram.py
"""
import io
import os

WIDTH, HEIGHT = 1240, 940
ROW, HEAD, PAD = 17, 30, 9

# (x, y, width, [(column, type, key)]) — types are exactly what V1/V2/V3 create.
TABLES = [
    ('users', 40, 40, 300, [
        ('id', 'BIGINT', 'PK'), ('name', 'VARCHAR(255)', ''),
        ('email', 'VARCHAR(255)', 'UK'), ('password_hash', 'VARCHAR(255)', ''),
        ('role', 'VARCHAR(20)', ''), ('enabled', 'BIT(1)', ''),
        ('created_at', 'DATETIME', ''),
    ]),
    ('review_comments', 40, 300, 300, [
        ('id', 'BIGINT', 'PK'), ('report_version_id', 'BIGINT', 'FK'),
        ('reviewer_id', 'BIGINT', 'FK'), ('action', 'VARCHAR(20)', ''),
        ('comment', 'VARCHAR(2000)', ''), ('created_at', 'DATETIME(6)', ''),
    ]),
    ('projects', 40, 560, 300, [
        ('id', 'BIGINT', 'PK'), ('name', 'VARCHAR(120)', 'UK'),
        ('description', 'VARCHAR(500)', ''), ('active', 'BIT(1)', ''),
        ('created_at', 'DATETIME(6)', ''),
    ]),
    ('reports', 440, 60, 330, [
        ('id', 'BIGINT', 'PK'), ('user_id', 'BIGINT', 'FK UK'),
        ('project_id', 'BIGINT', 'FK'), ('week_start', 'DATE', 'UK'),
        ('week_end', 'DATE', ''), ('status', 'VARCHAR(20)', ''),
        ('last_submitted_at', 'DATETIME(6)', ''), ('created_at', 'DATETIME(6)', ''),
        ('updated_at', 'DATETIME(6)', ''),
    ]),
    ('report_versions', 440, 380, 330, [
        ('id', 'BIGINT', 'PK'), ('report_id', 'BIGINT', 'FK UK'),
        ('version_number', 'INT', 'UK'), ('tasks_planned_next_week', 'VARCHAR(4000)', ''),
        ('notes', 'VARCHAR(4000)', ''), ('links', 'VARCHAR(1000)', ''),
        ('submitted_at', 'DATETIME(6)', ''), ('created_at', 'DATETIME(6)', ''),
        ('updated_at', 'DATETIME(6)', ''),
    ]),
    ('task_entries', 870, 40, 330, [
        ('id', 'BIGINT', 'PK'), ('report_version_id', 'BIGINT', 'FK'),
        ('display_order', 'INT', ''), ('task_name', 'VARCHAR(255)', ''),
        ('priority', 'VARCHAR(20)', ''), ('status', 'VARCHAR(20)', ''),
        ('planned_percent', 'INT', ''), ('actual_percent', 'INT', ''),
        ('time_planned_hours', 'DECIMAL(5,2)', ''), ('time_spent_hours', 'DECIMAL(5,2)', ''),
        ('output_deliverable', 'VARCHAR(500)', ''),
    ]),
    ('blockers', 870, 320, 330, [
        ('id', 'BIGINT', 'PK'), ('report_version_id', 'BIGINT', 'FK'),
        ('display_order', 'INT', ''), ('description', 'VARCHAR(1000)', ''),
        ('key_issue', 'BIT(1)', ''),
    ]),
    ('achievements', 870, 480, 330, [
        ('id', 'BIGINT', 'PK'), ('report_version_id', 'BIGINT', 'FK'),
        ('display_order', 'INT', ''), ('description', 'VARCHAR(1000)', ''),
        ('key_achievement', 'BIT(1)', ''),
    ]),
    ('hours_entries', 870, 640, 330, [
        ('id', 'BIGINT', 'PK'), ('report_version_id', 'BIGINT', 'FK'),
        ('task_type', 'VARCHAR(20)', ''), ('hours', 'DECIMAL(5,2)', ''),
    ]),
]

ENUMS = [
    ('users.role', 'TEAM_MEMBER | MANAGER'),
    ('reports.status', 'DRAFT | SUBMITTED | NEEDS_CORRECTION | APPROVED'),
    ('task_entries.priority', 'LOW | MEDIUM | HIGH'),
    ('task_entries.status', 'NOT_STARTED | IN_PROGRESS | DONE | BLOCKED'),
    ('hours_entries.task_type', 'DEVELOPMENT | TESTING | MEETINGS | DOCUMENTATION | OTHER'),
    ('review_comments.action', 'APPROVE | REQUEST_CHANGES'),
]

KEY_COLOURS = {'PK': '#4f46e5', 'FK': '#0891b2', 'UK': '#b45309'}

BOX = {name: (x, y, w, HEAD + len(cols) * ROW + PAD) for name, x, y, w, cols in TABLES}
COLUMNS = {name: cols for name, _x, _y, _w, cols in TABLES}


def esc(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


svg = []
svg.append('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d"'
           ' font-family="Segoe UI, Helvetica, Arial, sans-serif">' % (WIDTH, HEIGHT, WIDTH, HEIGHT))
svg.append('<defs>')
svg.append('<marker id="one" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8"'
           ' markerHeight="8" orient="auto-start-reverse" markerUnits="strokeWidth">'
           '<path d="M5,1 L5,9" stroke="#64748b" stroke-width="1.6" fill="none"/></marker>')
svg.append('<marker id="many" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10"'
           ' markerHeight="10" orient="auto-start-reverse" markerUnits="strokeWidth">'
           '<path d="M1,1 L9,5 L1,9" stroke="#64748b" stroke-width="1.6" fill="none"/></marker>')
svg.append('</defs>')
svg.append('<rect width="%d" height="%d" fill="#ffffff"/>' % (WIDTH, HEIGHT))
svg.append('<text x="40" y="27" font-size="17" font-weight="700" fill="#0f172a">'
           'Weekly Report Generator &amp; Team Dashboard — entity relationship diagram</text>')


def relation(points, label, label_xy, anchor='middle'):
    """One-to-many: a bar at the 'one' end, a crow's foot at the 'many' end."""
    path = ' '.join('%s%g,%g' % ('M' if i == 0 else 'L', p[0], p[1]) for i, p in enumerate(points))
    svg.append('<path d="%s" fill="none" stroke="#94a3b8" stroke-width="1.6"'
               ' marker-start="url(#one)" marker-end="url(#many)"/>' % path)
    svg.append('<text x="%g" y="%g" font-size="11.5" fill="#475569" text-anchor="%s">%s</text>'
               % (label_xy[0], label_xy[1], anchor, esc(label)))


ux, uy, uw, uh = BOX['users']
rx, ry, rw, rh = BOX['reports']
vx, vy, vw, vh = BOX['report_versions']
px, py, pw, ph = BOX['projects']
cx, cy, cw, ch = BOX['review_comments']

# users 1--* reports
relation([(ux + uw, uy + 55), (rx, ry + 45)], 'owns', (392, 82))
# projects 1--* reports, routed up the corridor between the two columns
relation([(px + pw, py + 40), (400, py + 40), (400, ry + rh - 38), (rx, ry + rh - 38)],
         'tagged on', (406, 316), 'start')
# reports 1--* report_versions
relation([(rx + rw / 2.0, ry + rh), (rx + rw / 2.0, vy)], 'has versions',
         (rx + rw / 2.0 + 10, vy - 14), 'start')
# users 1--* review_comments (the reviewer)
relation([(ux + 66, uy + uh), (ux + 66, cy)], 'reviews', (ux + 76, cy - 14), 'start')
# report_versions 1--* review_comments
relation([(vx, vy + 42), (408, vy + 42), (408, cy + 48), (cx + cw, cy + 48)],
         'made against', (372, cy + 92), 'middle')

# report_versions 1--* the four child tables, over one shared bus
BUS = 822
anchors = []
for child in ('task_entries', 'blockers', 'achievements', 'hours_entries'):
    kx, ky, _kw, _kh = BOX[child]
    anchors.append(ky + 40)
    svg.append('<path d="M%d,%d L%d,%d" fill="none" stroke="#94a3b8" stroke-width="1.6"'
               ' marker-end="url(#many)"/>' % (BUS, ky + 40, kx, ky + 40))
svg.append('<path d="M%d,%d L%d,%d" fill="none" stroke="#94a3b8" stroke-width="1.6"/>'
           % (BUS, min(anchors), BUS, max(anchors)))
svg.append('<path d="M%d,%d L%d,%d" fill="none" stroke="#94a3b8" stroke-width="1.6"'
           ' marker-start="url(#one)"/>' % (vx + vw, vy + 58, BUS, vy + 58))
svg.append('<text x="0" y="0" font-size="11.5" fill="#475569" text-anchor="middle"'
           ' transform="translate(%d,%d) rotate(-90)">contains</text>'
           % (BUS - 9, (min(anchors) + max(anchors)) / 2.0))

# ---- the tables themselves, drawn over the lines ----
for name, _x, _y, _w, _cols in TABLES:
    x, y, w, h = BOX[name]
    svg.append('<rect x="%d" y="%d" width="%d" height="%d" rx="8" fill="#ffffff"'
               ' stroke="#cbd5e1" stroke-width="1.3"/>' % (x, y, w, h))
    # Header band: a rounded top via a clip-free path, so no extra defs are needed.
    svg.append('<path d="M%d,%d a8,8 0 0 1 8,-8 h%d a8,8 0 0 1 8,8 v%d h-%d z"'
               ' fill="#4f46e5"/>' % (x, y + 8, w - 16, HEAD - 8, w))
    svg.append('<text x="%d" y="%d" font-size="13" font-weight="700" fill="#ffffff">%s</text>'
               % (x + 12, y + 20, name))

    for index, (column, coltype, key) in enumerate(COLUMNS[name]):
        ty = y + HEAD + 13 + index * ROW
        if index % 2 == 1:
            svg.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#f8fafc"/>'
                       % (x + 1, ty - 12, w - 2, ROW))
        keys = key.split()
        weight = '600' if keys else '400'
        svg.append('<text x="%d" y="%d" font-size="11.5" font-weight="%s" fill="#1e293b"'
                   ' font-family="Consolas, Menlo, monospace">%s</text>'
                   % (x + 12, ty, weight, column))
        svg.append('<text x="%d" y="%d" font-size="10.5" fill="#64748b" text-anchor="end"'
                   ' font-family="Consolas, Menlo, monospace">%s</text>'
                   % (x + w - 52, ty, coltype))
        offset = 0
        for tag in reversed(keys):
            svg.append('<text x="%d" y="%d" font-size="9.5" font-weight="700" fill="%s"'
                       ' text-anchor="end">%s</text>'
                       % (x + w - 10 - offset, ty, KEY_COLOURS[tag], tag))
            offset += 24

# ---- enum values, on a full-width row below every table ----
ex, ey = 40, 764
svg.append('<text x="%d" y="%d" font-size="11.5" font-weight="700" fill="#0f172a">'
           'Enum columns (stored as VARCHAR(20), validated by the application)</text>' % (ex, ey))
for index, (column, values) in enumerate(ENUMS):
    line = ey + 19 + index * 15
    svg.append('<text x="%d" y="%d" font-size="10.5" fill="#1e293b"'
               ' font-family="Consolas, Menlo, monospace">%s</text>' % (ex, line, column))
    svg.append('<text x="%d" y="%d" font-size="10.5" fill="#64748b">%s</text>'
               % (ex + 190, line, esc(values)))

# ---- legend and the two notes worth carrying on the image ----
ly = 884
svg.append('<text x="40" y="%d" font-size="11.5" font-weight="700" fill="#0f172a">Keys</text>' % ly)
for index, (tag, meaning) in enumerate([('PK', 'primary key'), ('FK', 'foreign key'),
                                        ('UK', 'part of a unique constraint')]):
    svg.append('<text x="%d" y="%d" font-size="10.5" font-weight="700" fill="%s">%s</text>'
               % (88 + index * 190, ly, KEY_COLOURS[tag], tag))
    svg.append('<text x="%d" y="%d" font-size="10.5" fill="#475569">%s</text>'
               % (112 + index * 190, ly, meaning))
svg.append('<text x="40" y="%d" font-size="10.5" fill="#475569">'
           'Unique constraints: (user_id, week_start) on reports — one report per user per'
           ' week &#183; (report_id, version_number) on report_versions</text>' % (ly + 18))
svg.append('<text x="40" y="%d" font-size="10.5" fill="#475569">'
           'reports has no current_version_id column: the current version is the highest'
           ' version_number, which avoids a circular foreign key with report_versions</text>'
           % (ly + 34))

svg.append('</svg>')

target = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'er-diagram.svg')
io.open(target, 'w', encoding='utf-8', newline='\n').write('\n'.join(svg) + '\n')
print('wrote %s' % target)
