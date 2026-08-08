# Deploy the backend to the cloud (works from anywhere, PC off)

Result: the API + database run on the internet, so the phone app works on any
network with your PC turned off. Two free accounts needed: **MongoDB Atlas**
(database) and **Render** (API). ~15–20 min, mostly waiting.

Everything in the repo is already configured — you only click through the two
dashboards and paste one value.

---

## Step 1 — Database: MongoDB Atlas (free)

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a free cluster**: choose **M0 (Free)**, any provider/region near you,
   click **Create**.
3. **Database user**: Atlas prompts for a username + password (Security ▸
   *Database Access* if not). Create one — **remember the password**.
4. **Network access**: Security ▸ *Network Access* ▸ **Add IP Address** ▸
   **Allow access from anywhere** (`0.0.0.0/0`). *(Render's outbound IP isn't
   fixed on the free plan, so this is required.)*
5. **Get the connection string**: Cluster ▸ **Connect** ▸ **Drivers** ▸ copy the
   URI. It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `PASSWORD` with your real password, and add the database name
   `virtual_classroom` before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/virtual_classroom?retryWrites=true&w=majority
   ```
   Keep this — you paste it into Render in Step 3.

## Step 2 — Push the code to GitHub

Render deploys from a Git repo. The repo is **already initialised and committed**
(branch `main`, ~1.2 MB — node_modules, the APK, and Android build files are
git-ignored). You only create an empty GitHub repo and push:

1. On <https://github.com/new> create an **empty** repo named e.g.
   `virtual-classroom` (no README, no .gitignore).
2. From this project on your PC:
   ```bash
   cd ~/benjamin-help
   git remote add origin https://github.com/<you>/virtual-classroom.git
   git push -u origin main
   ```
   (GitHub will ask for your username + a Personal Access Token as the password —
   github.com ▸ Settings ▸ Developer settings ▸ Tokens if you don't have one.)

## Step 3 — API: Render (free)

1. Sign up at <https://render.com> (log in with GitHub — easiest).
2. **New ▸ Blueprint**, pick the repo you just pushed. Render finds
   [`render.yaml`](render.yaml) and shows the `virtual-classroom-api` service.
3. It will ask for the one secret value — **`MONGO_URI`** — paste the Atlas
   string from Step 1.
4. **Apply / Create**. First build takes a few minutes. When it's live you get a
   URL like:
   ```
   https://virtual-classroom-api.onrender.com
   ```
5. Check it works: open `https://virtual-classroom-api.onrender.com/api/health`
   in a browser — you should see `{"status":"ok",...}`. The demo accounts are
   seeded automatically on first boot.

## Step 4 — Point the app at it

**No rebuild needed** — in the app's login screen ▸ **Server settings**, enter
your Render URL (e.g. `https://virtual-classroom-api.onrender.com`) ▸ Save.
That's it — log in from anywhere, PC off.

*(Optional: tell me the URL and I'll bake it in as the APK's default so you don't
have to type it.)*

---

## Good to know

- **Free tier sleeps.** After ~15 min idle, the first request wakes the server —
  expect a slow first login (~30–60 s), then it's fast. A paid tier or an
  uptime-ping removes this.
- **File uploads are temporary.** Render's free disk is wiped on each deploy, so
  uploaded assignment files/recordings don't persist. Everything else (accounts,
  grades, attendance, insights) lives in Atlas and persists. Real fix = object
  storage (S3/Cloudinary) — ask if you want it.
- **Live-class video across different networks** still needs a TURN server; only
  that one feature is affected.
- **Re-seed / reset:** the demo data seeds once when the DB is empty. To reload
  it, drop the `virtual_classroom` database in Atlas and redeploy, or run
  `MONGO_URI="<atlas-uri>" npm --prefix server run seed` from your PC.
