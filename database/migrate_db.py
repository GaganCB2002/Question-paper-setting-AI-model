import sqlite3

import os
DB = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'data', 'kke.db')
conn = sqlite3.connect(DB)
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cur.fetchall()]

print("=== Current schema ===")
for t in tables:
    cur.execute(f'PRAGMA table_info({t})')
    cols = [(c[1], c[2]) for c in cur.fetchall()]
    print(f'  {t}: {", ".join(c[0] for c in cols)}')

# Check and fix missing columns
migrations = [
    ("uploaded_files", "folder_id", "CHAR(32) REFERENCES folders(id)"),
    ("uploaded_files", "is_deleted", "BOOLEAN DEFAULT 0"),
    ("uploaded_files", "deleted_at", "DATETIME"),
    ("uploaded_files", "deleted_by", "VARCHAR(255)"),
]

for table, col, col_type in migrations:
    cur.execute(f'PRAGMA table_info({table})')
    existing = [c[1] for c in cur.fetchall()]
    if col not in existing:
        print(f'\nAdding column {col} to {table}...')
        cur.execute(f'ALTER TABLE {table} ADD COLUMN {col} {col_type}')
        print(f'  OK')

conn.commit()
conn.close()
print('\nMigration complete!')
