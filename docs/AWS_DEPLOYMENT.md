# AWS + Cloudflare Deployment Guide

This guide walks you through deploying PurpleKit on AWS (EC2 + RDS) with Cloudflare for DNS, SSL, and CDN.

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────────────────────┐
│              │     │                  │     │             AWS VPC             │
│    User      │────▶│   Cloudflare     │────▶│                                 │
│   Browser    │     │                  │     │  ┌─────────┐    ┌───────────┐  │
│              │     │  - DNS           │     │  │   EC2   │───▶│    RDS    │  │
│ purplekit.io │◀────│  - SSL/TLS       │◀────│  │         │    │ PostgreSQL│  │
│              │     │  - CDN           │     │  │ Docker  │    │           │  │
│              │     │  - DDoS protect  │     │  └─────────┘    └───────────┘  │
└──────────────┘     └──────────────────┘     └─────────────────────────────────┘
       HTTPS                HTTPS                      HTTP (internal)
```

## What You Get

| Feature | Provider | Cost |
|---------|----------|------|
| SSL/HTTPS | Cloudflare | Free |
| DDoS Protection | Cloudflare | Free |
| CDN | Cloudflare | Free |
| DNS | Cloudflare | Free |
| Web Server | AWS EC2 | ~$8-15/month |
| Database | AWS RDS | ~$15/month |
| Static IP | AWS Elastic IP | Free (while attached) |

**Total: ~$25-35/month**

---

## Prerequisites

- AWS Account
- Cloudflare account with purplekit.io domain
- SSH client (Terminal on Mac/Linux, PuTTY on Windows)

---

## Part 1: AWS Setup

### Step 1.1: Choose Your Region

Pick one region and use it for everything:
- **us-east-1** (N. Virginia) - recommended, cheapest
- **us-west-2** (Oregon) - good alternative

Set it in the top-right corner of AWS Console.

---

### Step 1.2: Create EC2 Key Pair

This is how you'll SSH into your server.

1. Navigate to **EC2 → Key Pairs** (left sidebar)
2. Click **Create key pair**
3. Configure:
   - **Name**: `purplekit-key`
   - **Type**: RSA
   - **Format**: `.pem` (Mac/Linux) or `.ppk` (Windows/PuTTY)
4. Click **Create key pair**
5. **Save the downloaded file** - you cannot download it again!

On Mac/Linux, secure the key file:
```bash
chmod 400 ~/Downloads/purplekit-key.pem
```

---

### Step 1.3: Create RDS Database

1. Navigate to **RDS → Create database**
2. Configure:

| Setting | Value |
|---------|-------|
| Creation method | Standard create |
| Engine | PostgreSQL |
| Version | 15.x (latest) |
| Template | Free tier |
| DB instance identifier | `purplekit-db` |
| Master username | `purplekit` |
| Master password | Create strong password → **WRITE IT DOWN** |
| Instance class | db.t3.micro |
| Storage type | gp3 |
| Allocated storage | 20 GB |
| VPC | Default VPC |
| Public access | **No** |
| VPC security group | Create new → `purplekit-db-sg` |
| Initial database name | `purplekit` |
| Backup retention | 7 days |

3. Click **Create database**
4. Wait ~10 minutes for creation

5. **Save the endpoint** (e.g., `purplekit-db.abc123xyz.us-east-1.rds.amazonaws.com`)

---

### Step 1.4: Create EC2 Instance

1. Navigate to **EC2 → Launch instance**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `purplekit-server` |
| AMI | Amazon Linux 2023 |
| Instance type | t3.micro (free tier) or t3.small |
| Key pair | Select `purplekit-key` |

3. **Network settings** → Click "Edit":

| Setting | Value |
|---------|-------|
| VPC | Default VPC |
| Auto-assign public IP | **Enable** |
| Security group | Create new → `purplekit-server-sg` |

4. **Security group rules**:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | My IP | SSH access |
| HTTP | 80 | Anywhere (0.0.0.0/0) | Web traffic |

5. **Storage**: 20 GB gp3

6. Click **Launch instance**

---

### Step 1.5: Allocate Elastic IP

This gives your server a static IP that won't change when you restart it.

1. Navigate to **EC2 → Elastic IPs**
2. Click **Allocate Elastic IP address**
3. Click **Allocate**
4. Select the new IP → **Actions → Associate Elastic IP address**
5. Configure:
   - **Instance**: Select `purplekit-server`
   - Click **Associate**

6. **Save this IP address** - this is what you'll use in Cloudflare

---

### Step 1.6: Connect Security Groups

Allow EC2 to connect to RDS:

1. Navigate to **EC2 → Security Groups**
2. Find and select `purplekit-db-sg`
3. Click **Inbound rules → Edit inbound rules**
4. Click **Add rule**:

| Type | Port | Source |
|------|------|--------|
| PostgreSQL | 5432 | Select `purplekit-server-sg` |

5. Click **Save rules**

---

### Step 1.7: Record Your Values

You'll need these for deployment:

```
┌─────────────────────────────────────────────────────────────┐
│ AWS VALUES - SAVE THESE                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Elastic IP:        ___.___.___.___                          │
│                                                             │
│ RDS Endpoint:      purplekit-db.____________.rds.amazonaws.com
│                                                             │
│ RDS Password:      ____________________________              │
│                                                             │
│ Key Pair File:     purplekit-key.pem                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 2: Cloudflare Setup

### Step 2.1: Add DNS Record

1. Log into **Cloudflare Dashboard**
2. Select **purplekit.io**
3. Go to **DNS → Records**
4. Click **Add record**

| Setting | Value |
|---------|-------|
| Type | A |
| Name | `@` |
| IPv4 address | Your Elastic IP |
| Proxy status | **Proxied** (orange cloud) |
| TTL | Auto |

5. Click **Save**

6. (Optional) Add www subdomain:

| Setting | Value |
|---------|-------|
| Type | CNAME |
| Name | `www` |
| Target | `purplekit.io` |
| Proxy status | Proxied |

---

### Step 2.2: Configure SSL

1. Go to **SSL/TLS → Overview**
2. Set encryption mode to **Full**

> **Why "Full" not "Full (Strict)"?**
> Full (Strict) requires a valid SSL cert on your server. With "Full", Cloudflare handles SSL for visitors, and talks to your server over HTTP internally. This is secure because traffic goes through Cloudflare's secure tunnels.

---

### Step 2.3: Enable HTTPS Redirect

1. Go to **SSL/TLS → Edge Certificates**
2. Enable:
   - **Always Use HTTPS**: ON
   - **Automatic HTTPS Rewrites**: ON

---

### Step 2.4: Recommended Security Settings

1. Go to **Security → Settings**
   - **Security Level**: Medium

2. Go to **Security → Bots**
   - **Bot Fight Mode**: ON (free)

---

### Step 2.5: (Optional) Restrict EC2 to Cloudflare Only

For extra security, only allow Cloudflare IPs to reach your server:

1. Get Cloudflare IPs from: https://www.cloudflare.com/ips/
2. In AWS **EC2 → Security Groups → purplekit-server-sg**
3. Edit HTTP inbound rule:
   - Remove `0.0.0.0/0`
   - Add each Cloudflare IP range

This blocks anyone trying to access your server directly by IP.

---

## Part 3: Deploy PurpleKit

### Step 3.1: Connect to EC2

```bash
ssh -i ~/Downloads/purplekit-key.pem ec2-user@YOUR_ELASTIC_IP
```

If you get a permissions error:
```bash
chmod 400 ~/Downloads/purplekit-key.pem
```

---

### Step 3.2: Install Docker

```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install -y docker

# Start Docker and enable on boot
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group
sudo usermod -aG docker ec2-user

# IMPORTANT: Log out and back in
exit
```

SSH back in:
```bash
ssh -i ~/Downloads/purplekit-key.pem ec2-user@YOUR_ELASTIC_IP
```

Verify Docker works:
```bash
docker --version
```

---

### Step 3.3: Install Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

---

### Step 3.4: Install Git

```bash
sudo yum install -y git
```

---

### Step 3.5: Clone Your Repository

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/purplekit-app.git
cd purplekit-app
```

> **Haven't pushed to GitHub yet?** You can use `scp` to copy files:
> ```bash
> # From your local machine:
> scp -i ~/Downloads/purplekit-key.pem -r ./purplekit-app ec2-user@YOUR_ELASTIC_IP:~/
> ```

---

### Step 3.6: Configure Environment

```bash
cp .env.example .env
nano .env
```

Update with your RDS values:
```
DATABASE_URL=postgresql://purplekit:YOUR_RDS_PASSWORD@YOUR_RDS_ENDPOINT:5432/purplekit
NODE_ENV=production
PORT=3000
```

Example:
```
DATABASE_URL=postgresql://purplekit:MyStr0ngP@ss@purplekit-db.abc123xyz.us-east-1.rds.amazonaws.com:5432/purplekit
NODE_ENV=production
PORT=3000
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

---

### Step 3.7: Build and Deploy

```bash
# Build the Docker image (takes 2-3 minutes)
docker-compose -f docker-compose.prod.yml build

# Run database migrations
docker-compose -f docker-compose.prod.yml run --rm purplekit node backend/src/db/migrate.js

# Start the application
docker-compose -f docker-compose.prod.yml up -d
```

---

### Step 3.8: Verify Deployment

```bash
# Check container is running
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs

# Test locally
curl http://localhost/api/health
```

You should see:
```json
{"status":"healthy","timestamp":"...","database":"connected"}
```

---

### Step 3.9: Test Your Domain

Open your browser and go to:
```
https://purplekit.io
```

You should see PurpleKit running with a valid SSL certificate!

---

## Part 4: Maintenance

### View Logs
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Restart Application
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Update Application
```bash
cd ~/purplekit-app
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Stop Application
```bash
docker-compose -f docker-compose.prod.yml down
```

### Database Backup
RDS handles daily automated backups. For manual backup:
```bash
# Install PostgreSQL client
sudo yum install -y postgresql15

# Create backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

---

## Troubleshooting

### Can't SSH into EC2
- Check security group allows SSH from your IP
- Verify key pair file permissions: `chmod 400 purplekit-key.pem`
- Make sure you're using the Elastic IP, not the original public IP

### Can't connect to database
- Check RDS security group allows PostgreSQL from EC2 security group
- Verify DATABASE_URL is correct (no typos in password)
- Test connection:
  ```bash
  docker-compose -f docker-compose.prod.yml run --rm purplekit node -e "require('./backend/src/db/connection')"
  ```

### Site not loading via Cloudflare
- Verify DNS A record points to Elastic IP
- Check Cloudflare SSL mode is "Full"
- Wait 5 minutes for DNS propagation
- Check EC2 security group allows HTTP on port 80

### 502 Bad Gateway
- Container might have crashed. Check logs:
  ```bash
  docker-compose -f docker-compose.prod.yml logs
  ```
- Restart:
  ```bash
  docker-compose -f docker-compose.prod.yml restart
  ```

### Database migrations failed
- Check DATABASE_URL in .env
- Verify RDS instance is running
- Check security group connectivity

---

## Quick Reference

### SSH Command
```bash
ssh -i ~/Downloads/purplekit-key.pem ec2-user@YOUR_ELASTIC_IP
```

### Useful Docker Commands
```bash
# Status
docker-compose -f docker-compose.prod.yml ps

# Logs (follow)
docker-compose -f docker-compose.prod.yml logs -f

# Restart
docker-compose -f docker-compose.prod.yml restart

# Rebuild and deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Shell into container
docker-compose -f docker-compose.prod.yml exec purplekit sh
```

### Your URLs
- **Application**: https://purplekit.io
- **API Health**: https://purplekit.io/api/health

---

## Cost Summary

| Resource | Monthly Cost |
|----------|--------------|
| EC2 t3.micro | ~$8 |
| RDS db.t3.micro | ~$15 |
| Elastic IP | Free (while attached) |
| Cloudflare | Free |
| **Total** | **~$23/month** |

> **Tip**: Use t3.small ($15/month) for EC2 if you need more resources for larger engagements.
