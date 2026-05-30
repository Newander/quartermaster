#!/usr/bin/env sh
set -eu

run_migrations() {
  echo "Running Alembic migrations..."
  alembic upgrade head
}

run_fixtures() {
  echo "Loading fixture data..."
  python -m fixture_data.upload_all_data
  python -m fixture_data.upload_expenses
  python -m fixture_data.upload_shelf_instructors
  python -m fixture_data.upload_test_members_300
}

command="${1:-start}"
[ $# -gt 0 ] && shift

case "$command" in
  start)
    run_migrations
    exec uvicorn main:app --host 0.0.0.0 --port "${APP_PORT:-8080}" "$@"
    ;;
  migrate)
    run_migrations
    ;;
  fixtures)
    run_fixtures
    ;;
  migrate-fixtures)
    run_migrations
    run_fixtures
    ;;
  *)
    exec "$@"
    ;;
esac
