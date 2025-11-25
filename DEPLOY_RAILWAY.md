# Deploy to Railway - Quick Guide

## Prerequisites
1. GitHub account
2. Railway account (https://railway.app)

## Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

## Step 2: Deploy on Railway

### Option A: Using Railway Website
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Select your repository: `mike4812/tradovate_playwrite`
5. Railway will automatically detect the Dockerfile

### Option B: Using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

## Step 3: Set Environment Variables
In Railway dashboard, go to your project → Variables → Add these:

```
ADMIN_PASSWORD=Argaman148!
SESSION_SECRET=a75c88b9e486a60e1ed9e80a18bef7834c5857fa70f8b963884519a02e7fa716
NODE_ENV=production
HEADLESS=true
PORT=3000
```

## Step 4: Access Your App
- Railway will give you a URL like: `https://your-app.up.railway.app`
- Login with password: `Argaman148!`

## Important Notes
- ⚠️ Railway free tier has limited hours per month
- 💾 Sessions are stored in memory/filesystem - they will reset on redeploy
- 🔒 Make sure `.env` is in `.gitignore` (already done)
- 📊 Check logs in Railway dashboard for any issues

## Troubleshooting
If deployment fails:
1. Check Railway logs
2. Verify all environment variables are set
3. Make sure Dockerfile is in root directory
4. Check that `config/accounts.json` exists

## Cost
- Free tier: $5 credit/month
- Your app will use ~100-200MB RAM
- Should stay within free tier limits
