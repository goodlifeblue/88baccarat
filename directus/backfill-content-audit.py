"""Fill missing local article/redirect audit data from real activity history only."""
import sqlite3
from pathlib import Path

database = Path(__file__).resolve().parent / 'database' / 'data.db'
connection = sqlite3.connect(database.as_uri() + '?mode=rw', uri=True, timeout=15)
try:
    with connection:
        connection.execute('BEGIN IMMEDIATE')
        for table in ('articles', 'redirects'):
            # Table names are fixed above. Preserve all existing dates and editor values.
            cursor = connection.execute(f"""
                UPDATE {table} SET
                  created_at = COALESCE(created_at, (
                    SELECT MIN(timestamp) FROM directus_activity
                    WHERE collection = ? AND item = {table}.id AND action = 'create'
                  )),
                  updated_at = COALESCE(updated_at, (
                    SELECT MAX(timestamp) FROM directus_activity
                    WHERE collection = ? AND item = {table}.id AND action IN ('create','update')
                  )),
                  updated_by = COALESCE(updated_by, (
                    SELECT (SELECT id FROM directus_users WHERE id = a.user)
                    FROM directus_activity a
                    WHERE a.collection = ? AND a.item = {table}.id AND a.action IN ('create','update')
                    ORDER BY a.timestamp DESC, a.id DESC LIMIT 1
                  ))
                WHERE created_at IS NULL OR updated_at IS NULL OR updated_by IS NULL
            """, (table, table, table))
            missing = connection.execute(f'SELECT COUNT(*) FROM {table} WHERE created_at IS NULL OR updated_at IS NULL OR updated_by IS NULL').fetchone()[0]
            print(f'{table}: processed {cursor.rowcount} records; {missing} without complete historical evidence')
finally:
    connection.close()
