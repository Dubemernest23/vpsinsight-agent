# VPSInsight — Product Requirements Document

**Version:** 1.0  
**Author:** SideSkripts Technologies  
**Status:** Draft  
**Last Updated:** May 2026

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [System Architecture](#4-system-architecture)
5. [Components](#5-components)
   - 5.1 [VPSInsight Agent](#51-vpsinsight-agent)
   - 5.2 [VPSInsight Dashboard](#52-vpsinsight-dashboard)
   - 5.3 [Alert & Notification Service](#53-alert--notification-service)
6. [Features & Requirements](#6-features--requirements)
7. [Data & API Specification](#7-data--api-specification)
8. [Alert Thresholds & Notification Rules](#8-alert-thresholds--notification-rules)
9. [Security Model](#9-security-model)
10. [Setup & Deployment Guide](#10-setup--deployment-guide)
11. [Tech Stack](#11-tech-stack)
12. [Project Structure](#12-project-structure)
13. [Roadmap](#13-roadmap)
14. [Out of Scope (v1)](#14-out-of-scope-v1)

---

## 1. Product Overview

**VPSInsight** is a lightweight, self-hosted VPS monitoring and alerting tool built for developers who manage one or more virtual private servers. It consists of a small agent installed on each server, a central visual dashboard for real-time stats, and an alerting service that notifies users when something goes wrong — before it becomes a real problem.

VPSInsight is designed to be:
- **Distributable** — clone, configure, and run on any VPS in under 5 minutes
- **Reusable** — one dashboard can monitor multiple servers simultaneously
- **Lightweight** — the agent uses minimal resources and does not impact hosted applications
- **Developer-first** — built and customisable by developers, not locked behind a SaaS paywall

---

## 2. Problem Statement

Developers hosting projects on VPS servers often have no visibility into what is happening on their server unless something breaks. By the time a site goes down or a server runs out of memory, it is already too late. Existing tools like Netdata, Datadog, or UptimeRobot are either too heavy, too expensive, or not self-hosted.

VPSInsight fills this gap — a simple, owned, open-source-friendly tool that gives developers real-time awareness and early warning alerts for their servers.

---

## 3. Goals & Success Metrics

### Goals
- Give developers real-time visibility into CPU, RAM, disk, and network usage
- Alert users before problems escalate (target: catch issues before they cause downtime)
- Be simple enough for a developer to install on a new VPS in under 5 minutes
- Support monitoring of multiple servers from a single dashboard
- Target **95%+ uptime** for monitored servers by enabling proactive responses

### Success Metrics
| Metric | Target |
|---|---|
| Agent install time | < 5 minutes on a fresh VPS |
| Agent memory footprint | < 40MB RAM at idle |
| Dashboard polling latency | < 1 second from stat change to display |
| Alert delivery time (email) | < 60 seconds from threshold breach |
| Uptime improvement | 95%+ for monitored servers |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MONITORED SERVERS                    │
│                                                             │
│  ┌──────────────────┐   ┌──────────────────┐               │
│  │  VPS 1 (Hostinger│   │  VPS 2 (Friend's)│  ...          │
│  │  Agent :4000     │   │  Agent :4000     │               │
│  └────────┬─────────┘   └────────┬─────────┘               │
└───────────┼──────────────────────┼─────────────────────────┘
            │  HTTPS + Token Auth  │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     VPSINSIGHT DASHBOARD                    │
│                                                             │
│   React Frontend  ◄──── polls /stats every 5s ────────►    │
│   Multi-server view, charts, alerts config                  │
│                                                             │
│   ┌───────────────────────────────────────────────────┐     │
│   │            ALERT ENGINE (Node.js)                 │     │
│   │  Evaluates thresholds → triggers notifications    │     │
│   │  Email via Resend  |  Webhook  |  In-app alert    │     │
│   └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────┐
│   User's Inbox /    │
│   Webhook / Browser │
│   Notification      │
└─────────────────────┘
```

**Flow summary:**
1. Agent runs on each VPS, exposes a secured `/stats` endpoint
2. Dashboard polls each agent every 5 seconds and renders live stats
3. Alert engine evaluates each poll response against configured thresholds
4. When a threshold is breached, notifications are sent via email and/or webhook
5. If an agent stops responding, a downtime alert fires immediately

---

## 5. Components

### 5.1 VPSInsight Agent

A minimal Express.js application installed on each monitored VPS. It has one job: collect system metrics and serve them securely via HTTP.

**Responsibilities:**
- Read real-time CPU, RAM, disk, network, and process stats using `systeminformation`
- Expose a single `GET /stats` endpoint
- Authenticate requests using a bearer token
- Respond in a consistent JSON schema regardless of OS or VPS provider
- Run as a persistent background process via PM2

**Design principles:**
- No database, no state, no heavy dependencies
- Stateless — every request reads fresh data
- Single file entry point for simplicity

---

### 5.2 VPSInsight Dashboard

A React single-page application that connects to one or more agents and presents stats visually.

**Responsibilities:**
- Manage a list of configured servers (name, URL, token)
- Poll each server's `/stats` endpoint on a configurable interval (default: 5s)
- Display live and historical (in-session) metrics as charts and stat cards
- Show per-app process status for Node.js applications running on each server
- Visually indicate server health (green / warning / down)
- Allow users to configure alert thresholds per server
- Show an in-dashboard notification feed for recent alerts

**Design principles:**
- No backend required — runs entirely in the browser
- Server configs stored in `localStorage` (no account needed)
- Mobile-responsive for quick checks on the go

---

### 5.3 Alert & Notification Service

A lightweight engine — either embedded in the dashboard backend or run as a standalone Node.js process — that evaluates metric thresholds and fires notifications.

**Responsibilities:**
- Poll each agent at a defined interval (can differ from dashboard interval)
- Compare metrics against user-defined thresholds
- Debounce alerts — do not fire repeatedly for the same sustained breach
- Send email notifications via **Resend**
- Support webhook callbacks (Slack, Discord, or custom)
- Detect agent downtime (missed responses) and fire a critical alert
- Log all alert events with timestamps

**Alert types:**

| Alert | Trigger | Severity |
|---|---|---|
| High CPU | CPU usage > threshold (default 85%) for 60s | Warning |
| Critical CPU | CPU usage > 95% for 30s | Critical |
| High Memory | RAM usage > threshold (default 80%) | Warning |
| Disk Space Low | Disk usage > threshold (default 85%) | Warning |
| Disk Space Critical | Disk usage > 95% | Critical |
| Server Unreachable | Agent does not respond for 2 consecutive polls | Critical |
| Server Recovered | Agent responds again after downtime | Info |
| App Process Down | A monitored Node.js process is no longer running | Critical |
| App Process Recovered | Monitored process is running again | Info |

---

## 6. Features & Requirements

### 6.1 Core Features (v1)

| Feature | Description | Priority |
|---|---|---|
| Real-time CPU display | Live CPU usage percentage with sparkline chart | Must have |
| RAM monitoring | Used / total / percentage with chart | Must have |
| Disk usage | Used / total / percentage per mount | Must have |
| Network I/O | Bytes in/out per second | Must have |
| Server uptime | Time since last reboot | Must have |
| Multi-server support | Switch between or view all servers in one dashboard | Must have |
| App process monitoring | List running Node.js processes with PID, memory, status | Must have |
| Token-based auth | Secure agent endpoint with bearer token | Must have |
| Email alerts | Notify on threshold breach or downtime | Must have |
| In-dashboard alerts | Alert feed showing recent events | Must have |
| Server health indicator | Visual green/amber/red status per server | Must have |
| Configurable thresholds | User sets their own CPU/RAM/disk alert limits | Must have |
| Webhook notifications | POST to a Slack or Discord webhook on alert | Should have |
| Historical charts | In-session metric history (last 30 minutes) | Should have |
| Dark mode UI | Default dark theme, toggleable light mode | Should have |

### 6.2 Agent Requirements

- Must start on boot automatically (via PM2)
- Must not consume more than 40MB RAM idle
- Must respond to `/stats` within 500ms under normal load
- Must support Node.js 18+
- Must work on Ubuntu 20.04+, Debian 11+

### 6.3 Dashboard Requirements

- Must work in Chrome, Firefox, Safari (latest 2 versions)
- Must be responsive down to 375px width
- Must gracefully handle agent unreachability (show last known stats + warning)
- Must not require a login for personal single-user use
- Server configs must persist across browser sessions

---

## 7. Data & API Specification

### Agent Endpoint

```
GET /stats
Authorization: Bearer <token>
```

### Response Schema

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
    },
    {
      "name": "notribank-api",
      "pid": 1235,
      "status": "running",
      "cpu": 0.8,
      "memory": 98400000,
      "uptime": 216000
    }
  ],
  "timestamp": "2026-05-24T10:30:00.000Z"
}
```

### Health Check Endpoint

```
GET /health
```

Returns `200 OK` with `{ "status": "ok" }` — used by the alert engine to detect downtime without requiring auth.

---

## 8. Alert Thresholds & Notification Rules

### Default Thresholds (user-configurable)

| Metric | Warning | Critical |
|---|---|---|
| CPU usage | 85% for 60s | 95% for 30s |
| Memory usage | 80% | 90% |
| Disk usage | 85% | 95% |
| Agent response | — | No response for 2 polls |

### Notification Rules

- **Debounce:** An alert fires once when a threshold is first breached. It does not re-fire unless the metric recovers and breaches again.
- **Recovery alert:** When a metric drops below threshold, a recovery notification is sent.
- **Downtime detection:** If the agent `/health` endpoint does not respond for 2 consecutive polls (default poll: 30s), a critical downtime alert fires.
- **Cooldown:** After a critical alert, a minimum 10-minute cooldown before the same alert fires again.
- **Email digest:** Optionally, instead of individual emails, send a daily summary of all alert events.

### Email Notification Template (example)

```
Subject: [CRITICAL] VPSInsight — vps-hostinger-1 is unreachable

Your server vps-hostinger-1 (xxx.xxx.xxx.xxx) has not responded
for the past 60 seconds.

Time detected:  2026-05-24 10:30:00 UTC
Last seen:      2026-05-24 10:28:55 UTC
Status:         UNREACHABLE

Log in to your VPSInsight dashboard to investigate.
```

---

## 9. Security Model

| Layer | Mechanism |
|---|---|
| Agent authentication | Bearer token in `Authorization` header. Requests without a valid token return `401`. |
| Token storage | Token stored in `.env` on the VPS, never logged or exposed in responses. |
| Dashboard to agent | HTTPS recommended in production. HTTP acceptable on private networks only. |
| Dashboard config | Server URLs and tokens stored in browser `localStorage`. No cloud sync. |
| Health endpoint | `/health` is unauthenticated — returns only `{ status: ok }` with no metric data. |
| Rate limiting | Agent applies basic rate limiting (max 60 requests/min per IP) to prevent abuse. |

**Token generation recommendation:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 10. Setup & Deployment Guide

### Prerequisites

- Node.js 18+ installed on the VPS
- PM2 installed globally: `npm install -g pm2`
- Git installed

---

### Step 1 — Install the Agent on a VPS

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Clone the agent
git clone https://github.com/sideskripts/vpsinsight-agent.git
cd vpsinsight-agent

# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env
```

Set the following in `.env`:
```env
PORT=4000
TOKEN=your-generated-secret-token
MONITORED_APPS=krakeen-api,notribank-api
```

`MONITORED_APPS` is a comma-separated list of PM2 process names you want tracked.

```bash
# Start the agent with PM2
pm2 start index.js --name vpsinsight-agent

# Save PM2 config so it restarts on server reboot
pm2 save
pm2 startup
```

The agent is now running at `http://YOUR_VPS_IP:4000`.

**Optional — open port 4000 in your firewall:**
```bash
ufw allow 4000
```

**Verify it works:**
```bash
curl -H "Authorization: Bearer your-token" http://localhost:4000/stats
```

---

### Step 2 — Deploy the Dashboard

**Option A — Vercel (recommended, free)**
```bash
git clone https://github.com/sideskripts/vpsinsight-dashboard.git
cd vpsinsight-dashboard
npm install
```

Push to GitHub and connect to Vercel. Done.

**Option B — Self-host on VPS**
```bash
npm run build
pm2 serve dist 3001 --name vpsinsight-dashboard --spa
```

Dashboard is now accessible at `http://YOUR_VPS_IP:3001`.

---

### Step 3 — Configure the Dashboard

1. Open the dashboard in your browser
2. Click **Add Server**
3. Enter:
   - **Name:** e.g. `Hostinger VPS`
   - **URL:** `http://YOUR_VPS_IP:4000`
   - **Token:** your secret token
4. Click **Connect** — the server card appears with live stats

Repeat for every VPS you want to monitor.

---

### Step 4 — Configure Alerts

1. In the dashboard, open **Settings → Alerts** for a server
2. Set your thresholds for CPU, RAM, and disk
3. Enter your email address under **Notifications**
4. Optionally add a Slack/Discord webhook URL
5. Save — the alert engine begins monitoring immediately

---

### Step 5 — Add a Second VPS (repeat for any server)

```bash
# SSH into the new VPS
ssh user@new-vps-ip

# Same steps as Step 1 with a different token
git clone https://github.com/sideskripts/vpsinsight-agent.git
cd vpsinsight-agent
npm install
cp .env.example .env
# Edit .env with a new token
pm2 start index.js --name vpsinsight-agent
pm2 save
```

Then add it in the dashboard under **Add Server**.

---

## 11. Tech Stack

### Agent
| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 18+ | Consistent with existing stack |
| Framework | Express.js | Minimal, familiar |
| Metrics library | `systeminformation` | Cross-platform, comprehensive |
| Process manager | PM2 | Industry standard for Node.js on VPS |
| Auth | Bearer token (custom middleware) | Simple, stateless |

### Dashboard
| Layer | Choice | Reason |
|---|---|---|
| Framework | React + Vite | Fast, modern, familiar |
| Styling | Tailwind CSS | Rapid UI, consistent design |
| Charts | Recharts | Lightweight, React-native charting |
| State | React Context + useState | No need for Redux at this scale |
| Storage | localStorage | No backend required for config |

### Alert Engine
| Layer | Choice | Reason |
|---|---|---|
| Email | Resend | Already in your stack (Krakeen) |
| Webhooks | Native fetch | No extra dependency |
| Scheduling | setInterval in Node.js | Simple, sufficient for polling |

---

## 12. Project Structure

```
vpsinsight-agent/
├── index.js              # Entry point, Express server
├── src/
│   ├── metrics.js        # systeminformation data collection
│   ├── auth.js           # Token middleware
│   └── processes.js      # PM2 process monitoring
├── .env.example
├── package.json
└── README.md

vpsinsight-dashboard/
├── src/
│   ├── components/
│   │   ├── ServerCard.jsx       # Per-server stat summary card
│   │   ├── CPUChart.jsx         # Real-time CPU sparkline
│   │   ├── MemoryChart.jsx      # RAM usage chart
│   │   ├── DiskUsage.jsx        # Disk bar display
│   │   ├── NetworkIO.jsx        # Network in/out stats
│   │   ├── ProcessList.jsx      # Node.js process status table
│   │   ├── AlertFeed.jsx        # In-dashboard alert log
│   │   └── AddServerModal.jsx   # Server configuration form
│   ├── services/
│   │   ├── poller.js            # Polling logic per server
│   │   └── alerts.js            # Threshold evaluation + notifications
│   ├── store/
│   │   └── servers.js           # Server config and stats state
│   ├── App.jsx
│   └── main.jsx
├── public/
├── index.html
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## 13. Roadmap

### v1 — Core (current scope)
- Agent with full metrics endpoint
- Multi-server dashboard
- Real-time charts and stats
- Email + webhook alerts
- Configurable thresholds

### v2 — Enhanced Monitoring
- Persistent metric history (SQLite on agent)
- 24-hour / 7-day trend charts
- Slack app integration (interactive alerts)
- SMS alerts via Termii
- Agent auto-update script

### v3 — Product Polish
- Public status page per server (shareable URL)
- Dashboard authentication (password-protect the dashboard)
- Docker support for agent deployment
- Mobile app (React Native) for on-the-go monitoring
- Team access — share a dashboard with multiple users

---

## 14. Out of Scope (v1)

- Database persistence for historical metrics (v2)
- User account system or cloud sync
- Agent support for non-Linux systems (Windows Server)
- Automated server remediation (e.g. auto-restart crashed processes)
- Billing or SaaS packaging
- Docker or Kubernetes monitoring

---

*VPSInsight is a SideSkripts Technologies open project. Built for developers, by a developer.*
