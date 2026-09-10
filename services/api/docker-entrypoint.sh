#!/bin/sh
set -e

# EFS is mounted at TICKER_DATA_DIR. Keep SQLite and local assets in
# sibling directories on that filesystem. The API still reads TICKER_DATA_DIR
# and TICKER_DB_PATH unchanged.
data_dir="${TICKER_DATA_DIR:-/mnt/ticker-data}"
mkdir -p "${data_dir}/assets"

if [ -n "${TICKER_DB_PATH}" ]; then
  mkdir -p "$(dirname "${TICKER_DB_PATH}")"
else
  mkdir -p "${data_dir}/db"
fi

exec "$@"
