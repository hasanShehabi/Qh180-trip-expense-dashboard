# UK Trip Expense Dashboard

Open `index.html` in a browser to use the expense tracker.

The app stores expenses in the browser using `localStorage`, so the data stays on the same device and browser. Use **Export CSV** to save a backup or move the data elsewhere.

When deployed to Netlify, the app also syncs data through a Netlify Function backed by Netlify Blobs. That makes the same saved expenses available across your devices when you open the deployed site. `localStorage` remains as a local cache/offline fallback.

Features:
- Dark-mode dashboard optimized for personal trip tracking.
- Netlify cloud sync so deployed data follows the site across devices.
- Add, edit, delete, search, and filter trip expenses.
- Track who paid each expense: Hasan or Husain.
- Switch tabs between all spending, Hasan-paid expenses, and Husain-paid expenses.
- Consolidated dashboard shows total trip spend, each person's paid total, and who owes whom for an equal split.
- Use **View in BHD** to switch the dashboard, category totals, budget, settlement, and payment table amounts into Bahraini dinar.
- Categorize spending by food, transport, hotel, shopping, attractions, groceries, and other.
- Track total GBP spend, per-person paid totals, equal-split settlement, and optional budget progress.
- Home currency is hard-set to Bahraini dinar (`BHD`).
- Fetches the latest `GBP -> BHD` exchange rate from Frankfurter and caches the last successful rate locally.
- Export expenses as CSV.

Testing:

```powershell
cd outputs\travel-expense-dashboard
node tests\smoke.test.cjs
```

Netlify deployment:

- Deploy this `travel-expense-dashboard` folder as the Netlify site.
- Netlify will use `netlify.toml` to publish the static app and deploy `netlify/functions/trip-data.js`.
- The function uses `@netlify/blobs`, declared in `package.json`, to store the shared trip data.
- The data is shared for anyone who can access the deployed site URL. Add authentication later if the URL will be public.
