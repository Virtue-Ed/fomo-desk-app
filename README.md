# Grok Bot Desk

Read-only mobile dashboard for a private memecoin desk. The app is a public static site. It never contains a token, a snapshot, or a secret. The desk publishes `snapshot.json` to the private repo `Virtue-Ed/fomo-desk-data`. This page reads that file in the browser with a fine-grained GitHub token you paste on the Account tab.

Expected site: <https://virtue-ed.github.io/fomo-desk-app/>

Design check, no token: <https://virtue-ed.github.io/fomo-desk-app/?demo=1>

## Enable GitHub Pages

After this branch is merged to `main`:

1. Open the repo on GitHub and go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).
3. Open the **Actions** tab and confirm **Deploy GitHub Pages** finished green on the merge commit. If it failed with a Pages site error, re-run the workflow after step 2.
4. The site URL is <https://virtue-ed.github.io/fomo-desk-app/>. The first deploy can take a minute.

The workflow is `.github/workflows/pages.yml`. It builds on pull requests, and deploys only from `main`.

## Create the fine-grained token

The token is read-only and limited to the data repo.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Resource owner: the account that can see `Virtue-Ed/fomo-desk-data`.
3. Repository access: **Only select repositories** → `fomo-desk-data`.
4. Permissions → Repository permissions → **Contents: Read-only**. Leave every other permission at No access.
5. Generate the token and copy it. GitHub shows it once.
6. Open the deployed app → **Account** → paste the token → **Save token**.

The token is stored in `localStorage` on that device. It is sent only as `Authorization: Bearer` to `api.github.com`. **Sign out / clear token** deletes it. If the phone is lost, revoke the token on GitHub.

Do not put the token in the URL, in this repo, or in the workflow.

## Add it to the iPhone home screen

1. Open <https://virtue-ed.github.io/fomo-desk-app/> in **Safari** (the system Safari, not an in-app browser).
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. The name is **Grok Desk**. Add it.
5. Open the icon. It runs standalone, without Safari’s toolbar.
6. On first launch, use **Account** to paste the token from the previous section.

The manifest, apple touch icon, `apple-mobile-web-app-capable`, theme color, and safe-area insets are in the page. A service worker caches the app shell (HTML, CSS, JS, icons). It does not cache `snapshot.json` or any response from `api.github.com`. Offline, the shell can open and the numbers cannot.

## What the screen shows

- **PAPER** or **LIVE** is the badge at the top right, taken from `mode`.
- Home: stack, dollar and percent change, multiple (`stack / start`), equity line with trade markers, timeframe chips, agent cards, recent activity.
- When the snapshot includes a copy ledger (`copy_equity_usd`, `copy_trades`, `copy_positions`, `copy_wallets`), Home shows a **Main / Copy** switch. Copy uses `copy_equity_usd` as the balance and the change versus `copy_start_stack_usd`, so open marks are included. **Copy trades** lists open copy positions (symbol, size, live percent, leader) and recent copy fills. Each row opens the snapshot `url` unchanged.
- Agents and Account list followed leaders as a handle plus a shortened wallet, when `copy_wallets` is present.
- Activity includes copy fills, tagged **COPY**. Older snapshots without these keys look the same as before.
- Coin rows open the `url` already in the snapshot. The app does not add a referral parameter.
- Times are `America/Chicago`.
- While the tab is visible the app polls every 30 seconds. **Last updated … ago** follows `generated_at`. If that time is more than 5 minutes old, a stale warning is shown.

## Demo mode

`?demo=1` renders [`sample-snapshot.json`](sample-snapshot.json) and does not ask for a token. Timestamps are shifted so `generated_at` is a few seconds ago and the chart windows still line up. Leave demo from the Account tab, or delete the query.

## Point it at another file

Edit [`src/config.ts`](src/config.ts). That file is the only place the data repo, path, and branch are set.

```ts
export const snapshotSource = {
  owner: 'Virtue-Ed',
  repo: 'fomo-desk-data',
  path: 'snapshot.json',
  ref: 'main',
};
```

The request is:

`GET https://api.github.com/repos/<owner>/<repo>/contents/<path>?ref=<ref>`

with `Accept: application/vnd.github.raw` and `Authorization: Bearer <token>`.

Missing fields are tolerated. Extra fields are ignored.

## Local preview

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173/fomo-desk-app/?demo=1>. The `/fomo-desk-app/` prefix matches the GitHub Pages project path.

```bash
npm run build
npm run preview
```

## Layout

- `src/config.ts` — data repo, poll interval, stale window, timezone
- `src/` — Vite + TypeScript, no UI framework
- `public/sw.js` — app-shell service worker
- `public/manifest.webmanifest` — install metadata
- `sample-snapshot.json` — demo fixture, not live data
