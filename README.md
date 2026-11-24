# দ্য ডিপ্লোমা পাস চা-ওয়ালা — Cafe Management System

Vercel-ready cafe management system. Vite + React, static, no server, no database, no Cloudflare code.

Live brand: **দ্য ডিপ্লোমা পাস চা-ওয়ালা / Diploma Pass Cha-Wala**
Logo: `public/logo.jpg` (copied from the supplied logo file) — also used as favicon and header logo.
Theme: dark brown `#2b1a0e`, gold `#d4a94e`, cream. Full Bangla UI, BDT prices.

## Login / Sign Up — first screen
The app opens on a Login / Sign Up screen (Bangla, logo on top, brown/gold theme), not the dashboard.
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
22. Plan — Trial / Monthly, ৳2,000/month (yearly ৳20,000), features list, manual-payment note
23. Sidebar navigation — fixed shop logo + name on top, Dashboard as a direct top-level item, collapsible groups (মেনু ও টেবিল / বিক্রি / কাস্টমার / টাকা ও হিসাব / পরিচালনা / সেটিংস); on mobile it becomes a horizontal scroll nav

## Data — important limit
All data is stored in the browser's `localStorage` (key `dpcw-v1`; POS draft in `dpcw-pos-draft-v1`), so it works on Vercel free static hosting with no database.
**That means orders placed on one phone will NOT appear on another phone.** For real multi-device sync the next step is a shared database — Vercel Postgres or Vercel KV plus a small API — not included in this static build.

## Honest limits (backend-only, not faked as working)
- **Menu Scan** — the page says "শীঘ্রই আসছে — ব্যাকএন্ড AI লাগবে". Reading items from a menu photo needs an AI vision backend; this static build has none. Items can be added manually from the Menu page.
- **Multi-device sync** — data is localStorage-only on this device (see the note on Settings / Dashboard). Real sync needs a shared database/backend.
- **Payments** — bKash / Nagad / Card are recorded manually on the bill only; there is no payment-gateway integration. Plan payment is manual as well.

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
4. Deploy. You get a `*.vercel.app` link. No card is needed for the Hobby plan.

Option B — Vercel CLI:
```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

Note on Vercel Hobby: it is for personal / non-commercial use. This shop system takes payments, so for a real commercial shop use Vercel Pro ($20/month) or keep the shop on a host whose free tier allows commercial use. See the earlier Vercel check for details.
