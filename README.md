# Rugplay Enhanced API

The backend API for Rugplay Enhanced. Runs entirely on Cloudflare's free tier.

## Stack

- Cloudflare Workers (serverless runtime)
- Cloudflare D1 (SQLite database)
- Cloudflare KV (key-value store)
- TypeScript

## Prerequisites

- A free Cloudflare account at cloudflare.com
- Node.js installed on your machine
- Git installed on your machine

## Deploy Instructions

### Step 1 — Install Wrangler

```bash
npm install -g wrangler
```

### Step 2 — Login to Cloudflare

```bash
wrangler login
```

This opens your browser. Log in with your Cloudflare account.

### Step 3 — Clone and install dependencies

```bash
git clone https://github.com/devbyego/rugplay-enhanced-api
cd rugplay-enhanced-api
npm install
```

### Step 4 — Create the D1 database

```bash
wrangler d1 create rugplay-enhanced-db
```

Copy the `database_id` from the output and paste it into `wrangler.toml` replacing `REPLACE_WITH_YOUR_D1_ID`.

### Step 5 — Create the KV namespace

```bash
wrangler kv namespace create KV
```

Copy the `id` from the output and paste it into `wrangler.toml` replacing `REPLACE_WITH_YOUR_KV_ID`.

### Step 6 — Run the database schema

```bash
npm run db:init:remote
```

### Step 7 — Set your admin secret

```bash
wrangler secret put ADMIN_SECRET
```

Enter a strong secret key when prompted. Save this somewhere safe — you will need it to manage reports, tags, and changelogs.

### Step 8 — Deploy

```bash
npm run deploy
```

Your API is now live at `https://rugplay-enhanced-api.YOUR_SUBDOMAIN.workers.dev`.

## API Reference

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/reports` | Get approved reports. Supports `?page=`, `?limit=`, `?symbol=`, `?username=` |
| POST | `/v1/reports/submit` | Submit a new report |
| POST | `/v1/reports/vote` | Vote on a report |
| POST | `/v1/reports/delete` | Delete a report (admin only) |

### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/tags` | Get all user tags |
| GET | `/v1/tags/user?username=` | Get tag for a specific user |
| GET | `/v1/tags/styles` | Get all available tag styles |
| POST | `/v1/tags/set` | Set a user tag (admin only) |
| POST | `/v1/tags/remove` | Remove a user tag (admin only) |

### Update / Changelog

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/update` | Get latest version string |
| POST | `/v1/update/push` | Set latest version (admin only) |
| GET | `/v1/changelog` | Get changelog for latest or `?version=` |
| GET | `/v1/changelog/all` | Get all changelogs |
| POST | `/v1/changelog/push` | Push a new changelog entry (admin only) |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/analytics` | Track an event (`install` or `active_session`) |
| GET | `/v1/analytics/stats` | Get stats (admin only) |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/health` | Health check |

## Admin Authentication

All admin endpoints require the header:

```
X-Admin-Secret: YOUR_SECRET
```

## Privacy

This API stores no usernames, no IP addresses, and no personal identifiers. IP addresses are one-way hashed before any comparison and never stored. Analytics only count events by day — no user profiling of any kind.

## Local Development

```bash
npm run dev
```
