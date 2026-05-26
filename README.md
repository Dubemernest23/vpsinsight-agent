# VPSInsight Agent

Lightweight, self-hosted VPS monitoring agent. Collects real-time system and process metrics and exposes a secured HTTP endpoint for dashboards and alerting engines.

This is the **agent** component of the VPSInsight project. For the full product requirements, see [VPSInsight_PRD.md](VPSInsight_PRD.md).

**Dashboard repo:** [vpsinsight-dashboard](https://github.com/Dubemernest23/vpsinsight-dashboard)

---

## Contents

- [Quickstart](#1-quickstart)
- [Environment Variables](#2-environment-variables)
- [HTTPS Setup](#3-https-setup)
- [API Reference](#4-api-reference)
- [Alert Thresholds](#5-alert-thresholds)
- [Security](#6-security)
- [Running with PM2](#7-running-with-pm2)
- [Troubleshooting](#8-troubleshooting)
- [Development](#9-development)
- [Roadmap](#10-roadmap)
- [License](#11-license)

---

## Key Files

| File | Purpose |
|---|---|
| `index.js` | Agent entry point — Express server |
| `src/metrics.js` | System metrics collection via `systeminformation` |
| `src/auth.js` | Bearer token middleware |
| `src/processes.js` | PM2 process inspection |
| `src/alert.js` | Email alert sender via Resend |
| `VPSInsight_PRD.md` | Product Requirements Document |
| `.env.example` | Environment variable template |

---

## 1. Quickstart

### Prerequisites

- Node.js 18+
- PM2 installed globally — `npm install -g pm2`
- Git
- Nginx (for HTTPS — required when using the hosted dashboard on Vercel)

### Install and run

```bash
# SSH into your VPS
ssh user@YOUR_VPS_IP

# Clone the repo
git clone https://github.com/Dubemernest23/vpsinsight-agent.git
cd vpsinsight-agent

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
nano .env

# Start with PM2
pm2 start index.js --name vpsinsight-agent
pm2 save
pm2 startup
```

Run the command that `pm2 startup` outputs to enable auto-start on reboot.

Verify the agent is running:

```bash
curl http://localhost:4000/health
curl -H "Authorization: Bearer your-token" http://localhost:4000/stats
```

---

## 2. Environment Variables

Create `.env` from `.env.example` and set the following:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port the agent listens on (default: `4000`) |
| `TOKEN` | Yes | Bearer token for authenticating `/stats` and `/alert` requests |
| `MONITORED_APPS` | No | Comma-separated PM2 process names to track |
| `RESEND_API_KEY` | No | Resend API key for email alerts |
| `ALERT_TO` | No | Email address to send alerts to |
| `ALERT_FROM` | No | Sender address (default: `VPSInsight <onboarding@resend.dev>`) |
| `ALLOWED_ORIGINS` | Yes | Dashboard URL for CORS (e.g. `https://your-dashboard.vercel.app`) |

Example `.env`:

```env
PORT=4000
TOKEN=your-generated-secret-token
MONITORED_APPS=my-app
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
ALERT_TO=your-email@gmail.com
ALERT_FROM=VPSInsight <onboarding@resend.dev>
ALLOWED_ORIGINS=https://your-dashboard.vercel.app
```

Generate a secure token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. HTTPS Setup

> **Required** if your dashboard is deployed on Vercel (HTTPS). Browsers block requests from HTTPS pages to HTTP endpoints (mixed content).

If you don't have a custom domain, use [nip.io](https://nip.io) — a free DNS service that maps `YOUR_VPS_IP.nip.io` to your IP with no registration.

### Install Nginx and Certbot (run as root)

```bash
apt update
apt install nginx certbot python3-certbot-nginx -y
```

### Create Nginx config

Replace `YOUR_VPS_IP` with your actual IP in both `server_name` lines:

```bash
nano /etc/nginx/sites-available/vpsinsight.conf
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name YOUR_VPS_IP.nip.io;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name YOUR_VPS_IP.nip.io;

    ssl_certificate /etc/letsencrypt/live/YOUR_VPS_IP.nip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_VPS_IP.nip.io/privkey.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable and get SSL certificate

```bash
ln -s /etc/nginx/sites-available/vpsinsight.conf /etc/nginx/sites-enabled/vpsinsight.conf
ufw allow 80
ufw allow 443
nginx -t
systemctl reload nginx
certbot --nginx -d YOUR_VPS_IP.nip.io
```

### Verify

```bash
curl https://YOUR_VPS_IP.nip.io/health
```

After SSL is set up, update `ALLOWED_ORIGINS` in `.env` to your Vercel dashboard URL and restart:

```bash
pm2 restart vpsinsight-agent --update-env
```

---

## 4. API Reference

### `GET /health`

Unauthenticated. Returns `{ "status": "ok" }`.

```bash
curl http://YOUR_VPS_IP:4000/health
```

---

### `GET /stats`

Requires `Authorization: Bearer <TOKEN>`. Returns full system metrics.

```bash
curl -H "Authorization: Bearer <TOKEN>" http://YOUR_VPS_IP:4000/stats
```

**Response schema:**

```json
{
  "server": { "hostname": "srv1", "platform": "linux", "distro": "Ubuntu", "uptime": 86400 },
  "cpu": { "usage": 5.1, "cores": 1, "model": "EPYC 7543P", "speed": 2.8 },
  "memory": { "total": 4106465280, "used": 2085646336, "free": 2020818944, "percentage": 50.79 },
  "disk": [{ "mount": "/", "total": 50884108288, "used": 9420214272, "free": 41447116800, "percentage": 18.52 }],
  "network": { "interface": "eth0", "rx_sec": 221.56, "tx_sec": 473.10, "rx_total": 213802236, "tx_total": 79915400 },
  "processes": [{ "name": "my-app", "pid": 1234, "status": "running", "cpu": 0.4, "memory": 99041280, "uptime": 172365 }],
  "timestamp": "2026-05-26T10:00:00.000Z"
}
```

**Field notes:**
- `server.uptime` — seconds since last reboot
- `memory.percentage` — calculated from available memory, not raw used (accurate on Linux)
- `memory`, `disk`, `process.memory` — values in bytes
- `processes` — only PM2 apps listed in `MONITORED_APPS` are reported

---

### `POST /alert`

Requires `Authorization: Bearer <TOKEN>`. Called by the dashboard to trigger an email alert.

```bash
curl -X POST http://YOUR_VPS_IP:4000/alert \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"serverName":"My VPS","metric":"memory","label":"Memory usage","value":91.2,"threshold":90,"severity":"critical","message":"Memory usage is 91.2% on My VPS"}'
```

---

## 5. Alert Thresholds

Default thresholds used by the dashboard alert engine:

| Metric | Warning | Critical |
|---|---|---|
| CPU usage | 80% | 90% |
| Memory usage | 80% | 90% |
| Disk usage | 85% | 95% |
| Agent reachability | — | No `/health` response for 2 consecutive polls |

**Notification rules:**
- Alerts fire once on breach and only re-fire after recovery
- Recovery notifications sent when metric returns below threshold
- Minimum 10-minute cooldown before the same critical alert re-fires

---

## 6. Security

- `/stats` and `/alert` require a valid `Bearer` token — requests without it return `401`
- `/health` is intentionally unauthenticated and returns no metric data
- Store `TOKEN` in `.env` only — never commit it or log it
- In production, always use HTTPS between the dashboard and agent (see Section 3)
- Rate limiting applied — max 60 requests per minute per IP

---

## 7. Running with PM2

```bash
pm2 start index.js --name vpsinsight-agent
pm2 save
pm2 startup

# Check status
pm2 status vpsinsight-agent

# Tail logs
pm2 logs vpsinsight-agent

# Restart with updated .env
pm2 restart vpsinsight-agent --update-env
```

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `401 Unauthorized` on `/stats` | Confirm `Authorization: Bearer <TOKEN>` header matches `.env` exactly |
| `/stats` times out from outside | Check firewall — ensure port `4000` is open (`ufw allow 4000`) |
| CORS error in browser | Set `ALLOWED_ORIGINS` to your exact dashboard URL, restart with `--update-env` |
| Mixed content error on Vercel dashboard | Agent must be on HTTPS — follow Section 3 to set up Nginx + nip.io + SSL |
| No processes listed | Confirm PM2 is installed and `MONITORED_APPS` matches exact PM2 process names |
| Email alerts not sending | Confirm `RESEND_API_KEY` and `ALERT_TO` are set — run `pm2 logs vpsinsight-agent` for details |

### Diagnostic commands

```bash
pm2 status vpsinsight-agent
pm2 logs vpsinsight-agent --lines 50
curl http://localhost:4000/health
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/stats
```

---

## 9. Development

```bash
git clone https://github.com/Dubemernest23/vpsinsight-agent.git
cd vpsinsight-agent
npm install
cp .env.example .env
# edit .env
npm run dev
```

`npm run dev` uses `nodemon` and auto-restarts on file save.

---

## 10. Roadmap

**v2**
- Optional persistent metric history (SQLite)
- Extended 24-hour / 7-day trend charts
- Dashboard authentication

---

## 11. License

MIT — see [LICENSE](LICENSE) for details.

Built by [SideSkripts Technologies](https://github.com/Dubemernest23).