# Run Quartermaster

## Recommended: Docker full stack

From the repository root:

```bash
docker compose up --build
```

Open:

```text
http://localhost:7777/hema-crm/
```

This starts:

- MySQL
- FastAPI backend
- demo fixtures
- Vite frontend built as static assets and served by nginx

Demo credentials loaded by fixtures:

```text
username: admin_hema
password: supersecretpassword123
```

Useful Docker commands:

```bash
docker compose ps
docker compose logs -f backend frontend
docker compose down
docker compose down -v
```

If Docker is installed but `docker compose` returns `permission denied` for
`/var/run/docker.sock`, add your user to the Docker group and start a new shell:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

## Development: local backend + local frontend

Use this when actively editing code and you want hot reload without rebuilding Docker images.

Backend:

```bash
cd backend
uv venv .venv
uv pip install -e .
source .venv/bin/activate
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

Frontend:

```bash
cd frontend
pnpm install
pnpm run dev
```

Open:

```text
http://localhost:7777/hema-crm/
```

## Checks

```bash
cd backend
.venv/bin/python -m compileall -q app main.py
```

```bash
cd frontend
pnpm exec tsc --noEmit
pnpm run build
```
