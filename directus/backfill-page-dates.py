"""Local SQLite migration: preserve actual historical times instead of today's date.

Run after directus:setup. Only fills null values, using Directus activity history.
SQL intentionally avoids an API update, which would itself create an edit event.
"""
import sqlite3
from pathlib import Path

database = Path(__file__).resolve().parent / "database" / "data.db"
connection = sqlite3.connect(database.as_uri() + "?mode=rw", uri=True, timeout=15)
try:
    with connection:
        connection.execute("BEGIN IMMEDIATE")
        cursor = connection.execute("""
            UPDATE pages SET
              created_at = COALESCE(created_at, (
                SELECT MIN(timestamp) FROM directus_activity
                WHERE collection = 'pages' AND item = pages.id AND action = 'create'
              )),
              updated_at = COALESCE(updated_at, (
                SELECT MAX(timestamp) FROM directus_activity
                WHERE collection = 'pages' AND item = pages.id AND action IN ('create', 'update')
              ))
            WHERE created_at IS NULL OR updated_at IS NULL
        """)
        missing = connection.execute(
            "SELECT COUNT(*) FROM pages WHERE created_at IS NULL OR updated_at IS NULL"
        ).fetchone()[0]
        print(f"Backfilled {cursor.rowcount} pages from activity history; {missing} pages still lack historical dates.")
finally:
    connection.close()
