# Railway deployment

This deployment intentionally keeps Directus on SQLite. The existing article
redirect hook creates a SQLite transaction trigger, so moving it to PostgreSQL
without rewriting that hook would disable a production safeguard.

## Directus service

- Dockerfile: `deploy/railway/Dockerfile.directus`
- Railway Volume mount: `/directus/data`
- Database: `/directus/data/database/data.db`
- Uploads: `/directus/data/uploads`

Required Railway variables:

```text
HOST=0.0.0.0
DB_CLIENT=sqlite3
DB_FILENAME=/directus/data/database/data.db
STORAGE_LOCATIONS=local
STORAGE_LOCAL_DRIVER=local
STORAGE_LOCAL_ROOT=/directus/data/uploads
SECRET=<new production secret>
ADMIN_EMAIL=<administrator email>
ADMIN_PASSWORD=<new production password>
PUBLIC_URL=https://<the Railway Directus domain>
REFRESH_TOKEN_COOKIE_NAME=baccarat88_refresh_token
SESSION_COOKIE_NAME=baccarat88_session_token
```

Before replacing the local CMS, copy both local folders into the mounted
volume, preserving their relative paths:

```text
directus/database/data.db -> /directus/data/database/data.db
directus/uploads/          -> /directus/data/uploads/
```

The Astro frontend is deployed separately. Its build needs the public Directus
URL and a read-only `DIRECTUS_API_TOKEN`; content is generated into static
files at build time.
