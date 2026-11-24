# দ্য ডিপ্লোমা পাস চা-ওয়ালা — Cafe Management System

**Version: v1.6.9 — Bponi Parity.** Printed QR cards show ONLY the table number + QR (logo, shop name, address, URL, seats and instruction are hidden in print). Table Add form matches Sir's screenshot: "+ নতুন টেবিল" heading, two inputs side by side (table code, placeholder = next free code; seats, prefilled 4, 1–20) + brown "টেবিল যোগ করুন" button; duplicate code / invalid seats blocked with Bangla toasts; name from code number (T-5 → "নাম্বার ০৫"). A4 QR print fills the whole page: print-all is a 2×5 grid on A4 portrait (8mm margins, 54mm cards, 2.5mm gaps = 280mm of the 281mm printable height), each printed card showing only the big table number ("নাম্বার ০১") + big 36mm QR; single-card print is one big poster card (170×252mm, 130mm QR) with only the table number + QR. Print-only header/CTA elements (hidden on screen), print-color-adjust exact, cards never split. Zero-padded table numbers: tables are "নাম্বার ০১"–"নাম্বার ১০" (not "নাম্বার ১") in the seed and on load for old saved tables (normalised from the table code, e.g. T-01 → "নাম্বার ০১"). QR cards redesigned to match Sir's screenshot (Tong Cafe card): heading "নাম্বার ০১ • ৫ সিট", big 180px QR in a bordered rounded box, menu URL as underlined text, and three buttons — লিংক কপি, QR প্রিন্ট (only that card), red মুছুন (confirm first). Tables seed as "নাম্বার ০১"–"নাম্বার ১০" with 5 seats each; old saved tables are migrated on load (seats=5, "টেবিল ০১" → "নাম্বার ০১"). Running bill + customer-menu link kept as secondary lines below the buttons. Menu-photo scan moved INTO the Menu page (no separate "মেনু স্ক্যান" sidebar item) — photo auto-add happens from the Menu page itself. Sidebar still matches the screenshot's menu (CafePilot SIDEBAR groups/order/labels); new working pages: টাকা ও হিসাব (money overview) and সব টুল (all tools list). The version string is shown in the sidebar footer, the app footer, the customer footer, and the login screen footer, so a fresh live check can prove the new version reached the device.

## No plan at all (v1.6.2)
- Sir's order: this system has **no plan, no trial, no subscription, no monthly price**. The landing pricing card (৳2,000/month, yearly ৳20,000), the Plan page and sidebar item, the `plan` field in saved data, and the per-branch plan price note are all removed. Old saved data that still has a `plan` key is ignored on load (no crash).

## KDS wait-time fix (v1.6.1)
- Orders saved before v1.6.0 had no `createdAt`, so the KDS wait time showed 0 min and oldest-first sorting failed. On load, `createdAt` is now backfilled from the order's Bengali time string on its date in Dhaka time (+06:00); seed demo orders derive their time strings from their `createdAt` values.

## Landing page (before login)
The app now opens on a landing page, not straight on the login form: hero with the logo, name, tagline "চা, গল্প, আড্ডা", address "1640 Narsingdi, Bangladesh", opening time, feature cards (Menu Scan, QR Menu, Orders, Kitchen, POS + Bill, Reports), and three buttons — Login, Sign Up, and Customer Menu (opens the QR customer menu with no login). Login / Sign Up is the auth screen reached from the landing page; logging out returns to the landing page.

## Professional polish (v1.5.1)
- Address migration (v1.5.1): older saved shop data that still says Narayanganj is migrated on load to "1640 Narsingdi, Bangladesh".
- Toasts instead of browser `alert()` popups for order, bill, coupon, review, settings, and validation messages (Bangla, auto-dismiss); `confirm()` is kept before delete / cancel / cart-clear / day-close.
- Consistent branding: logo in the landing hero, header, sidebar, login card, bill, and every QR card (shop name + address on the QR card).
- Phone number: the Settings value `01900-000000` is only a **placeholder** — it is labelled as such in Settings, warned about there, and is **never printed on bills or QR cards** as if it were real. A real phone number from Sir is still needed.
- Bill print: 58mm (default) / 80mm paper-size selector, saved per device; print CSS hides buttons and shows only the bill (58mm) or the QR cards (A4).
- Dates use Dhaka time (`Asia/Dhaka`) for "today" and dashboard dates, so late-night bills count on the right Dhaka day.
- Empty states everywhere ("আজ এখনো কোনো অর্ডার নেই।", "এই ক্যাটাগরিতে কোনো চালু আইটেম নেই।", etc.), focus-visible outlines, disabled-button states, long Bengali text wrapping, and mobile-first responsive layout (sidebar becomes a horizontal scroll nav under 820px, 2-column grids under 640px, 1-column under 420px).
- Footer on every view: © year, shop name, address, version string.

## Login / Sign Up — reached from the landing page
The app opens on the landing page; Login / Sign Up is the auth screen reached from it (Bangla, logo on top, brown/gold theme), not the dashboard.
- **লগইন** tab: email + password. Wrong email/password shows a clear Bangla error. On success it goes straight to the Dashboard.
- **সাইন আপ** tab: name, email, password, confirm password, role (Owner / Staff), shop name. Validates email format, password at least 6 characters, passwords match, and email not already registered. On success the account is created and the user is logged straight in to the Dashboard.
- Accounts are stored in browser localStorage (key `dpcw-users-v1`, separate from the shop data key `dpcw-v1`). Passwords are stored only as a simple hash, never plain text.
- The header shows the logged-in user's name + role, with a **লগআউট** button that returns to the Auth screen. Logging out does NOT erase menu/orders data.
- The existing demo staff PIN login still works inside the app (Staff page → KDS), email/password is the main first-screen login.
- Customer QR menu view (`?table=T-xx`) still works WITHOUT login — customers do not log in.
- Seeded owner account (for Sir to log in immediately): email `owner@diplomacha.com`, password `123456`, name "Owner", role Owner. Change the password after first login by creating a new owner account if needed — this demo seed is in the code, not shown on the public login screen.

## Features
1. Owner dashboard — today's total sell, total orders, pending/ready, popular items, waiter-bell alerts, staff summary (who took how many orders / bills / money today)
2. Menu management — add/edit (active on/off)/delete, 6 categories, seeded with 26 items: Dudh Cha 7, Rong Cha 5, Coffee 3, Mocktail 3, Lassi 1, Snacks 7 (Malai Cha first)
3. Tables + QR — 10 tables (T-01 to T-10), each QR links to `?table=T-01` customer menu, QR print view
4. Customer menu + order — scan QR / pick table, add to cart, place order, live status tracker (নতুন → কনফার্ম → রেডি → পরিবেশন → বিল পেইড), "🔔 ওয়েটার ডাকুন" bell button, review form after served/paid
5. Orders — new-order alert banner, confirm / ready / served / bill-paid flow, cancel, bill reprint button on every paid order
6. Kitchen display (KDS) — split by station Drinks / Kitchen / Snacks
7. POS + bill — daily-reset serial `Bill No-0001`, shop name + logo on the bill, print-friendly; counter billing with order type (Dine-in / Takeaway / Delivery / Event), payment (Cash / bKash / Nagad / Card / Due), coupon code, VAT % + service charge % from Settings, member points, cart draft auto-saved to localStorage (`dpcw-pos-draft-v1`) and restored on reload
8. Staff — PIN login and roles. Demo PINs: Owner 1234 (all), Niloy 1111 (Drinks only), Ratul 2222 (Snacks only). Change/add staff from the Staff page. 7 permissions per staff (order, POS/bill, kitchen, menu edit, reports, tables/QR, staff manage) — Owner edits them with checkboxes; sidebar hides pages without permission and opening one shows "🚫 অনুমতি নেই"
9. Staff leave — add/list leave (staff, from–to dates, reason, status), Owner approves/rejects
10. Reports — last 7 days sales, top items, sales by payment method, menu visits
11. Analytics — sales by day, top items, sales by payment method, menu visits (every customer-menu open is counted), average bill, busy tables (orders per table today)
12. Expenses — add/list (date, title, category, amount)
13. Day-close — today's sales, expenses, totals by payment, net, close-day button (saved per day)
14. Offers / Coupons — create coupon (code, discount %), active on/off, apply at POS by code
15. Members / Points — add member (name, phone), 1 point per ৳10 on paid bills (POS member select)
16. Bookings — add/list (date, time, name, phone, guests, table)
17. Stock — qty per menu item, +5/+1/−1 buttons, low-stock warning under 5; stock auto-decreases when a bill is made
18. Delivery — Delivery-type orders from POS/Orders plus manual delivery add/list
19. Catering — add/list (date, customer, guests, items, total)
20. Reviews — customer reviews from the order tracker (name, 1–5 stars, comment); Reviews page lists them, Owner can reply
21. Settings — shop name, phone, address, opening time, VAT %, service charge %, business type (Tea shop / Cafe / Restaurant), themes (Brown/Gold default, Green, Teal)
22. Sidebar navigation — fixed shop logo + name on top, Dashboard as a direct top-level item, collapsible groups (মেনু ও টেবিল / বিক্রি / কাস্টমার / টাকা ও হিসাব / পরিচালনা / সেটিংস); on mobile it becomes a horizontal scroll nav
23. Menu Scan — photo → OCR → auto-add (see "Menu Scan" section below)

## Data — important limit
All data is stored in the browser's `localStorage` (key `dpcw-v1`; POS draft in `dpcw-pos-draft-v1`), so it works on Vercel free static hosting with no database.
**That means orders placed on one phone will NOT appear on another phone.** For real multi-device sync the next step is a shared database — Vercel Postgres or Vercel KV plus a small API — not included in this static build.

## Menu Scan — works (client-side OCR, no API key)
- Scan page: owner takes/uploads a menu photo (file input + camera capture). tesseract.js runs OCR **in the browser** with `ben+eng` trained data and a progress bar — no server, no API key, no credits needed (the OpenAI key in this workspace has no credits, so it is not used).
- Parsed items are **auto-added straight to the Menu** — no preview/confirm step (Sir's rule, same as CafePilot). Wrong items the owner deletes from the Menu page.
- Parser (`src/scanParse.js`): Bengali digits ০-৯ → ASCII; price must be present and ৳5–৳10000; headings become categories, never items; a line with a price is always an item (even "Green Tea"); fuzzy dedupe (edit distance ≤2) skips items already in the menu — ফুচকা vs দই ফুচকা stay separate.
- After a scan the page shows in Bangla: how many added, how many skipped as duplicates, how many lines dropped (no price), plus the added items list and a link to the Menu page. A text-paste fallback is also on the page (one item per line, price at the end).
- **Honest OCR limits (also shown on the scan page):** OCR can misread 1–2 letters; Bengali handwriting and very small fonts read worse; English digits read better than Bengali digits; the first scan downloads the OCR model, so it takes longer. Test (2026-11-24, clean printed test menu, 8 lines): real OCR read all 7 item lines correctly in ~17s — 4 added, 3 skipped as duplicates, 1 line dropped (the title). Same dish written in English vs Bengali (Special Malai Cha vs স্পেশাল মালাই চা) is NOT deduped — it is added as a separate item.

## Honest limits (backend-only, not faked as working)
- **Multi-device sync** — data is localStorage-only on this device (see the note on Settings / Dashboard). Real sync needs a shared database/backend.
- **Payments** — bKash / Nagad / Card are recorded manually on the bill only; there is no payment-gateway integration.
- **Still needed from Sir:** the real shop phone number. Settings currently holds the placeholder `01900-000000`, which is never printed on bills or QR cards.

## Run locally
```bash
npm install
npm run dev
npm run build
```

## Deploy to Vercel (no card needed for Hobby)
Option A — Vercel dashboard (easiest):
1. Push this folder to a GitHub repo.
2. Go to vercel.com → Add New → Project → Import that repo.
3. Framework is auto-detected as Vite. Build command `npm run build`, output `dist` (already in `vercel.json`).
4. Deploy. You get a `*.vercel.app` link. No card is needed to deploy on Vercel's free tier.

Option B — Vercel CLI:
```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

Note on Vercel Hobby: it is for personal / non-commercial use. This shop system takes payments, so for a real commercial shop use Vercel Pro ($20/month) or keep the shop on a host whose free tier allows commercial use. See the earlier Vercel check for details.
