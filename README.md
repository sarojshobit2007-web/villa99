# SaGa Montana — Deployment Guide

This guide walks you through everything from zero to a live website. Follow each step in order.

---

## What You Need (Free Accounts)

Before starting, create these accounts:

1. **Supabase** — Your database (stores booking dates)
   - Go to https://supabase.com and sign up
2. **Vercel** — Your hosting (runs the website)
   - Go to https://vercel.com and sign up with your GitHub account
3. **GitHub** — Where your code lives
   - Go to https://github.com and sign up if you don't have an account

---

## Step 1: Create a Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - **Organization**: Create one if you don't have one (click "Create organization")
   - **Project name**: `villa99`
   - **Database password**: Type a strong password and **save it somewhere safe**
   - **Region**: Choose `Asia` (Mumbai) or closest to your users
4. Click **"Create new project"**
5. Wait 1-2 minutes for it to finish setting up

---

## Step 2: Create the Database Table

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Paste this entire block and click **"Run"** (the play button):

```sql
CREATE TABLE availability (
  id int PRIMARY KEY DEFAULT 1,
  booked_dates text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Add your existing booked dates (edit or remove this line if needed)
INSERT INTO availability (id, booked_dates)
VALUES (1, ARRAY['2026-07-25', '2026-07-26']);
```

4. In the same SQL Editor, run this block to create the gallery table (stores the site's photos):

```sql
CREATE TABLE gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

You should see "Success. No rows returned" after each block.

> The photo files themselves are stored in a Supabase Storage bucket named `gallery`. It is created automatically the first time the owner uploads a photo.

---

## Step 3: Get Your Supabase Keys

You need two things from Supabase: a **URL** and a **Secret Key**.

### Finding the Project URL

1. In your Supabase dashboard, look at the top of your project's main page
2. You'll see **"Project URL"** — it looks like `https://xxxxxxxx.supabase.co`
3. Copy this

**OR** click the **connect** button (plug icon) at the top of the dashboard — it shows the URL there too.

### Finding the Secret Key

1. In the Supabase dashboard, go to **Project Settings** (click the gear icon in the left sidebar)
2. Click **"API keys"** in the left menu
3. You'll see two keys:
   - **Publishable key** — we do NOT need this
   - **Secret key** — click the eye icon to reveal it. This is what we need. It looks like a long `eyJ...` string.

**Save both the URL and the Secret Key. You'll need them in Step 6.**

> Never share the Secret Key publicly. It has full access to your database.

---

## Step 4: Push Your Code to GitHub

Open **Terminal** on your Mac. Run these commands one by one:

```bash
cd ~/Desktop/villa99/demo-4
git init
git add .
git commit -m "initial commit"
```

Then create a repository on GitHub:

1. Go to https://github.com/new
2. **Repository name**: `villa99`
3. Keep it **Public** or **Private** (your choice)
4. Click **Create repository**
5. GitHub will show you commands. Copy and run the "push an existing repository" ones. They look like:

```bash
git remote add origin https://github.com/YOUR_USERNAME/villa99.git
git branch -M main
git push -u origin main
```

---

## Step 5: Generate Your Secrets

Open Terminal and run this command to generate a secure random string:

```bash
openssl rand -base64 48
```

Copy the output somewhere. This is your **JWT_SECRET**.

Run it again:

```bash
openssl rand -base64 48
```

Copy this output too. This is your **CSRF_SECRET**.

Now generate the owner password hash. Replace `YOUR_PASSWORD_HERE` with the password you want to use to log in as owner (for example, your phone number or any password you'll remember):

```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('YOUR_PASSWORD_HERE',12))"
```

The output will start with `$2a$12$...` — copy the ENTIRE output. This is your **OWNER_PASSWORD_HASH**.

**Remember the password you used — you'll need it to log in to the owner panel.**

> **Important:** Make sure all quotes in the command above are straight quotes (`'`), not curly quotes (`'` `'`). If you get a syntax error, type the command fresh in a new terminal line.

---

## Step 6: Deploy to Vercel

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Select your `villa99` repository
4. **Do NOT deploy yet** — click **"Environment Variables"** first
5. Add these variables one by one (click "Add" after each):

| Name | Value |
|------|-------|
| `SUPABASE_URL` | Your Project URL from Step 3 (e.g. `https://xxxxxxxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Your Secret Key from Step 3 (the long `eyJ...` string) |
| `OWNER_PASSWORD_HASH` | The bcrypt hash from Step 5 (starts with `$2a$`) |
| `JWT_SECRET` | First random string from Step 5 |
| `CSRF_SECRET` | Second random string from Step 5 |
| `CORS_ORIGIN` | `https://YOUR_PROJECT.vercel.app` (replace with your actual Vercel URL — you'll see it after the first deploy) |

6. Click **"Deploy"**
7. Wait 2-3 minutes for the build to finish
8. After deploy finishes, copy the URL Vercel gives you (e.g. `villa99-xxxx.vercel.app`) and update `CORS_ORIGIN` with `https://` + that URL, then redeploy

---

## Step 7: Test It

1. Open your Vercel URL in your browser — you should see the SaGa Montana website
2. Scroll down to **"Book Your Stay"** and try selecting dates on the calendar
3. To test the owner login:
   - Scroll to the footer and click the owner login
   - Enter the password you set in Step 5
   - You should see the Availability Manager panel

---

## Step 8: Set Up Your Custom Domain (Optional)

If you have a domain name (like `sagamontana.com`):

1. In Vercel, go to your project → **"Settings"** → **"Domains"**
2. Type your domain name and click **"Add"**
3. Vercel will give you DNS records to add at your domain registrar
4. Go to your domain registrar (GoDaddy, Namecheap, etc.) and add those DNS records
5. Wait up to 24 hours for DNS to propagate (usually much faster)
6. After your custom domain works, update `CORS_ORIGIN` to use your custom domain and redeploy

---

## How to Update Booked Dates

### Option A: Using the Owner Panel
1. Go to your website
2. Scroll to the footer, click the owner login
3. Enter your password
4. Click dates on the calendar to select them
5. Click **"Mark as Booked"** or **"Mark as Available"**
6. Click **"Save Changes"**

### Option B: Using the Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"Table Editor"** in the left sidebar
4. Click on the `availability` table
5. Edit the `booked_dates` cell directly

---

## How to Change Your Owner Password

1. Generate a new hash:

```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('NEW_PASSWORD',12))"
```

2. Go to Vercel → your project → **Settings** → **Environment Variables**
3. Update `OWNER_PASSWORD_HASH` with the new hash
4. Redeploy (Vercel → Deployments → click "..." on latest → "Redeploy")

---

## Troubleshooting

**"API is not configured" error on the website:**
- You forgot an environment variable. Go to Vercel → Settings → Environment Variables and make sure all 6 are set.

**Login returns 403 Forbidden:**
- Your `CORS_ORIGIN` doesn't match your website URL. Make sure it's set to `https://YOUR_PROJECT.vercel.app` (with `https://` and no trailing slash).

**Login returns 401 Invalid credentials:**
- Your `OWNER_PASSWORD_HASH` doesn't match your password. Regenerate it with the node command in Step 5 and update the env var.

**Calendar shows no dates / always available:**
- Check that your Supabase table was created correctly. Go to Table Editor → `availability` and verify the row exists.

**Deployment fails:**
- Check the build logs in Vercel. The most common issue is a missing environment variable.

---

## Environment Variables Reference

| Variable | Where to Get It | Required |
|----------|----------------|----------|
| `SUPABASE_URL` | Supabase project page → Project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API keys → Secret key | Yes |
| `OWNER_PASSWORD_HASH` | Generated with bcrypt (see Step 5) | Yes |
| `JWT_SECRET` | Generated with `openssl rand -base64 48` | Yes |
| `CSRF_SECRET` | Generated with `openssl rand -base64 48` | Yes |
| `CORS_ORIGIN` | `https://YOUR_PROJECT.vercel.app` | Yes |
