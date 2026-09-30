"""Backfill local page editors from actual Directus activity without changing dates."""
import sqlite3
from pathlib import Path

database = Path(__file__).resolve().parent / "database" / "data.db"
connection = sqlite3.connect(database.as_uri() + "?mode=rw", uri=True, timeout=15)
try:
    with connection:
        connection.execute("BEGIN IMMEDIATE")
        cursor = connection.execute("""
            UPDATE pages SET updated_by = (
                SELECT (SELECT id FROM directus_users WHERE id = activity.user)
                FROM directus_activity AS activity
                WHERE activity.collection = 'pages' AND activity.item = pages.id
                  AND activity.action IN ('create', 'update')
                ORDER BY activity.timestamp DESC, activity.id DESC LIMIT 1
            ) WHERE updated_by IS NULL
        """)
        missing = connection.execute("SELECT COUNT(*) FROM pages WHERE updated_by IS NULL").fetchone()[0]
        print(f"Backfilled {cursor.rowcount} pages; {missing} pages have no identifiable editor.")
finally:
    connection.close()
