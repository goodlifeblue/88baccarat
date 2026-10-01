#!/bin/sh
set -eu

# Railway mounts an empty volume on the first deployment. Create the paths
# before Directus opens SQLite or its local storage driver.
mkdir -p /directus/data/database /directus/data/uploads
chown -R node:node /directus/data

exec /usr/local/bin/docker-entrypoint.sh "$@"
