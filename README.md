# PurpleKit

**A lightweight purple team operations platform for planning, executing, and tracking security testing engagements.**

PurpleKit serves as a coordination layer for purple team exercises - it's not another attack tool or SIEM, but a control plane that helps red and blue teams work together effectively.

## What It Does

- **Engagement Management** - Create and manage purple team exercises with clear scope, objectives, and timelines
- **ATT&CK Integration** - Map techniques to MITRE ATT&CK framework with tactic categorization
- **Detection Tracking** - Track outcomes: Logged, Alerted, Prevented, or Not Logged
- **Kanban Workflow** - Visual board to move techniques through Ready → Blocked → Executing → Validating → Done
- **Planning Wizard** - Guided engagement creation with templates, technique picker, and team leads
- **Security Controls** - Attribute detections to specific security controls (EDR, SIEM, NDR, etc.)
- **Comments & Checklist** - Technique comments and pre-execution checklist support
- **Export & Reporting** - Export to JSON, CSV, and ATT&CK Navigator format for heatmaps

## Screenshots

*Coming soon*

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Your Browser                         │
│                          │                               │
│                          ▼                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │              React Frontend (:3000)              │    │
│  │         (Served by Node.js in production)        │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                          ▼ API calls                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │           Node.js + Express Backend              │    │
│  │                  (Port 3000)                     │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                          ▼                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │              PostgreSQL Database                 │    │
│  │           (RDS in AWS, local in dev)            │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | React + Tailwind CSS | Modern, component-based UI |
| Backend | Node.js + Express | Fast API server |
| Database | PostgreSQL | Reliable relational storage |
| ATT&CK Source | MITRE TAXII 2.1 | Live technique/tactic data with caching |
| Containerization | Docker | Consistent environment everywhere |

## Project Structure

```
pk4/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── api/              # API client functions
│   │   ├── App.jsx           # Main app component
│   │   └── index.jsx         # Entry point
│   ├── public/
│   ├── package.json
│   └── vite.config.js        # Build configuration
│
├── backend/                  # Node.js API server
│   ├── src/
│   │   ├── routes/           # API route handlers
│   │   ├── db/               # Database connection & queries
│   │   ├── middleware/       # Express middleware
│   │   └── index.js          # Server entry point
│   ├── migrations/           # Database schema migrations
│   └── package.json
│
├── docker-compose.yml        # Local development setup
├── Dockerfile                # Production container build
├── .env.example              # Environment variable template
└── README.md                 # You are here
```

## Quick Start (Local Development)

### Prerequisites
- Docker and Docker Compose installed
- Git

### Steps

1. **Clone and enter the project**
   ```bash
   cd pk4
   ```

2. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

3. **Start everything with Docker Compose**
   ```bash
   docker-compose up --build
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

That's it! Docker Compose will:
- Start a PostgreSQL database
- Start the backend API
- Build and serve the frontend

### Stopping

```bash
docker-compose down
```

To also delete the database data:
```bash
docker-compose down -v
```

## AWS Deployment

See [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) for complete instructions.

### Quick Overview

1. **Create RDS PostgreSQL instance**
2. **Launch EC2 instance** (Amazon Linux 2 or Ubuntu)
3. **Install Docker** on EC2
4. **Clone repo** and configure `.env` with RDS connection string
5. **Run** `docker-compose -f docker-compose.prod.yml up -d`

Estimated AWS costs: ~$20-40/month (t3.micro EC2 + db.t3.micro RDS)

## Development Commands

### Backend only
```bash
cd backend
npm install
npm run dev          # Start with auto-reload
npm run migrate      # Run database migrations
npm test             # Run tests
```

### Frontend only
```bash
cd frontend
npm install
npm run dev          # Start Vite dev server (hot reload)
npm run build        # Production build
```

### Docker
```bash
docker-compose up --build    # Rebuild and start
docker-compose logs -f       # View logs
docker-compose exec db psql -U purplekit  # Database shell
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/status` | Check if setup is needed |
| POST | `/api/auth/setup` | Create first admin user (one-time) |
| POST | `/api/auth/login` | Login and get JWT token |
| POST | `/api/auth/refresh` | Rotate refresh token and issue new short-lived access token |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/users` | Create user (admin only) |
| GET | `/api/auth/users` | List all users (admin only) |
| DELETE | `/api/auth/users/:id` | Delete user (admin only) |

### Engagements (requires authentication)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/engagements` | List all engagements |
| POST | `/api/engagements` | Create engagement |
| GET | `/api/engagements/:id` | Get single engagement |
| PUT | `/api/engagements/:id` | Update engagement |
| DELETE | `/api/engagements/:id` | Delete engagement |
| GET | `/api/engagements/:id/techniques` | List techniques in engagement |
| POST | `/api/engagements/:id/techniques` | Add technique to engagement |
| GET | `/api/engagements/:id/board` | Get kanban board data |
| PATCH | `/api/engagements/:id/techniques/:techniqueId/status` | Update technique status/assignment |
| PATCH | `/api/engagements/:id/techniques/reorder` | Reorder techniques |
| PUT | `/api/techniques/:id` | Update technique |
| DELETE | `/api/techniques/:id` | Remove technique |
| GET | `/api/engagements/:id/techniques/:techniqueId/comments` | List technique comments |
| POST | `/api/engagements/:id/techniques/:techniqueId/comments` | Add technique comment |
| DELETE | `/api/engagements/:id/techniques/:techniqueId/comments/:commentId` | Delete technique comment |
| GET | `/api/engagements/:id/checklist` | Get pre-execution checklist |
| PATCH | `/api/engagements/:id/checklist/:itemKey` | Toggle checklist item |
| POST | `/api/engagements/:id/checklist` | Add checklist item |
| GET | `/api/export/:id/json` | Export engagement as JSON |
| GET | `/api/export/:id/csv` | Export engagement as CSV |
| GET | `/api/export/:id/navigator` | Export as ATT&CK Navigator layer |

### ATT&CK Library
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attack/techniques` | List cached techniques |
| GET | `/api/attack/tactics` | List tactics |
| GET | `/api/attack/search` | Search techniques |
| GET | `/api/attack/gaps` | Gap analysis |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List templates |
| POST | `/api/templates` | Create template |
| GET | `/api/templates/:id` | Get template |
| POST | `/api/templates/:id/apply` | Apply template to engagement |

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/purplekit` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | Secret key for JWT tokens | Random string (32+ chars recommended) |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens (set separately in production) | Random string (32+ chars recommended) |
| `JWT_ACCESS_TOKEN_TTL` | Access token lifetime | `15m` |
| `JWT_REFRESH_TOKEN_TTL` | Refresh token lifetime | `7d` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origin allowlist (required in production) | `https://purplekit.io,https://www.purplekit.io` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Auth rate-limit window in milliseconds | `900000` |
| `AUTH_RATE_LIMIT_MAX` | Max auth attempts per IP in the rate-limit window | `10` |
| `AUTH_RATE_LIMIT_MAX_TRACKED_IPS` | Max unique IP entries kept in memory for auth limiter (helps bound memory) | `5000` |

## Authentication

PurpleKit uses JWT-based authentication:

1. **First Run Setup** - The first visitor creates an admin account
2. **Login** - Users authenticate with username/password to get a short-lived access token + refresh token pair
3. **Token Rotation** - Access tokens default to 15 minutes and are refreshed automatically using `/api/auth/refresh`
4. **Token Storage** - Tokens are currently stored in localStorage; migration to `httpOnly` secure cookies is recommended for a future release
5. **Protected Routes** - All API routes except `/api/auth/*` require authentication

### Security defaults by environment

- **Development**
  - CORS is permissive for local iteration.
  - Helmet CSP is disabled to avoid blocking hot-reload and dev assets.
- **Production**
  - CORS only allows origins listed in `CORS_ALLOWED_ORIGINS`.
  - Helmet CSP is enabled with a strict `self` baseline and explicit allowances for bundled frontend assets (`script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`).
  - `/api/auth/*` is protected by explicit rate limiting (`AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX_TRACKED_IPS`).
  - The API fails fast at startup if `JWT_SECRET` is missing/default or `JWT_REFRESH_SECRET` is unset.

### User Roles
- **admin** - Can create/delete users, full access
- **user** - Standard access to engagements and techniques

## Deployment

### Production deployment checklist (recommended)

1. **Provision infrastructure**
   - PostgreSQL (RDS or managed Postgres).
   - VM/host (EC2, VPS, etc.) with Docker + Docker Compose.
   - DNS record pointing to host IP (optional but recommended).

2. **Clone and configure**
   ```bash
   git clone <your-repo-url> purplekit-app
   cd purplekit-app
   cp .env.example .env
   ```

3. **Set required production environment variables in `.env`**
   At minimum, set:
   - `NODE_ENV=production`
   - `DATABASE_URL=<postgres-connection-string>`
   - `JWT_SECRET=<strong-random-secret>`
   - `JWT_REFRESH_SECRET=<different-strong-random-secret>`
   - `CORS_ALLOWED_ORIGINS=https://your-frontend-domain`

   Recommended hardening knobs:
   - `AUTH_RATE_LIMIT_WINDOW_MS=900000`
   - `AUTH_RATE_LIMIT_MAX=10`
   - `AUTH_RATE_LIMIT_MAX_TRACKED_IPS=5000`

   > Note: In production, backend startup now **fails intentionally** if JWT secrets are missing/unsafe.

4. **Build the production image**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

5. **Run database migrations before first start (and on every deploy)**
   ```bash
   docker-compose -f docker-compose.prod.yml run --rm purplekit node src/db/migrate.js
   ```

6. **Start the app**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

7. **Verify health**
   ```bash
   curl -f http://localhost/api/health
   ```

### Updating an existing deployment

```bash
cd purplekit-app
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml run --rm purplekit node src/db/migrate.js
docker-compose -f docker-compose.prod.yml up -d
```

### Automated deployment (GitHub Actions)

This repo includes `.github/workflows/deploy.yml` to deploy on pushes to `main` (or manually via workflow dispatch).

Required repository secrets:
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`

For production-grade reliability, also ensure your target host has a complete `.env` with the production variables above (`DATABASE_URL`, JWT secrets, CORS allowlist, etc.).

See [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) for full AWS setup details.

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/cool-thing`)
3. Commit changes (`git commit -m 'Add cool thing'`)
4. Push to branch (`git push origin feature/cool-thing`)
5. Open a Pull Request

## Roadmap

- [ ] Full MITRE ATT&CK technique library import
- [ ] Enhanced engagement planning workflow
- [ ] Findings tracker (People/Process/Technology gaps)
- [ ] PDF report generation
- [ ] Dashboard analytics and charts
- [ ] Multi-tenant support

## License

MIT - Use it, modify it, ship it.

## Docker quickstart

```bash
docker compose up --build
```

Services:
- Postgres with `pg_isready` healthcheck.
- Backend with `/healthz` healthcheck and migration-on-boot.
- Frontend (Vite) bound to `0.0.0.0`.

## ATT&CK sync (TAXII 2.1)

Run a full sync (Enterprise by default):

```bash
cd backend
npm run attack:sync -- --domain enterprise --full
```

Incremental sync (uses stored `added_after` cursor automatically):

```bash
cd backend
npm run attack:sync -- --domain enterprise
```

Optional flags:
- `--domain enterprise|mobile|ics`
- `--full`
- `--since <iso-date>`

## Useful environment variables

- `DATABASE_URL` - backend PostgreSQL connection string.
- `DB_CONNECT_MAX_RETRIES` / `DB_CONNECT_RETRY_DELAY_MS` - migration DB wait strategy.
- `VITE_API_BASE_URL` - frontend API base/proxy target (defaults to Docker backend service in Vite config).
- `ATTACK_TAXII_BASE_URL` - TAXII API root (default: `https://attack-taxii.mitre.org/api/v21`).
- `ATTACK_ENTERPRISE_COLLECTION_ID`, `ATTACK_MOBILE_COLLECTION_ID`, `ATTACK_ICS_COLLECTION_ID` - override TAXII collection IDs.


### API base URL behavior

If `VITE_API_BASE_URL` is set, PurpleKit automatically appends `/api` unless it is already present.

Examples:
- `VITE_API_BASE_URL=http://localhost:3000` → requests go to `http://localhost:3000/api/*`
- `VITE_API_BASE_URL=http://backend:3000/api` → requests stay on `http://backend:3000/api/*`
- unset `VITE_API_BASE_URL` → requests use relative `/api/*`

### Report bundle export

Licensed organizations can download a report bundle ZIP from:

- `GET /api/documents/:engagementId/bundle`

Bundle contents:
- `plan.docx`
- `executive_report.docx`
- `technical_report.docx`
- `attack_navigator_layer.json`
- `action_items.csv`
- optional `engagement.json` (when `?include_engagement_json=true`)
- `README.txt`

### License generation and import (MVP HMAC format)

License key format is:

`<base64url(json_payload)>.<hex_hmac_sha256_signature>`

Where signature = `HMAC_SHA256(payloadB64, LICENSE_SECRET)`.

Payload example:

```json
{
  "plan": "pro",
  "features": {
    "report_bundle": true
  },
  "validUntil": "2026-12-31T23:59:59Z",
  "seats": 25
}
```

Apply a license key (org admin):

- `POST /api/admin/license`
- body: `{ "licenseKey": "..." }`

Without a valid license enabling `report_bundle`, the bundle endpoint returns HTTP 402.


## Smoke test

```bash
cd backend
npm run smoke
```
