# VPSInsight Agent

Lightweight, self-hosted VPS monitoring agent. Collects real-time system and process metrics and exposes a secured HTTP endpoint for dashboards and alerting engines.

This is the **agent** component of the VPSInsight project. For the full product requirements, see [VPSInsight_PRD.md](VPSInsight_PRD.md).

> **Dashboard repo:** `vpsinsight-dashboard` — coming soon.

---

## Contents

- [Quickstart](#1-quickstart)
- [Environment Variables](#2-environment-variables)
- [API Reference](#3-api-reference)
- [Alert Thresholds](#4-alert-thresholds)
- [Security](#5-security)
- [Running with PM2](#6-running-with-pm2)
- [Dashboard Integration](#7-dashboard-integration)
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
| `VPSInsight_PRD.md` | Product Requirements Document |
| `.env.example` | Environment variable template |

---

## 1. Quickstart

### Prerequisites

- Node.js 18+
- PM2 installed globally — `npm install -g pm2`
- Git

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

Open port `4000` in your firewall if needed:

```bash
sudo ufw allow 4000
```

Verify the agent is running:

```bash
curl -H "Authorization: Bearer your-token" http://localhost:4000/stats
```

---

## 2. Environment Variables

Create `.env` from `.env.example` and set the following:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port the agent listens on (default: `4000`) |
| `TOKEN` | Yes | Bearer token for authenticating `/stats` requests |
| `MONITORED_APPS` | Yes | Comma-separated PM2 process names to track |

Example `.env`:

```env
PORT=4000
TOKEN=your-generated-secret-token
MONITORED_APPS=krakeen-api,notribank-api
```

Generate a secure token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. API Reference

The agent exposes two endpoints.

### `GET /health`

Unauthenticated. Used by the alert engine to check reachability.

```bash
curl http://YOUR_VPS_IP:4000/health
```

```json
{ "status": "ok" }
```

---

### `GET /stats`

Requires `Authorization: Bearer <TOKEN>`. Returns full system and process metrics.

```bash
curl -H "Authorization: Bearer <TOKEN>" http://YOUR_VPS_IP:4000/stats
```

**Response schema:**

```json
{
  "server": {
    "hostname": "vps-hostinger-1",
    "platform": "linux",
    "distro": "Ubuntu 22.04",
    "uptime": 864000
  },
  "cpu": {
    "usage": 23.4,
    "cores": 1,
    "model": "Intel Xeon E5-2676 v3",
    "speed": 2400
  },
  "memory": {
    "total": 3145728000,
    "used": 1887436800,
    "free": 1258291200,
    "percentage": 59.9
  },
  "disk": [
    {
      "mount": "/",
      "total": 21474836480,
      "used": 8589934592,
      "free": 12884901888,
      "percentage": 40.0
    }
  ],
  "network": {
    "interface": "eth0",
    "rx_sec": 12400,
    "tx_sec": 4800,
    "rx_total": 15728640000,
    "tx_total": 3145728000
  },
  "processes": [
    {
      "name": "krakeen-api",
      "pid": 1234,
      "status": "running",
      "cpu": 1.2,
      "memory": 145200000,
      "uptime": 432000
    }
  ],
  "timestamp": "2026-05-24T10:30:00.000Z"
}
```

**Field notes:**
- `server.uptime` — seconds since last reboot
- `memory`, `disk`, `process.memory` — values in bytes
- `processes` — only PM2 apps listed in `MONITORED_APPS` are reported

---

## 4. Alert Thresholds

Default thresholds used by the alert engine (configurable in the dashboard):

| Metric | Warning | Critical |
|---|---|---|
| CPU usage | 85% sustained for 60s | 95% sustained for 30s |
| Memory usage | 80% | 90% |
| Disk usage | 85% | 95% |
| Agent reachability | — | No `/health` response for 2 consecutive polls |

**Notification rules:**
- Alerts fire once on breach and only re-fire after recovery
- Recovery notifications sent when metric returns below threshold
- Minimum 10-minute cooldown before the same critical alert re-fires
- Downtime alert triggers after two consecutive missed `/health` polls

---

## 5. Security

- `/stats` requires a valid `Bearer` token — requests without it return `401`
- `/health` is intentionally unauthenticated and returns no metric data
- Store `TOKEN` in `.env` only — never commit it or log it
- In production, always use HTTPS between the dashboard and agents
- Rate limiting is applied — max 60 requests per minute per IP

---

## 6. Running with PM2

PM2 keeps the agent running and restarts it on server reboot.

```bash
# Start the agent
pm2 start index.js --name vpsinsight-agent

# Persist across reboots
pm2 save
pm2 startup

# Check status
pm2 status vpsinsight-agent

# Tail logs
pm2 logs vpsinsight-agent
```

---

## 7. Dashboard Integration

The dashboard is a separate React app (`vpsinsight-dashboard`) that polls `/stats`, visualises metrics, and drives the alert engine. It is coming soon.

In the meantime, you can build a custom viewer or integration using the `/stats` endpoint directly.

### Minimal viewer (no build step)

Save this as `viewer.html` and open in your browser. It polls `/stats` every 5 seconds and renders the raw JSON.

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>VPSInsight Viewer</title></head>
<body>
<pre id="out">Loading...</pre>
<script>
const SERVER_URL = 'http://YOUR_VPS_IP:4000';
const TOKEN = 'your-token-here';

async function fetchStats() {
  try {
    const res = await fetch(`${SERVER_URL}/stats`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    document.getElementById('out').textContent = JSON.stringify(await res.json(), null, 2);
  } catch (err) {
    document.getElementById('out').textContent = 'Error: ' + err.message;
  }
}

fetchStats();
setInterval(fetchStats, 5000);
</script>
</body>
</html>
```

### CORS

If your dashboard runs in a browser on a different origin, install and configure `cors`:

```bash
npm install cors
```

```js
const cors = require('cors');
app.use(cors({
  origin: ['https://your-dashboard-url.com'],
  methods: ['GET'],
  allowedHeaders: ['Authorization', 'Content-Type']
}));
```

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `401 Unauthorized` on `/stats` | Confirm `Authorization: Bearer <TOKEN>` header matches `.env` |
| `/stats` times out | Check firewall — ensure `PORT` is open and agent is running (`pm2 status`) |
| No processes listed | Confirm PM2 is installed and `MONITORED_APPS` matches exact PM2 process names |
| Agent using too much memory | Ensure Node.js 18+ is installed — agent should idle under ~40MB |

### Diagnostic commands

```bash
# Check agent process
pm2 status vpsinsight-agent

# Tail logs
pm2 logs vpsinsight-agent --lines 200

# Health check (no auth)
curl http://localhost:4000/health

# Stats check (auth required)
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

### Contributing

Open issues and PRs against this repository. Keep changes focused and follow existing code style.

---

## 10. Roadmap

**v2**
- Optional persistent metric history (SQLite)
- Extended 24-hour / 7-day trend charts
- Slack interactive alerts
- SMS notifications via Termii

**v3**
- Docker image for agent deployment
- Dashboard authentication
- Mobile app (React Native)

---

## 11. License

MIT — see [LICENSE](LICENSE) for details.

Built by [DUBY](https://github.com/Dubemernest23).