# Railway Deployment Guide - KhataBot

## Quick Start

1. ✅ Repository is pushed to https://github.com/wododigital/khatabot
2. Railway will auto-deploy when you push new commits
3. Copy the environment variables below into Railway project settings

---

## Environment Variables to Paste in Railway

Go to your Railway project → **Variables** → Add these environment variables:

### **Supabase Configuration**

```
NEXT_PUBLIC_SUPABASE_URL=https://vzmbhbojtovuakngxlzl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Your Supabase Anon Key>
SUPABASE_SERVICE_ROLE_KEY=<Your Supabase Service Role Key>
```

See `.env.local` in the repository for actual values.

### **Anthropic / Claude API**

```
ANTHROPIC_API_KEY=<Your Anthropic API Key>
CLAUDE_MODEL=claude-haiku-4-5
MIN_CONFIDENCE_THRESHOLD=0.5
```

See `.env.local` in the repository for actual values.

### **Bot Configuration**

```
BOT_SESSION_ID=khatabot-primary
MONITORED_GROUPS=
AI_CONCURRENCY_LIMIT=3
```

### **Application Settings**

```
NEXT_PUBLIC_APP_URL=https://your-railway-app-url.railway.app
NODE_ENV=production
LOG_LEVEL=info
```

---

## Step-by-Step Instructions for Railway

### 1. Go to Railway Project Settings

- Open https://railway.app/dashboard
- Select your KhataBot project
- Click **Variables** in the left sidebar

### 2. Add Variables

Copy each variable name and value from above into Railway:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vzmbhbojtovuakngxlzl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` (the long one) |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` |
| `CLAUDE_MODEL` | `claude-haiku-4-5` |
| `MIN_CONFIDENCE_THRESHOLD` | `0.5` |
| `BOT_SESSION_ID` | `khatabot-primary` |
| `AI_CONCURRENCY_LIMIT` | `3` |
| `NODE_ENV` | `production` |
| `LOG_LEVEL` | `info` |

### 3. Deploy Services

Railway will auto-create two services from `railway.toml`:

**Service 1: khatabot-web** (Next.js Dashboard)
- Port: 3000
- Command: `npm run start`
- Purpose: Dashboard UI + API routes

**Service 2: khatabot-bot** (WhatsApp Bot)
- Long-running process
- Command: `npm run bot:start`
- Purpose: Baileys listener + Claude extraction

### 4. First Deployment Checklist

After Railway deploys:

- [ ] Web service running on Railway domain (e.g., `https://khatabot-web.railway.app`)
- [ ] Bot service running (check logs for "WhatsApp bot started")
- [ ] QR code appears in bot logs (scan with phone)
- [ ] Dashboard accessible at web service URL
- [ ] Can login with phone + password
- [ ] Test transaction creation from WhatsApp group

### 5. Monitor Deployments

Go to **Deployments** tab to:
- View build logs
- Check service status
- Redeploy if needed
- View environment variable usage

---

## Database Setup

Before first deployment, set up Supabase:

### 1. Create Tables

In Supabase SQL Editor, run:
```sql
-- Copy entire contents of supabase/migrations/001_initial_schema.sql
-- Paste and execute
```

### 2. Add Bot Status Fields

```sql
-- Copy entire contents of supabase/migrations/002_add_bot_status_fields.sql
-- Paste and execute
```

### 3. Enable Auth

In Supabase → Authentication:
- Enable "Email" provider (for testing)
- Enable "Phone" provider (for production)
- Set site URL: https://your-railway-app-url.railway.app

---

## First Run: Scanning QR Code

1. **Bot starts** → Generates QR code
2. **Logs show QR** → Check Railway logs for QR code
3. **Scan QR** → Use WhatsApp on your linked phone
4. **Bot connects** → Logs show "WhatsApp bot connected"
5. **Send message** → Send a payment message to monitored group
6. **Dashboard updates** → Transaction appears in Supabase + web UI

---

## Monitoring

### Check Bot Status
```
GET https://your-app.railway.app/api/bot-status
```

Expected response:
```json
{
  "connected": true,
  "lastMessageAt": "2026-03-07T10:30:00Z",
  "sessionId": "khatabot-primary",
  "messagesProcessed": 42,
  "uptimeSeconds": 3600
}
```

### Check QR Code
```
GET https://your-app.railway.app/api/qr
```

Returns QR code as PNG image (when pending connection).

---

## Troubleshooting

### Bot not connecting
- Check SUPABASE_SERVICE_ROLE_KEY is correct
- Check BOT_SESSION_ID matches env var
- Look for QR in logs: `npm run bot:start`

### Dashboard 500 error
- Check NEXT_PUBLIC_SUPABASE_URL and ANON_KEY
- Ensure Supabase auth is enabled
- Check RLS policies in Supabase

### Claude API errors
- Verify ANTHROPIC_API_KEY is valid
- Check API usage at https://console.anthropic.com
- Verify MIN_CONFIDENCE_THRESHOLD is 0.0-1.0

### No transactions appearing
- Check bot is connected (monitor: /api/bot-status)
- Verify group is registered in dashboard (/groups)
- Check MONITORED_GROUPS env var (or manage via UI)
- View bot logs for extraction errors

---

## Cost Estimate (Monthly)

| Service | Cost |
|---------|------|
| Claude Haiku API (~300 extractions) | ~₹40-50 |
| Supabase (free tier) | ₹0 |
| Railway (Starter, 2 services) | ~₹425-850 |
| Domain (optional) | ~₹65 |
| **Total** | **~₹500-950** |

---

## Next Steps

1. ✅ Push to GitHub (DONE)
2. Paste variables in Railway project settings
3. Run Supabase migrations (001 + 002)
4. Enable Supabase Auth
5. Wait for Railway auto-deployment
6. Scan QR code with WhatsApp
7. Send test transaction message
8. View in dashboard

**Dashboard URL:** https://your-railway-app.railway.app/auth/login

---

## Variables Summary (Copy-Paste)

### All Variables (with placeholders):
```
NEXT_PUBLIC_SUPABASE_URL=https://vzmbhbojtovuakngxlzl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Paste from .env.local>
SUPABASE_SERVICE_ROLE_KEY=<Paste from .env.local>
ANTHROPIC_API_KEY=<Paste from .env.local>
CLAUDE_MODEL=claude-haiku-4-5
MIN_CONFIDENCE_THRESHOLD=0.5
BOT_SESSION_ID=khatabot-primary
MONITORED_GROUPS=
AI_CONCURRENCY_LIMIT=3
NODE_ENV=production
LOG_LEVEL=info
NEXT_PUBLIC_APP_URL=https://your-railway-app-url.railway.app
```

**⚠️ For actual values, see the `.env.local` file in the repository (not committed)**

---

## Support

If issues arise:
1. Check Railway logs (Deployments tab)
2. Check Supabase logs (SQL Editor)
3. Verify all env vars are set
4. Check API key validity (Anthropic console)
5. Monitor bot status: `/api/bot-status`
