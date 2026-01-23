# PurpleKit

**A lightweight purple team operations platform for planning, executing, and tracking security testing engagements.**

PurpleKit serves as a coordination layer for purple team exercises - it's not another attack tool or SIEM, but a control plane that helps red and blue teams work together effectively.

## What It Does

- **Engagement Management** - Create and manage purple team exercises with clear scope, objectives, and timelines
- **ATT&CK Integration** - Map techniques to MITRE ATT&CK framework with tactic categorization
- **Detection Tracking** - Track four detection states: Detected, Partially Detected, Not Detected, Not Applicable
- **Kanban Workflow** - Visual board to move techniques through Planning → Executing → Complete
- **Security Controls** - Attribute detections to specific security controls (EDR, SIEM, NDR, etc.)
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
| Backend | Node.js + Express | Same language as frontend, great ecosystem |
| Database | PostgreSQL | Robust, free, works great with AWS RDS |
| Containerization | Docker | Consistent environment everywhere |
| Deployment | AWS EC2 + RDS | Reliable, industry-standard |

## Project Structure

```
purplekit-app/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page-level components
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
   cd purplekit-app
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
- Run database migrations
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
| PUT | `/api/techniques/:id` | Update technique |
| DELETE | `/api/techniques/:id` | Remove technique |
| GET | `/api/export/:id/json` | Export engagement as JSON |
| GET | `/api/export/:id/csv` | Export engagement as CSV |
| GET | `/api/export/:id/navigator` | Export as ATT&CK Navigator layer |

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/purplekit` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | Secret key for JWT tokens | Random string (32+ chars recommended) |

## Authentication

PurpleKit uses JWT-based authentication:

1. **First Run Setup** - The first visitor creates an admin account
2. **Login** - Users authenticate with username/password to get a JWT token
3. **Token Storage** - Tokens are stored in localStorage (valid for 7 days)
4. **Protected Routes** - All API routes except `/api/auth/*` require authentication

### User Roles
- **admin** - Can create/delete users, full access
- **user** - Standard access to engagements and techniques

## Deployment

### Manual Deployment

See [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) for complete AWS setup instructions.

```bash
# SSH to your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Pull latest changes
cd purplekit-app
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Automated Deployment (GitHub Actions)

This repo includes a GitHub Actions workflow that automatically deploys when you push to `main`.

**Setup required:**
1. Add these secrets to your GitHub repo (Settings → Secrets → Actions):
   - `EC2_HOST` - Your EC2 public IP or domain
   - `EC2_USER` - SSH user (usually `ec2-user`)
   - `EC2_SSH_KEY` - Contents of your `.pem` private key file

2. Push to `main` branch - deployment runs automatically

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
