import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Tesseract from 'tesseract.js'
import { parseMenuText } from './scanParse.js'
import { parseVoiceOrder, parseVoiceBazar } from './voiceParse.js'

const KEY = 'dpcw-v1'
const USERS_KEY = 'dpcw-users-v1'
const SESSION_KEY = 'dpcw-session-v1'
const POS_DRAFT_KEY = 'dpcw-pos-draft-v1'
// Simple one-way hash for demo localStorage auth — never store plain passwords.
function hashPw(pw) { let h = 5381; for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) >>> 0; return 'h' + h.toString(16) }
function seedUsers() { return [{ id: 'u-owner', name: 'Owner', email: 'owner@diplomacha.com', pwHash: hashPw('123456'), role: 'Owner', shop: 'দ্য ডিপ্লোমা পাস চা-ওয়ালা', created: todayStr() }] }
function loadUsers() { try { const d = JSON.parse(localStorage.getItem(USERS_KEY)); if (Array.isArray(d) && d.length) return d } catch { /* fall through to seed */ } const s = seedUsers(); try { localStorage.setItem(USERS_KEY, JSON.stringify(s)) } catch { /* ignore */ } return s }
function loadSession() { try { return localStorage.getItem(SESSION_KEY) || '' } catch { return '' } }
const VERSION = 'v1.7.0 — Bponi Parity'
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
const dhakaLong = (d = new Date()) => d.toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const realPhone = (phone) => (phone && phone !== '01900-000000' ? phone : '')
const tk = (n) => `৳${Number(n || 0).toLocaleString('en-IN')}`
const bnNum = (n) => Number(n).toLocaleString('bn-BD')
const bnNum2 = (n) => String(n).padStart(2, '0').split('').map((d) => '০১২৩৪৫৬৭৮৯'[d] || d).join('')
const STATUS = { new: 'নতুন', confirmed: 'কনফার্ম', ready: 'রেডি', served: 'পরিবেশন', paid: 'বিল পেইড', cancelled: 'বাতিল' }
const DEFAULT_SOP = '১. দোকান খুলুন — ক্যাশ ড্রয়ারে শুরুর টাকা বসিয়ে শিফট খুলুন।\n২. অর্ডার নিন — টেবিলের QR / POS / ভয়েস অর্ডার থেকে।\n৩. কিচেনে পাঠান — KDS-এ টিকিট দেখে তৈরি করুন, রেডি হলে Ready চাপুন।\n৪. পরিবেশন করুন — ওয়েটার টেবিলে দিয়ে আসবে।\n৫. বিল করুন — POS থেকে Cash / bKash / Nagad / Card / Due-তে বিল।\n৬. বাকি থাকলে Due পাতায় লিখে রাখুন, টাকা পেলে আংশিক/পুরো জমা দিন।\n৭. দিন শেষে — শিফট বন্ধ করুন, তারপর দিনের হিসাব বন্ধ (Day-close) করুন।'
const STATIONS = ['Drinks', 'Kitchen', 'Snacks']
const CATS = ['দুধ চা', 'রং চা', 'কফি', 'মকটেল', 'লাচ্ছি', 'স্ন্যাকস']
const PERMS = ['order', 'pos', 'kitchen', 'menu', 'reports', 'tables', 'staff']
const PERM_LABELS = { order: 'অর্ডার নেওয়া', pos: 'POS / বিল করা', kitchen: 'কিচেন ডিসপ্লে দেখা', menu: 'মেনু বদলানো', reports: 'রিপোর্ট দেখা', tables: 'টেবিল / QR দেখা', staff: 'স্টাফ ম্যানেজ করা' }
const ORDER_TYPES = ['Dine-in', 'Takeaway', 'Delivery', 'Event']
const PAYMENTS = ['Cash', 'bKash', 'Nagad', 'Card', 'Due']
const THEMES = [['brown', 'বাদামি / সোনালি (ডিফল্ট)'], ['green', 'সবুজ'], ['teal', 'টিল']]

const seedMenu = [
  ['স্পেশাল মালাই চা', 'দুধ চা', 50, 'Drinks', true], ['স্পেশাল দুধ চা', 'দুধ চা', 40, 'Drinks', true],
  ['মসলা চা', 'দুধ চা', 35, 'Drinks', true], ['আদা দুধ চা', 'দুধ চা', 30, 'Drinks', true],
  ['এলাচি দুধ চা', 'দুধ চা', 35, 'Drinks', true], ['চকলেট দুধ চা', 'দুধ চা', 45, 'Drinks', true],
  ['নরমাল দুধ চা', 'দুধ চা', 20, 'Drinks', true],
  ['লেবু রং চা', 'রং চা', 15, 'Drinks', true], ['আদা রং চা', 'রং চা', 20, 'Drinks', true],
  ['মসলা রং চা', 'রং চা', 25, 'Drinks', true], ['গ্রিন টি', 'রং চা', 25, 'Drinks', true],
  ['পুদিনা রং চা', 'রং চা', 20, 'Drinks', true],
  ['ব্ল্যাক কফি', 'কফি', 40, 'Drinks', true], ['মিল্ক কফি', 'কফি', 50, 'Drinks', true],
  ['কোল্ড কফি', 'কফি', 70, 'Drinks', true],
  ['মাল্টা মকটেল', 'মকটেল', 60, 'Drinks', true], ['তেঁতুল মকটেল', 'মকটেল', 60, 'Drinks', true],
  ['মিন্ট লেমনেড', 'মকটেল', 50, 'Drinks', true],
  ['মিষ্টি লাচ্ছি', 'লাচ্ছি', 60, 'Drinks', true],
  ['দই ফুচকা', 'স্ন্যাকস', 50, 'Snacks', true], ['ফুচকা', 'স্ন্যাকস', 40, 'Snacks', true],
  ['সিঙ্গারা', 'স্ন্যাকস', 15, 'Kitchen', true], ['সমোসা', 'স্ন্যাকস', 20, 'Kitchen', true],
  ['বিস্কুট', 'স্ন্যাকস', 10, 'Kitchen', true], ['কেক স্লাইস', 'স্ন্যাকস', 40, 'Kitchen', true],
  ['ফ্রেঞ্চ ফ্রাই', 'স্ন্যাকস', 60, 'Kitchen', true],
].map(([name, cat, price, station, active], i) => ({ id: `m${i + 1}`, name, cat, price, station, active }))

function defaultPermsForStaff(s) {
  const r = (s.role || '').toLowerCase()
  if (r.includes('owner') || r.includes('মালিক')) return [...PERMS]
  if (r.includes('ক্যাশিয়ার') || r.includes('cashier')) return ['order', 'pos', 'tables']
  if (r.includes('ওয়েটার') || r.includes('waiter')) return ['order', 'kitchen', 'tables']
  if (r.includes('চা-মেকার') || r.includes('স্ন্যাকস') || r.includes('kitchen') || r.includes('রান্না')) return ['order', 'kitchen']
  return ['order', 'kitchen']
}

function seed() {
  const t = todayStr()
  const y = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
  const mk = (id, date, table, items, status, time, createdAt) => ({
    id, date, table, createdAt: createdAt || Date.now(), customer: 'ডেমো কাস্টমার', items: items.map(([mid, qty]) => {
      const m = seedMenu.find((x) => x.id === mid); return { id: mid, name: m.name, price: m.price, qty, station: m.station }
    }), status, time, billNo: status === 'paid' ? 'Bill No-0001' : null, type: 'Dine-in', payment: status === 'paid' ? 'Cash' : null, billedBy: status === 'paid' ? 'মালিক' : null,
  })
  const stock = {}; seedMenu.forEach((m) => { stock[m.id] = 20 })
  return {
    settings: { shop: 'দ্য ডিপ্লোমা পাস চা-ওয়ালা', phone: '01900-000000', address: '1640 Narsingdi, Bangladesh', open: 'সকাল ১০টা — রাত ১০টা', vat: 0, service: 0, businessType: 'Tea shop', sop: DEFAULT_SOP, theme: 'brown' },
    menu: seedMenu,
    tables: Array.from({ length: 10 }, (_, i) => ({ code: `T-${String(i + 1).padStart(2, '0')}`, name: `নাম্বার ${bnNum2(i + 1)}`, seats: 5 })),
    staff: [
      { id: 's1', name: 'মালিক', role: 'Owner — সব দেখবে', pin: '1234', station: 'All', perms: [...PERMS] },
      { id: 's2', name: 'নিলয়', role: 'চা-মেকার — শুধু চা / ড্রিংকস', pin: '1111', station: 'Drinks', perms: ['order', 'kitchen'] },
      { id: 's3', name: 'রাতুল', role: 'স্ন্যাকস-মেকার — শুধু স্ন্যাকস', pin: '2222', station: 'Snacks', perms: ['order', 'kitchen'] },
    ],
    orders: [
      mk('ORD-1001', t, 'T-01', [['m1', 2], ['m21', 1]], 'new', new Date(Date.now() - 3 * 60000).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }), Date.now() - 3 * 60000),
      mk('ORD-1002', t, 'T-03', [['m2', 1], ['m20', 2]], 'ready', new Date(Date.now() - 12 * 60000).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }), Date.now() - 12 * 60000),
      mk('ORD-1003', t, 'T-02', [['m1', 1], ['m13', 1]], 'paid', new Date(Date.now() - 45 * 60000).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }), Date.now() - 45 * 60000),
      mk('ORD-0998', y, 'T-05', [['m1', 3], ['m22', 1]], 'paid', '১৯:২০', Date.now() - 86400000),
    ],
    bills: [{ no: 'Bill No-0001', date: t, createdAt: Date.now() - 45 * 60000, orderId: 'ORD-1003', total: 90, subtotal: 90, discount: 0, vat: 0, service: 0, payment: 'Cash', type: 'Dine-in', billedBy: 'মালিক' }],
    seq: 1003,
    expenses: [], coupons: [], members: [], bookings: [], stock,
    deliveryOrders: [], cateringOrders: [], reviews: [], bells: [], leaves: [],
    bazar: [], vendors: [{ id: 'v1', name: 'স্থানীয় বাজার', phone: '' }], shifts: [], dues: [],
    branches: [{ id: 'br-1', name: 'দ্য ডিপ্লোমা পাস চা-ওয়ালা — মূল শাখা', address: '1640 Narsingdi, Bangladesh', isMain: true }], salaries: [],
    dayCloses: [], visits: { total: 0, byDate: {} }, posDraft: null,
  }
}
// Merge defaults for missing keys so old localStorage data keeps working.
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY))
    if (!d || !d.menu) return seed()
    const s = seed()
    const merged = { ...s, ...d }
    merged.settings = { ...s.settings, ...(d.settings || {}) }
    // Address migration: older saved data still says Narayanganj — Sir's shop is 1640 Narsingdi, Bangladesh.
    if (!merged.settings.address || !String(merged.settings.address).includes('Narsingdi')) merged.settings.address = '1640 Narsingdi, Bangladesh'
    // KDS fix: orders saved before v1.6.0 have no createdAt, so wait showed 0 min and oldest-first sorting failed.
    // Backfill createdAt from the order's time string (Bengali digits, Dhaka time) on its date.
    if (Array.isArray(merged.orders)) merged.orders = merged.orders.map((o) => {
      if (o.createdAt) return o
      const m = String(o.time || '').replace(/[০-৯]/g, (ch) => '০১২৩৪৫৬৭৮৯'.indexOf(ch)).match(/(\d{1,2}):(\d{2})/)
      if (m) {
        const dt = new Date(`${o.date || todayStr()}T${String(m[1]).padStart(2, '0')}:${m[2]}:00+06:00`)
        if (!isNaN(dt)) return { ...o, createdAt: dt.getTime() }
      }
      return { ...o, createdAt: Date.now() - 10 * 60000 }
    })
    // No plan in this system (Sir's order) — ignore any plan saved by older versions.
    delete merged.plan
    // QR redesign (v1.6.5): tables have seats (default 5) and "নাম্বার ০১" names, not "টেবিল ০১".
    // v1.6.6: number is zero-padded Bengali (০১, not ১) — derived from the table code so old saves fix too.
    if (Array.isArray(merged.tables)) merged.tables = merged.tables.map((tb) => { const num = String(tb.code || '').replace(/[^0-9]/g, '') || '1'; return { ...tb, seats: tb.seats || 5, name: `নাম্বার ${bnNum2(num)}` } })
    merged.visits = { total: 0, byDate: {}, ...(d.visits || {}) }
    merged.stock = { ...s.stock, ...(d.stock || {}) }
    merged.staff = (d.staff || []).map((st) => ({ ...st, perms: Array.isArray(st.perms) && st.perms.length ? st.perms : defaultPermsForStaff(st) }))
    for (const k of ['expenses', 'coupons', 'members', 'bookings', 'deliveryOrders', 'cateringOrders', 'reviews', 'bells', 'leaves', 'dayCloses', 'bazar', 'vendors', 'shifts', 'dues', 'branches', 'salaries']) if (!Array.isArray(merged[k])) merged[k] = []
    return merged
  } catch { return seed() }
}
const total = (o) => o.items.reduce((s, i) => s + i.price * i.qty, 0)
// Bill maths: subtotal -> coupon discount -> VAT + service charge on the discounted amount.
function billCalc(subtotal, couponPct, vatPct, servicePct) {
  const discount = Math.round(subtotal * (Number(couponPct) || 0) / 100)
  const after = subtotal - discount
  const vat = Math.round(after * (Number(vatPct) || 0) / 100)
  const service = Math.round(after * (Number(servicePct) || 0) / 100)
  return { subtotal, discount, vat, service, total: after + vat + service }
}
function loadPosDraft() {
  try { const d = JSON.parse(localStorage.getItem(POS_DRAFT_KEY)); return d && typeof d === 'object' ? d : null } catch { return null }
}

export default function App() {
  const [data, setData] = useState(load)
  const [view, setView] = useState('dashboard')
  const [cat, setCat] = useState('সব')
  const [cart, setCart] = useState({})
  const [custTable, setCustTable] = useState('T-01')
  const [custName, setCustName] = useState('')
  const [lastOrder, setLastOrder] = useState(null)
  const [alert, setAlert] = useState(null)
  const [bill, setBill] = useState(null)
  const [activeStaff, setActiveStaff] = useState(null)
  const [pinInput, setPinInput] = useState('')
  const [pinFor, setPinFor] = useState(null)
  const [kdsStation, setKdsStation] = useState('All')
  const [newItem, setNewItem] = useState({ name: '', cat: 'দুধ চা', price: '', station: 'Drinks' })
  const [newStaff, setNewStaff] = useState({ name: '', role: '', pin: '', station: 'Drinks' })
  const [newTable, setNewTable] = useState('')
  const [newTableSeats, setNewTableSeats] = useState('4')
  const [settings, setSettings] = useState(data.settings)
  const [openGroups, setOpenGroups] = useState({ menu: true, sell: true, customer: true, money: true, manage: true, tools: true, settings: true })
  // --- Login / Sign Up (first screen) ---
  const [isCustomer] = useState(() => new URLSearchParams(window.location.search).has('table'))
  const [users, setUsers] = useState(loadUsers)
  const [user, setUser] = useState(() => { const em = loadSession(); if (!em) return null; return loadUsers().find((x) => x.email.toLowerCase() === em.toLowerCase()) || null })
  const [authTab, setAuthTab] = useState('login')
  const [authErr, setAuthErr] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'Owner', shop: 'দ্য ডিপ্লোমা পাস চা-ওয়ালা' })
  // --- POS state (draft auto-saves to dpcw-pos-draft-v1) ---
  const [posDraftLoaded, setPosDraftLoaded] = useState(false)
  const [posCart, setPosCart] = useState({})
  const [posType, setPosType] = useState('Dine-in')
  const [posPayment, setPosPayment] = useState('Cash')
  const [posTable, setPosTable] = useState('T-01')
  const [posCouponCode, setPosCouponCode] = useState('')
  const [posCoupon, setPosCoupon] = useState(null)
  const [posMember, setPosMember] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState('')
  // --- forms for new pages ---
  const [newExpense, setNewExpense] = useState({ date: todayStr(), title: '', category: 'অন্যান্য', amount: '' })
  const [newCoupon, setNewCoupon] = useState({ code: '', pct: '' })
  const [newMember, setNewMember] = useState({ name: '', phone: '' })
  const [newBooking, setNewBooking] = useState({ date: todayStr(), time: '', name: '', phone: '', guests: '', table: 'T-01' })
  const [newDelivery, setNewDelivery] = useState({ customer: '', phone: '', address: '', itemId: 'm1', qty: 1 })
  const [newCatering, setNewCatering] = useState({ date: todayStr(), customer: '', guests: '', items: '', total: '' })
  const [newLeave, setNewLeave] = useState({ staffId: '', from: todayStr(), to: todayStr(), reason: '' })
  const [reviewForm, setReviewForm] = useState({ name: '', stars: 5, comment: '' })
  const [replyText, setReplyText] = useState({})
  // --- v1.6.0 Bponi parity state ---
  const [newBazar, setNewBazar] = useState({ item: '', qty: 1, cost: '', vendor: '', date: todayStr() })
  const [newVendor, setNewVendor] = useState({ name: '', phone: '' })
  const [newBranch, setNewBranch] = useState({ name: '', address: '' })
  const [shiftStart, setShiftStart] = useState('')
  const [shiftCounted, setShiftCounted] = useState('')
  const [printTable, setPrintTable] = useState('')
  const [duePay, setDuePay] = useState({})
  const [salaryAmt, setSalaryAmt] = useState({})
  const [sopDraft, setSopDraft] = useState(data.settings.sop || DEFAULT_SOP)
  const [voiceMode, setVoiceMode] = useState('order')
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const [voiceMsg, setVoiceMsg] = useState('')
  const [kdsTick, setKdsTick] = useState(0)
  // --- Menu scan (client-side OCR with tesseract.js, ben+eng; no API key) ---
  const [scanFile, setScanFile] = useState(null)
  const [scanPreview, setScanPreview] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatus, setScanStatus] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [scanText, setScanText] = useState('')
  const [toast, setToast] = useState(null)
  const [showLanding, setShowLanding] = useState(true)
  const [guestCustomer, setGuestCustomer] = useState(false)
  const [billSize, setBillSize] = useState(() => { try { return localStorage.getItem('dpcw-bill-size') || '58' } catch { return '58' } })
  useEffect(() => { try { localStorage.setItem('dpcw-bill-size', billSize) } catch { /* ignore */ } }, [billSize])
  const showToast = (msg, kind = 'ok') => { setToast({ msg, kind }); window.setTimeout(() => setToast(null), 4000) }
  const copyTableLink = async (url) => { try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url) } else { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) } showToast('🔗 লিংক কপি হয়েছে') } catch { showToast('লিংক কপি হয়নি — লিংকটা ধরে কপি করুন', 'err') } }
  // --- Table Add form (screenshot: "+ নতুন টেবিল", code + seats inputs, brown button) ---
  const nextTableCode = () => { const nums = data.tables.map((t) => Number(String(t.code || '').replace(/[^0-9]/g, '')) || 0); return `T-${Math.max(0, ...nums) + 1}` }
  const addTable = () => {
    const code = newTable.trim().toUpperCase()
    if (!code) return showToast('টেবিল কোড দিন', 'err')
    if (data.tables.some((t) => String(t.code).toUpperCase() === code)) return showToast('এই কোডের টেবিল আগেই আছে', 'err')
    const seats = Number(newTableSeats)
    if (!Number.isInteger(seats) || seats < 1 || seats > 20) return showToast('সিট ১–২০ এর মধ্যে দিন', 'err')
    const num = code.replace(/[^0-9]/g, '')
    const name = num ? `নাম্বার ${bnNum2(num)}` : `নাম্বার ${code}`
    upd((d) => { d.tables.push({ code, name, seats }); return d })
    setNewTable(''); setNewTableSeats('4')
    showToast(`✅ ${name} যোগ হয়েছে — ${bnNum(seats)} সিট`)
  }
  const printOneTable = (code) => { setPrintTable(code); document.body.classList.add('print-one'); window.setTimeout(() => window.print(), 150) }
  const toastEl = toast ? <div className={`toast toast-${toast.kind}`} role="status"><span>{toast.msg}</span><button className="no-print" onClick={() => setToast(null)} aria-label="বন্ধ করুন">✕</button></div> : null

  useEffect(() => { try { localStorage.setItem(USERS_KEY, JSON.stringify(users)) } catch { /* ignore */ } }, [users])

  function doLogin() {
    setAuthErr(''); setAuthMsg('')
    const email = authForm.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAuthErr('সঠিক ইমেইল ঠিকানা দিন'); return }
    if (!authForm.password) { setAuthErr('পাসওয়ার্ড দিন'); return }
    const u = users.find((x) => x.email.toLowerCase() === email)
    if (!u || u.pwHash !== hashPw(authForm.password)) { setAuthErr('ইমেইল বা পাসওয়ার্ড ভুল হয়েছে — আবার চেষ্টা করুন'); return }
    setUser(u); try { localStorage.setItem(SESSION_KEY, u.email) } catch { /* ignore */ }
    setShowLanding(false); showToast('স্বাগতম! লগইন সফল হয়েছে')
    setAuthForm({ ...authForm, password: '', confirm: '' }); setView('dashboard')
  }
  function doSignup() {
    setAuthErr(''); setAuthMsg('')
    const name = authForm.name.trim(); const email = authForm.email.trim().toLowerCase(); const shop = authForm.shop.trim()
    if (!name) { setAuthErr('আপনার নাম দিন'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAuthErr('সঠিক ইমেইল ঠিকানা দিন'); return }
    if (users.some((x) => x.email.toLowerCase() === email)) { setAuthErr('এই ইমেইল দিয়ে already account আছে — লগইন করুন'); return }
    if (!authForm.password || authForm.password.length < 6) { setAuthErr('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'); return }
    if (authForm.password !== authForm.confirm) { setAuthErr('দুইবারের পাসওয়ার্ড মিলছে না'); return }
    if (!shop) { setAuthErr('দোকানের নাম দিন'); return }
    const u = { id: `u${Date.now()}`, name, email, pwHash: hashPw(authForm.password), role: authForm.role, shop, created: todayStr() }
    setUsers((prev) => [...prev, u]); setUser(u); setShowLanding(false)
    try { localStorage.setItem(SESSION_KEY, u.email) } catch { /* ignore */ }
    setAuthMsg('সাইন আপ সফল হয়েছে — স্বাগতম!'); setAuthForm({ ...authForm, password: '', confirm: '' }); setView('dashboard')
  }
  function doLogout() { setUser(null); setActiveStaff(null); setShowLanding(true); setGuestCustomer(false); try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ } setAuthErr(''); setAuthMsg(''); setAuthTab('login'); setView('dashboard') }

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)) }, [data])
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('table')
    if (p) { setCustTable(p); setView('customer') }
  }, [])
  useEffect(() => { setSettings(data.settings) }, [data.settings])
  // Count every customer-menu open (for Analytics: menu visits).
  useEffect(() => {
    if (view !== 'customer') return
    setData((d) => { const c = structuredClone(d); const t = todayStr(); c.visits.total = (c.visits.total || 0) + 1; c.visits.byDate[t] = (c.visits.byDate[t] || 0) + 1; return c })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])
  // KDS waiting-time colours need a re-render every 30s.
  useEffect(() => { const id = window.setInterval(() => setKdsTick((t) => t + 1), 30000); return () => window.clearInterval(id) }, [])
  // Single-QR print: clear the print-one state after printing.
  useEffect(() => { const done = () => { setPrintTable(''); document.body.classList.remove('print-one') }; window.addEventListener('afterprint', done); return () => window.removeEventListener('afterprint', done) }, [])
  // POS draft: restore once, then auto-save on every change.
  useEffect(() => {
    if (posDraftLoaded) return
    const d = loadPosDraft()
    if (d) {
      if (d.cart) setPosCart(d.cart); if (d.type) setPosType(d.type); if (d.payment) setPosPayment(d.payment)
      if (d.table) setPosTable(d.table); if (d.member) setPosMember(d.member)
      if (d.coupon) setPosCoupon(d.coupon)
    }
    setPosDraftLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!posDraftLoaded) return
    const has = Object.values(posCart).some((q) => q > 0)
    try {
      if (!has) { localStorage.removeItem(POS_DRAFT_KEY); setDraftSavedAt('') }
      else {
        localStorage.setItem(POS_DRAFT_KEY, JSON.stringify({ cart: posCart, type: posType, payment: posPayment, table: posTable, member: posMember, coupon: posCoupon }))
        setDraftSavedAt(new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch { /* ignore */ }
  }, [posCart, posType, posPayment, posTable, posMember, posCoupon, posDraftLoaded])

  const upd = (fn) => setData((d) => fn(structuredClone(d)))
  const actorName = () => (activeStaff ? activeStaff.name : user ? user.name : 'কাস্টমার')
  const isOwner = () => !activeStaff && user && user.role === 'Owner'
  // Effective permissions: Owner sees all; PIN staff sees only their perms.
  const canView = (perm) => {
    if (!perm) return true
    if (activeStaff) return (activeStaff.perms || defaultPermsForStaff(activeStaff)).includes(perm)
    if (user && user.role === 'Owner') return true
    if (user && user.role === 'Staff') return defaultPermsForStaff({ role: 'ওয়েটার' }).includes(perm)
    return true
  }
  const todayOrders = useMemo(() => data.orders.filter((o) => o.date === todayStr()), [data.orders])
  const todaySale = todayOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + total(o), 0)
  const popular = useMemo(() => {
    const m = {}; todayOrders.forEach((o) => o.items.forEach((i) => { m[i.name] = (m[i.name] || 0) + i.qty }))
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [todayOrders])
  // --- v1.6.0 computed values ---
  const topItemsAll = useMemo(() => {
    const m = {}
    data.orders.forEach((o) => o.items.forEach((i) => { m[i.id] = (m[i.id] || 0) + i.qty }))
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, qty]) => ({ menu: data.menu.find((x) => x.id === id), qty })).filter((x) => x.menu)
  }, [data.orders, data.menu])
  const monthKey = todayStr().slice(0, 7)
  const monthBazarTotal = (data.bazar || []).filter((b) => String(b.date || '').startsWith(monthKey)).reduce((s, b) => s + Number(b.cost || 0), 0)
  const totalDueOutstanding = (data.dues || []).reduce((s, d) => s + Math.max(0, Number(d.amount || 0) - Number(d.paid || 0)), 0)
  const openShift = (data.shifts || []).find((s) => !s.closedAt)
  const openOrdersFor = (code) => data.orders.filter((o) => o.table === code && !['paid', 'cancelled'].includes(o.status))
  const tableRunningTotal = (code) => openOrdersFor(code).reduce((s, o) => s + total(o), 0)
  const baseUrl = window.location.origin + window.location.pathname
  const SpeechRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
  const activeBells = data.bells.filter((b) => !b.done)

  function awardPoints(phone, amount) {
    if (!phone) return
    const pts = Math.floor(Number(amount || 0) / 10)
    if (pts <= 0) return
    upd((d) => { const m = d.members.find((x) => x.phone === phone); if (m) m.points = (m.points || 0) + pts; return d })
  }
  function decrementStock(items) {
    upd((d) => { items.forEach((i) => { if (d.stock[i.id] != null) d.stock[i.id] = Math.max(0, d.stock[i.id] - i.qty) }); return d })
  }
  function placeOrder() {
    const items = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => {
      const m = data.menu.find((x) => x.id === id); return { id, name: m.name, price: m.price, qty, station: m.station }
    })
    if (!items.length) { showToast('কার্ট খালি — আগে আইটেম যোগ করুন', 'err'); return }
    const seq = data.seq + 1
    const order = { id: `ORD-${seq}`, date: todayStr(), table: custTable, customer: custName || 'কাস্টমার', items, status: 'new', time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), createdAt: Date.now(), billNo: null, type: 'Dine-in', payment: null, billedBy: actorName() }
    upd((d) => { d.orders.unshift(order); d.seq = seq; return d })
    setCart({}); setLastOrder(order.id); setAlert(order); setView('customer')
  }
  function setStatus(id, status) { upd((d) => { const o = d.orders.find((x) => x.id === id); if (o) o.status = status; return d }) }
  // --- v1.6.0 helpers ---
  const waitMins = (o) => (o.createdAt ? Math.max(0, Math.floor((Date.now() - o.createdAt) / 60000)) : 0)
  const waitClass = (m) => (m < 5 ? 'wait-fresh' : m <= 10 ? 'wait-amber' : 'wait-red')
  // PIN login lands by role/perms, not always Kitchen.
  function pinLandingView(s) {
    const r = String(s.role || '').toLowerCase()
    const perms = s.perms || defaultPermsForStaff(s)
    if (r.includes('cashier') || r.includes('ক্যাশিয়ার')) return 'pos'
    if (r.includes('waiter') || r.includes('ওয়েটার')) return 'tables'
    if (r.includes('owner') || r.includes('মালিক')) return 'dashboard'
    if (perms.includes('pos')) return 'pos'
    if (perms.includes('tables') && perms.includes('order') && !perms.includes('kitchen')) return 'tables'
    if (perms.includes('kitchen') && !perms.includes('pos')) return 'kitchen'
    if (perms.includes('tables')) return 'tables'
    return 'dashboard'
  }
  // KDS Ready: status ready + waiter bell alert + vibrate + toast.
  function markReady(id) {
    const o = data.orders.find((x) => x.id === id)
    if (!o) return
    setStatus(id, 'ready')
    upd((d) => { d.bells.push({ id: `bell-${Date.now()}`, table: o.table, time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), date: todayStr(), done: false, kind: 'ready', note: `${o.id} রেডি` }); return d })
    try { if (navigator.vibrate) navigator.vibrate(200) } catch { /* ignore */ }
    showToast(`🔔 ${o.id} (${o.table}) রেডি — ওয়েটারকে জানানো হয়েছে`)
  }
  // 1-Tap POS: one tap = one paid Cash bill for a single item.
  function quickBill(m) {
    const seq = data.seq + 1; const t = todayStr(); const no = nextBillNo()
    const items = [{ id: m.id, name: m.name, price: m.price, qty: 1, station: m.station }]
    const calc = billCalc(m.price, 0, data.settings.vat, data.settings.service)
    const order = { id: `ORD-${seq}`, date: t, table: 'T-01', customer: 'কাউন্টার কাস্টমার', items, status: 'paid', time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), createdAt: Date.now(), billNo: no, type: 'Dine-in', payment: 'Cash', billedBy: actorName() }
    const b = { no, date: t, orderId: order.id, ...calc, payment: 'Cash', type: 'Dine-in', billedBy: actorName(), createdAt: Date.now() }
    upd((d) => { d.orders.unshift(order); d.bills.push(b); d.seq = seq; return d })
    decrementStock(items)
    setBill({ ...b, order }); showToast(`✅ ${m.name} — ${tk(calc.total)} Cash বিল হয়েছে (${no})`)
  }
  function speakText(text) { try { const u = new SpeechSynthesisUtterance(text); u.lang = 'bn-BD'; window.speechSynthesis.speak(u) } catch { /* ignore */ } }
  function handleVoiceText(text) {
    if (voiceMode === 'order') {
      const p = parseVoiceOrder(text, data.menu)
      if (!p) { setVoiceMsg('আইটেম চেনা যায়নি — মেনুর নাম স্পষ্ট করে বলুন, যেমন "দুইটা স্পেশাল মালাই চা, টেবিল ৫"।'); return }
      const seq = data.seq + 1
      const order = { id: `ORD-${seq}`, date: todayStr(), table: p.table || 'T-01', customer: 'ভয়েস অর্ডার', items: [{ id: p.item.id, name: p.item.name, price: p.item.price, qty: p.qty, station: p.item.station }], status: 'new', time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), createdAt: Date.now(), billNo: null, type: 'Dine-in', payment: null, billedBy: actorName() }
      upd((d) => { d.orders.unshift(order); d.seq = seq; return d })
      setVoiceMsg(`✅ অর্ডার হয়েছে: ${p.item.name} × ${p.qty} — ${p.table || 'T-01'} • ${tk(p.item.price * p.qty)}`)
      showToast('ভয়েস অর্ডার তৈরি হয়েছে')
    } else if (voiceMode === 'bazar') {
      const p = parseVoiceBazar(text)
      if (!p) { setVoiceMsg('আইটেম ও দাম চেনা যায়নি — যেমন বলুন: "দুধ ৫ কেজি ৩০০ টাকা"।'); return }
      upd((d) => { if (!Array.isArray(d.bazar)) d.bazar = []; d.bazar.unshift({ id: `bz-${Date.now()}`, item: p.item, qty: p.qty, cost: p.cost, vendor: '', date: todayStr() }); return d })
      setVoiceMsg(`✅ বাজারে যোগ হয়েছে: ${p.item} × ${p.qty} — ${tk(p.cost)}`)
      showToast('ভয়েস বাজার এন্ট্রি যোগ হয়েছে')
    } else {
      const msg = `আজকের বিক্রি ${tk(todaySale)}, মোট ${bnNum(todayOrders.length)}টি অর্ডার।`
      setVoiceMsg(`🔊 ${msg}`)
      speakText(msg)
    }
  }
  function startVoice() {
    if (!SpeechRec) { setVoiceMsg('এই ব্রাউজারে ভয়েস সাপোর্ট নেই — Chrome ব্রাউজার ব্যবহার করুন।'); return }
    const rec = new SpeechRec()
    rec.lang = 'bn-BD'; rec.interimResults = false; rec.maxAlternatives = 1
    setVoiceListening(true); setVoiceMsg('শুনছি… বলুন।')
    rec.onresult = (e) => { const text = e.results[0][0].transcript; setVoiceText(text); handleVoiceText(text) }
    rec.onerror = (e) => { setVoiceListening(false); setVoiceMsg(`ভয়েস শোনা যায়নি — আবার চেষ্টা করুন। (${e.error || ''})`) }
    rec.onend = () => setVoiceListening(false)
    try { rec.start() } catch { setVoiceListening(false) }
  }
  function nextBillNo() {
    const t = todayStr(); const n = data.bills.filter((b) => b.date === t).length + 1
    return `Bill No-${String(n).padStart(4, '0')}`
  }
  function makeBill(order, payment = 'Cash', couponPct = 0) {
    const t = todayStr(); const no = nextBillNo()
    const calc = billCalc(total(order), couponPct, data.settings.vat, data.settings.service)
    const b = { no, date: t, orderId: order.id, ...calc, payment, type: order.type || 'Dine-in', billedBy: actorName(), createdAt: Date.now() }
    upd((d) => { d.bills.push(b); const o = d.orders.find((x) => x.id === order.id); if (o) { o.status = 'paid'; o.billNo = no; o.payment = payment; o.billedBy = b.billedBy } if (payment === 'Due') { if (!Array.isArray(d.dues)) d.dues = []; d.dues.push({ id: `due-${Date.now()}`, date: t, orderId: order.id, customer: order.customer || 'কাউন্টার কাস্টমার', table: order.table || '', amount: calc.total, paid: 0, createdAt: Date.now() }) } return d })
    decrementStock(order.items)
    if (order.memberPhone) awardPoints(order.memberPhone, calc.total)
    setBill({ ...b, order }); setStatus(order.id, 'paid')
  }
  function reprintBill(order) {
    const b = [...data.bills].reverse().find((x) => x.orderId === order.id)
    if (!b) { showToast('এই অর্ডারের কোনো বিল পাওয়া যায়নি', 'err'); return }
    setBill({ ...b, order })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  // --- Menu scan: OCR text -> parse -> AUTO-ADD straight to the Menu.
  // No preview/confirm step (Sir's rule, same as CafePilot): a wrong item
  // goes live and the owner deletes it from the Menu page afterwards.
  function applyScanResult(parsed) {
    if (parsed.items.length) {
      const base = Date.now()
      upd((d) => {
        parsed.items.forEach((it, i) => {
          const id = `m${base}-${i}`
          d.menu.push({ id, ...it })
          d.stock[id] = 20
        })
        return d
      })
    }
    setScanResult(parsed)
  }
  async function runScanFromText(text) {
    const parsed = parseMenuText(text, data.menu)
    applyScanResult(parsed)
    return parsed
  }
  async function runScanPhoto() {
    if (!scanFile) { setScanError('আগে মেনুর একটা ছবি বেছে নিন'); return }
    setScanError(''); setScanResult(null); setScanBusy(true); setScanProgress(0); setScanStatus('ছবি পড়া হচ্ছে…')
    try {
      const { data: { text } } = await Tesseract.recognize(scanFile, 'ben+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') { setScanProgress(Math.round((m.progress || 0) * 100)); setScanStatus(`ছবি পড়া হচ্ছে… ${Math.round((m.progress || 0) * 100)}%`) }
          else if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata') setScanStatus('OCR মডেল নামছে… (প্রথমবার একটু সময় লাগবে)')
        },
      })
      setScanStatus('লেখা পার্স করা হচ্ছে…')
      await runScanFromText(text)
      setScanStatus('')
    } catch (e) {
      setScanError('স্ক্যান করা যায়নি — নেট আছে কিনা দেখুন, আরেকবার চেষ্টা করুন। (' + (e && e.message ? String(e.message).slice(0, 80) : 'অজানা ত্রুটি') + ')')
    } finally { setScanBusy(false); setScanProgress(0) }
  }
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => { const m = data.menu.find((x) => x.id === id); return s + (m ? m.price * q : 0) }, 0)
  const lastOrderObj = data.orders.find((o) => o.id === lastOrder)
  const kdsOrders = data.orders.filter((o) => ['new', 'confirmed', 'ready'].includes(o.status))

  const PAGE_PERM = { menu: 'menu', tables: 'tables', orders: 'order', pos: 'pos', kitchen: 'kitchen', delivery: 'order', catering: 'order', members: 'order', reviews: 'order', bookings: 'order', money: 'reports', reports: 'reports', analytics: 'reports', expenses: 'reports', dayclose: 'pos', staff: 'staff', leave: 'staff', stock: 'menu', offers: 'pos', settings: null, bazar: 'reports', vendors: 'reports', shift: 'pos', due: 'pos', voice: 'order', branches: null, growth: 'reports', sop: null, salary: 'staff', alltools: null }
  // Sidebar — exactly the screenshot's menu (CafePilot SIDEBAR, same groups, order and labels).
  // Screenshot items first in each group; Diploma extras kept after them inside the matching group.
  const NAV_GROUPS = [
    { key: 'menu', label: 'মেনু ও টেবিল', items: [['menu', '🍽️ মেনু'], ['tables', '🪑 টেবিল ও QR']] },
    { key: 'sell', label: 'বিক্রি', items: [['orders', '🧾 অর্ডার'], ['pos', '💰 POS / বিল'], ['kitchen', '👨‍🍳 কিচেন ডিসপ্লে'], ['voice', '🎙️ ভয়েস অর্ডার']] },
    { key: 'customer', label: 'কাস্টমার', items: [['members', '👤 মেম্বার ও পয়েন্ট'], ['reviews', '⭐ রিভিউ ও গাইড'], ['customer', '🛒 কাস্টমার মেনু'], ['bookings', '📅 বুকিং']] },
    { key: 'money', label: 'টাকা ও হিসাব', items: [['money', '💵 টাকা ও হিসাব'], ['reports', '📈 রিপোর্ট ও অ্যানালিটিকস'], ['offers', '🎁 অফার ও কুপন'], ['analytics', '📊 অ্যানালিটিকস'], ['expenses', '💸 খরচ'], ['vendors', '🏪 ভেন্ডর'], ['shift', '💵 ক্যাশ ড্রয়ার / শিফট'], ['due', '📒 বাকি (Due)'], ['dayclose', '🌙 দিনের হিসাব বন্ধ']] },
    { key: 'manage', label: 'পরিচালনা', items: [['staff', '👥 স্টাফ ও HR'], ['bazar', '🥬 বাজার ও স্টক'], ['delivery', '🛵 হোম ডেলিভারি'], ['catering', '🍱 ক্যাটারিং'], ['stock', '📦 স্টক'], ['salary', '💰 বেতন'], ['leave', '🏖️ স্টাফ ছুটি']] },
    { key: 'tools', label: 'আরও টুল', items: [['growth', '📣 বিক্রি বাড়ান'], ['alltools', '🧰 সব টুল'], ['sop', '📋 SOP — কাজের নিয়ম']] },
    { key: 'settings', label: 'সেটিংস', items: [['settings', '⚙️ সেটিংস'], ['branches', '🏬 শাখা']] },
  ]
  const toggleGroup = (k) => setOpenGroups((g) => ({ ...g, [k]: !g[k] }))

  const staffSummary = useMemo(() => {
    const m = {}
    todayOrders.forEach((o) => {
      const name = o.billedBy || '—'
      if (!m[name]) m[name] = { name, orders: 0, bills: 0, money: 0 }
      m[name].orders += 1
      if (o.status === 'paid') { m[name].bills += 1; m[name].money += total(o) }
    })
    return Object.values(m).sort((a, b) => b.money - a.money)
  }, [todayOrders])

  // --- Customer menu view (also used inside the staff shell) ---
  const customerView = (
    <section>
      <h2>🛒 কাস্টমার মেনু — {custTable} {data.tables.find((t) => t.code === custTable)?.name || ''}</h2>
      <div className="menu-form"><label>টেবিল: <select value={custTable} onChange={(e) => setCustTable(e.target.value)}>{data.tables.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}</select></label><input placeholder="আপনার নাম (ঐচ্ছিক)" value={custName} onChange={(e) => setCustName(e.target.value)} />
        <button onClick={() => { upd((d) => { d.bells.push({ id: `bell-${Date.now()}`, table: custTable, time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), date: todayStr(), done: false }); return d }); showToast(`🔔 ওয়েটারকে ডাকা হয়েছে — ${custTable}। একটু অপেক্ষা করুন।`) }}>🔔 ওয়েটার ডাকুন</button></div>
      {lastOrderObj && <div className="box tracker"><h3>📍 আপনার অর্ডার ট্র্যাকার — {lastOrderObj.id}</h3><p>স্ট্যাটাস: <b>{STATUS[lastOrderObj.status]}</b> {lastOrderObj.billNo ? `• ${lastOrderObj.billNo}` : ''}</p><p>মোট: {tk(total(lastOrderObj))}</p><div className="steps">{['new', 'confirmed', 'ready', 'served', 'paid'].map((s) => <span key={s} className={['new', 'confirmed', 'ready', 'served', 'paid'].indexOf(lastOrderObj.status) >= ['new', 'confirmed', 'ready', 'served', 'paid'].indexOf(s) ? 'done' : ''}>{STATUS[s]}</span>)}</div>
        {['served', 'paid'].includes(lastOrderObj.status) && <div className="review-form"><h4>💬 আপনার অভিজ্ঞতা কেমন ছিল? রিভিউ দিন</h4>
          <div className="menu-form"><input placeholder="আপনার নাম" value={reviewForm.name} onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })} />
            <select value={reviewForm.stars} onChange={(e) => setReviewForm({ ...reviewForm, stars: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{'⭐'.repeat(s)} ({s})</option>)}</select>
            <input placeholder="মন্তব্য লিখুন (ঐচ্ছিক)" value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} />
            <button onClick={() => { if (!reviewForm.name) return showToast('নাম দিন', 'err'); upd((d) => { d.reviews.unshift({ id: `rv-${Date.now()}`, date: todayStr(), orderId: lastOrderObj.id, table: lastOrderObj.table, name: reviewForm.name, stars: reviewForm.stars, comment: reviewForm.comment, reply: '' }); return d }); setReviewForm({ name: '', stars: 5, comment: '' }); showToast('ধন্যবাদ! আপনার রিভিউ সংরক্ষিত হয়েছে।') }}>✅ রিভিউ পাঠান</button></div></div>}
      </div>}
      <div className="chips">{['সব', ...CATS].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="menu-grid">{data.menu.filter((m) => m.active && (cat === 'সব' || m.cat === cat)).map((m) => <div key={m.id} className="menu-item"><b>{m.name}</b><span>{m.cat} • {m.station}</span><strong>{tk(m.price)}</strong><div className="qty"><button onClick={() => setCart((c) => ({ ...c, [m.id]: Math.max(0, (c[m.id] || 0) - 1) }))}>−</button><b>{cart[m.id] || 0}</b><button onClick={() => setCart((c) => ({ ...c, [m.id]: (c[m.id] || 0) + 1 }))}>+</button></div></div>)}</div>
      {!data.menu.some((m) => m.active && (cat === 'সব' || m.cat === cat)) && <p className="empty">এই ক্যাটাগরিতে কোনো চালু আইটেম নেই।</p>}
      <div className="cart-bar">🛒 মোট: <b>{tk(cartTotal)}</b> <button disabled={!cartTotal} onClick={placeOrder}>অর্ডার দিন →</button></div>
    </section>
  )

  // --- Bill card (shown after makeBill / reprint, in any view) ---
  const billCard = bill && (
    <div className="box print-area"><div className={`bill bill-${billSize}`}><img src="/logo.jpg" alt="লোগো" style={{ width: 70, borderRadius: '50%' }} /><h3>{data.settings.shop}</h3><p>{data.settings.address}{realPhone(data.settings.phone) ? ` • ${realPhone(data.settings.phone)}` : ''}</p><hr /><p><b>{bill.no}</b> • অর্ডার {bill.orderId} • {bill.date}</p><p>{bill.type || 'Dine-in'} • পেমেন্ট: {bill.payment || 'Cash'} • বিল করেছেন: {bill.billedBy || '—'}</p>{bill.order.items.map((i) => <p key={i.id}>{i.name} × {i.qty} — {tk(i.price * i.qty)}</p>)}<hr />
      <p>সাবটোটাল: {tk(bill.subtotal ?? bill.total)}</p>
      {bill.discount ? <p>কুপন ছাড়: −{tk(bill.discount)}</p> : null}
      {bill.vat ? <p>ভ্যাট ({data.settings.vat}%): {tk(bill.vat)}</p> : null}
      {bill.service ? <p>সার্ভিস চার্জ ({data.settings.service}%): {tk(bill.service)}</p> : null}
      <p><b>মোট: {tk(bill.total)}</b></p><p>ধন্যবাদ, আবার আসবেন! ☕</p><div className="row no-print" style={{ justifyContent: 'center' }}><span>কাগজ:</span><button className={billSize === '58' ? 'on' : ''} onClick={() => setBillSize('58')}>58mm</button><button className={billSize === '80' ? 'on' : ''} onClick={() => setBillSize('80')}>80mm</button></div><button className="no-print" onClick={() => window.print()}>🖨️ প্রিন্ট</button> <button className="no-print" onClick={() => setBill(null)}>বন্ধ</button></div></div>
  )

  // --- First screen: Landing page, then Login / Sign Up. Customer QR view (?table=...) needs no login. ---
  if (!user && !isCustomer && !guestCustomer) {
    if (showLanding) {
      return (
        <div className={`app landing theme-${data.settings.theme || 'brown'}`}>
          {toastEl}
          <header className="hero">
            <img src="/logo.jpg" alt="দ্য ডিপ্লোমা পাস চা-ওয়ালা লোগো" className="logo hero-logo" />
            <h1>দ্য ডিপ্লোমা পাস চা-ওয়ালা</h1>
            <p className="tagline">চা, গল্প, আড্ডা — আপনার ক্যাফের পুরো ম্যানেজমেন্ট, এক জায়গায়।</p>
            <p className="hero-meta">📍 {data.settings.address} • 🕙 {data.settings.open}</p>
            <div className="hero-actions">
              <button className="btn-primary" onClick={() => { setAuthTab('login'); setShowLanding(false) }}>🔑 লগইন</button>
              <button className="btn-gold" onClick={() => { setAuthTab('signup'); setShowLanding(false) }}>✅ সাইন আপ</button>
              <button className="btn-ghost" onClick={() => setGuestCustomer(true)}>🛒 কাস্টমার মেনু</button>
            </div>
          </header>
          <section className="feature-grid">
            {[['📸 ছবি থেকে মেনু', 'মেনুর ছবি থেকে আইটেম অটো-অ্যাড'], ['🪑 QR মেনু', 'টেবিলের QR স্ক্যান করলেই অর্ডার'], ['🧾 অর্ডার', 'নতুন থেকে বিল পেইড পর্যন্ত ট্র্যাক'], ['👨‍🍳 কিচেন (KDS)', 'স্টেশন অনুযায়ী কাজ ভাগ'], ['💰 POS + বিল', 'বিল নং, ভ্যাট, কুপন, প্রিন্ট'], ['📊 রিপোর্ট', 'বিক্রি, অ্যানালিটিক্স, দিনের হিসাব']].map(([t, d]) => <div key={t} className="feature-card"><b>{t}</b><span>{d}</span></div>)}
          </section>
          <footer>© {new Date().getFullYear()} {data.settings.shop} • {data.settings.address} • {VERSION}</footer>
        </div>
      )
    }
    return (
      <div className={`app auth-wrap theme-${data.settings.theme || 'brown'}`}>
        {toastEl}
      <div className="auth-card">
          <button className="link-btn no-print" onClick={() => setShowLanding(true)}>← হোমে ফিরুন</button>
          <img src="/logo.jpg" alt="দ্য ডিপ্লোমা পাস চা-ওয়ালা লোগো" className="logo auth-logo" />
          <h1>দ্য ডিপ্লোমা পাস চা-ওয়ালা</h1>
          <p>Diploma Pass Cha-Wala • চা, গল্প, আড্ডা</p>
          <div className="auth-tabs">
            <button className={authTab === 'login' ? 'on' : ''} onClick={() => { setAuthTab('login'); setAuthErr(''); setAuthMsg('') }}>লগইন</button>
            <button className={authTab === 'signup' ? 'on' : ''} onClick={() => { setAuthTab('signup'); setAuthErr(''); setAuthMsg('') }}>সাইন আপ</button>
          </div>
          {authErr && <p className="auth-err">{authErr}</p>}
          {authMsg && <p className="auth-ok">{authMsg}</p>}
          {authTab === 'login' ? (
            <div className="form auth-form">
              <label>ইমেইল <input type="email" placeholder="আপনার ইমেইল" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
              <label>পাসওয়ার্ড <input type="password" placeholder="পাসওয়ার্ড" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') doLogin() }} /></label>
              <button onClick={doLogin}>🔑 লগইন করুন</button>
              <p className="note">অ্যাকাউন্ট নেই? উপরে <b>সাইন আপ</b> ট্যাবে নতুন অ্যাকাউন্ট খুলুন।</p>
            </div>
          ) : (
            <div className="form auth-form">
              <label>নাম <input placeholder="আপনার নাম" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></label>
              <label>ইমেইল <input type="email" placeholder="আপনার ইমেইল" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
              <label>পাসওয়ার্ড <input type="password" placeholder="কমপক্ষে ৬ অক্ষর" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} /></label>
              <label>পাসওয়ার্ড আবার দিন <input type="password" placeholder="পাসওয়ার্ড নিশ্চিত করুন" value={authForm.confirm} onChange={(e) => setAuthForm({ ...authForm, confirm: e.target.value })} /></label>
              <label>ভূমিকা <select value={authForm.role} onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}><option>Owner</option><option>Staff</option></select></label>
              <label>দোকানের নাম <input placeholder="দোকানের নাম" value={authForm.shop} onChange={(e) => setAuthForm({ ...authForm, shop: e.target.value })} /></label>
              <button onClick={doSignup}>✅ সাইন আপ করুন</button>
              <p className="note">সাইন আপ করলেই সরাসরি ড্যাশবোর্ডে যাবেন।</p>
            </div>
          )}
          <p className="auth-foot">কাস্টমার? লগইন লাগবে না — টেবিলের QR স্ক্যান করলেই মেনু খুলবে।<br /><small>{VERSION}</small></p>
        </div>
      </div>
    )
  }

  // --- Customer QR view: no login, no sidebar ---
  if (isCustomer || guestCustomer) {
    return (
      <div className={`app theme-${data.settings.theme || 'brown'}`}>
        <header className="header">
          <img src="/logo.jpg" alt="দ্য ডিপ্লোমা পাস চা-ওয়ালা লোগো" className="logo" />
          <div><h1>{data.settings.shop}</h1><p>Diploma Pass Cha-Wala • চা, গল্প, আড্ডা • {data.settings.open}</p></div>
          <div className="head-right">{realPhone(data.settings.phone) && <span>📞 {realPhone(data.settings.phone)}</span>}<span>📍 {data.settings.address}</span>{guestCustomer && <span className="row"><button className="no-print" onClick={() => { setGuestCustomer(false); setShowLanding(true) }}>← হোম</button><button className="no-print" onClick={() => { setGuestCustomer(false); setShowLanding(false); setAuthTab('login') }}>🔑 লগইন</button></span>}</div>
        </header>
        {toastEl}
        <main>{customerView}</main>
        <footer>© {new Date().getFullYear()} {data.settings.shop} • {data.settings.address} • {VERSION} • ডেটা এই ব্রাউজারে সংরক্ষিত থাকে</footer>
      </div>
    )
  }

  const sidebar = (
    <aside className="sidebar">
      <div className="side-head">
        <img src="/logo.jpg" alt="লোগো" className="side-logo" />
        <div><b>{data.settings.shop}</b><small>Diploma Pass Cha-Wala</small></div>
      </div>
      <nav className="side-nav">
        <button className={view === 'dashboard' ? 'side-item on' : 'side-item'} onClick={() => setView('dashboard')}>📊 ড্যাশবোর্ড</button>
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter(([, k]) => canView(PAGE_PERM[k]))
          if (!items.length) return null
          return (
            <div key={g.key} className="side-group">
              <button className="side-group-label" onClick={() => toggleGroup(g.key)}>{openGroups[g.key] ? '▾' : '▸'} {g.label}</button>
              {openGroups[g.key] && items.map(([k, l]) => <button key={k} className={view === k ? 'side-item on' : 'side-item'} onClick={() => setView(k)}>{l}</button>)}
            </div>
          )
        })}
      </nav>
      <div className="side-foot"><small>👤 {activeStaff ? `${activeStaff.name} (স্টাফ)` : user ? `${user.name} (${user.role})` : 'কাস্টমার'}</small><small>{VERSION}</small><button onClick={doLogout}>🚪 লগআউট</button></div>
    </aside>
  )

  const denied = <section><div className="box"><h2>🚫 অনুমতি নেই</h2><p>এই পাতাটি দেখার অনুমতি আপনার নেই। মালিকের সঙ্গে যোগাযোগ করুন।</p></div></section>
  const viewPerm = PAGE_PERM[view]

  return (
    <div className={`app layout theme-${data.settings.theme || 'brown'}`}>
      {sidebar}
      <div className="content">
        <header className="topbar">
          {realPhone(data.settings.phone) && <span>📞 {realPhone(data.settings.phone)}</span>}<span>📍 {data.settings.address}</span>
          <span>👤 {activeStaff ? `${activeStaff.name} (স্টাফ)` : user ? `${user.name} (${user.role})` : 'কাস্টমার'}</span>
          {user && <button onClick={doLogout}>🚪 লগআউট</button>}
        </header>
        {toastEl}
        {alert && <div className="alert">🔔 নতুন অর্ডার! <b>{alert.id}</b> — {alert.table} • {tk(total(alert))} <button onClick={() => { setAlert(null); setView('orders') }}>অর্ডার দেখুন</button> <button onClick={() => setAlert(null)}>✕</button></div>}
        {billCard}
        <main>
          {viewPerm && !canView(viewPerm) ? denied : (<>
          {view === 'dashboard' && <section>
            <h2>📊 আজকের ড্যাশবোর্ড — {dhakaLong()}</h2>
            {activeBells.length > 0 && <div className="box bell-box"><h3>🔔 ওয়েটার ডাক — {bnNum(activeBells.length)}টি</h3>{activeBells.map((b) => <p key={b.id}><b>{b.table}</b> থেকে ডেকেছে • {b.time} <button onClick={() => upd((d) => { const x = d.bells.find((y) => y.id === b.id); if (x) x.done = true; return d })}>✅ গেছি / বাতিল</button></p>)}</div>}
            <div className="cards">
              <div className="card"><b>{tk(todaySale)}</b><span>আজকের মোট বিক্রি</span></div>
              <div className="card"><b>{bnNum(todayOrders.length)}</b><span>মোট অর্ডার</span></div>
              <div className="card"><b>{bnNum(todayOrders.filter((o) => o.status === 'new').length)}</b><span>নতুন / পেন্ডিং</span></div>
              <div className="card"><b>{bnNum(todayOrders.filter((o) => o.status === 'ready').length)}</b><span>রেডি</span></div>
            </div>
            <div className="grid2">
              <div className="box"><h3>🔥 জনপ্রিয় আইটেম (আজ)</h3>{popular.length ? popular.map(([n, q]) => <p key={n}>{n} — <b>{bnNum(q)}টি</b></p>) : <p>এখনো অর্ডার নেই।</p>}</div>
              <div className="box"><h3>🕒 সাম্প্রতিক অর্ডার</h3>{todayOrders.length ? todayOrders.slice(0, 5).map((o) => <p key={o.id}>{o.id} • {o.table} • {tk(total(o))} • <b>{STATUS[o.status]}</b></p>) : <p className="empty">আজ এখনো কোনো অর্ডার নেই।</p>}</div>
            </div>
            <div className="box"><h3>👥 আজকে কে কত অর্ডার / বিল তুলেছে</h3>
              {staffSummary.length ? <table className="tbl"><thead><tr><th>স্টাফ</th><th>অর্ডার</th><th>বিল</th><th>টাকা</th></tr></thead><tbody>
                {staffSummary.map((s) => <tr key={s.name}><td>{s.name}</td><td>{bnNum(s.orders)}</td><td>{bnNum(s.bills)}</td><td>{tk(s.money)}</td></tr>)}
                <tr><td><b>মোট</b></td><td><b>{bnNum(staffSummary.reduce((a, s) => a + s.orders, 0))}</b></td><td><b>{bnNum(staffSummary.reduce((a, s) => a + s.bills, 0))}</b></td><td><b>{tk(staffSummary.reduce((a, s) => a + s.money, 0))}</b></td></tr>
              </tbody></table> : <p>আজকে এখনো কেউ অর্ডার/বিল নেয়নি।</p>}
            </div>
            <p className="note">📱 সিঙ্ক নোট: সব ডেটা এই ডিভাইসের ব্রাউজারের localStorage-এ থাকে। অন্য ফোনে একই ডেটা দেখতে শেয়ার্ড ডেটাবেস / ব্যাকএন্ড লাগবে। <button onClick={() => { if (confirm('সব ডেটা রিসেট করে ডেমো ডেটা ফেরাবেন?')) { const s = seed(); setData(s); localStorage.setItem(KEY, JSON.stringify(s)) } }}>ডেমো ডেটা রিসেট</button></p>
          </section>}

          {view === 'menu' && <section>
            <h2>🍵 মেনু ম্যানেজমেন্ট — {bnNum(data.menu.filter((m) => m.active).length)}টি আইটেম</h2>
          <div className="box">
            <h3>📸 ছবি থেকে মেনু যোগ করুন</h3>
            <p>মেনুর ছবি তুলুন বা আপলোড করুন — ছবি থেকে আইটেম পড়ে <b>সরাসরি মেনুতে যোগ হয়ে যাবে</b>, কোনো কনফার্ম লাগবে না। ভুল আইটেম ঢুকলে মেনু পাতা থেকে মুছে ফেলবেন।</p>
            <div className="box">
              <div className="menu-form">
                <label className="file-btn">📷 ছবি তুলুন / বেছে নিন
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (!f) return; setScanFile(f); setScanResult(null); setScanError(''); try { setScanPreview(URL.createObjectURL(f)) } catch { setScanPreview('') } }} />
                </label>
                <button disabled={scanBusy || !scanFile} onClick={runScanPhoto}>{scanBusy ? '⏳ স্ক্যান চলছে…' : '🔍 স্ক্যান করুন — আইটেম নিজে থেকে যোগ হবে'}</button>
              </div>
              {scanPreview && <div className="scan-preview"><img src={scanPreview} alt="মেনুর ছবি" /></div>}
              {scanBusy && <div className="scan-progress"><div className="scan-bar" style={{ width: `${scanProgress}%` }} /><p>{scanStatus || `স্ক্যান চলছে… ${scanProgress}%`}</p></div>}
              {scanError && <p className="auth-err">{scanError}</p>}
              {scanResult && <div className="box scan-result">
                <h3>✅ স্ক্যান শেষ</h3>
                <p>➕ মেনুতে যোগ হয়েছে: <b>{bnNum(scanResult.added)}টি</b></p>
                <p>🔁 আগে থেকেই ছিল (বাদ দেওয়া হয়েছে): <b>{bnNum(scanResult.duplicates)}টি</b></p>
                <p>🚫 দাম পাওয়া যায়নি / বাদ পড়েছে: <b>{bnNum(scanResult.dropped)}টি</b> লাইন</p>
                {scanResult.items.length > 0 && <ul>{scanResult.items.map((it, i) => <li key={i}>{it.name} — {it.cat} — {tk(it.price)}</li>)}</ul>}
              </div>}
              <p className="note">💡 ভালো ফলের টিপস: পরিষ্কার আলোতে সোজা করে ছবি তুলুন, লেখা বড় ও পরিষ্কার রাখুন। OCR মাঝে মাঝে ১-২ অক্ষর ভুল পড়ে (যেমন কোল্ড → কোক্ত) — মেনু পাতায় গিয়ে নাম ঠিক করে নেবেন। বাংলা হাতের লেখা ও খুব ছোট ফন্টে কম আইটেম পেতে পারে। ইংরেজি সংখ্যা (50, 120) বাংলা সংখ্যার (৫০, ১২০) চেয়ে ভালো পড়ে। প্রথমবার OCR মডেল ডাউনলোড হতে একটু সময় লাগবে।</p>
            </div>
            <div className="box">
              <h3>⌨️ অথবা লেখা বসিয়ে স্ক্যান করুন</h3>
              <p>ছবি না থাকলে মেনুর লেখা এখানে বসান — এক লাইনে এক আইটেম, শেষে দাম (যেমন: মসলা চা ৩৫)।</p>
              <textarea rows={5} style={{ width: '100%', padding: 10, border: '1px solid #d8c690', borderRadius: 8 }} placeholder={'স্পেশাল মালাই চা ৫০\nমসলা চা ৩৫\nকোল্ড কফি ১২০'} value={scanText} onChange={(e) => setScanText(e.target.value)} />
              <div className="menu-form"><button disabled={scanBusy || !scanText.trim()} onClick={async () => { setScanError(''); setScanResult(null); setScanBusy(true); try { await runScanFromText(scanText) } finally { setScanBusy(false) } }}>🔍 লেখা থেকে আইটেম যোগ করুন</button></div>
            </div>
          </div>
            <div className="chips">{['সব', ...CATS].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
            <div className="menu-form">
              <input placeholder="নতুন আইটেমের নাম" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <select value={newItem.cat} onChange={(e) => setNewItem({ ...newItem, cat: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              <input type="number" placeholder="দাম (৳)" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
              <select value={newItem.station} onChange={(e) => setNewItem({ ...newItem, station: e.target.value })}>{STATIONS.map((s) => <option key={s}>{s}</option>)}</select>
              <button onClick={() => { if (!newItem.name || !newItem.price) return showToast('নাম ও দাম দিন', 'err'); const nid = `m${Date.now()}`; upd((d) => { d.menu.push({ id: nid, name: newItem.name, cat: newItem.cat, price: Number(newItem.price), station: newItem.station, active: true }); d.stock[nid] = 20; return d }); setNewItem({ name: '', cat: 'দুধ চা', price: '', station: 'Drinks' }) }}>➕ যোগ করুন</button>
            </div>
            <table className="tbl"><thead><tr><th>আইটেম</th><th>ক্যাটাগরি</th><th>স্টেশন</th><th>দাম</th><th>চালু</th><th></th></tr></thead><tbody>
              {data.menu.filter((m) => cat === 'সব' || m.cat === cat).map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.cat}</td><td>{m.station}</td><td>{tk(m.price)}</td><td><button onClick={() => upd((d) => { d.menu.find((x) => x.id === m.id).active = !m.active; return d })}>{m.active ? '✅ চালু' : '⛔ বন্ধ'}</button></td><td><button onClick={() => { if (confirm(`"${m.name}" মুছবেন?`)) upd((d) => { d.menu = d.menu.filter((x) => x.id !== m.id); return d }) }}>🗑️</button></td></tr>)}
            </tbody></table>
          </section>}

          {view === 'tables' && <section>
            <h2>🪑 টেবিল + QR — {bnNum(data.tables.length)}টি টেবিল</h2>
            <p>কাস্টমার টেবিলের QR স্ক্যান করলেই ওই টেবিলের মেনু খুলবে। QR প্রিন্ট করে টেবিলে লাগান।</p>
            <div className="add-table-form no-print"><b>+ নতুন টেবিল</b><div className="row"><input placeholder={nextTableCode()} value={newTable} onChange={(e) => setNewTable(e.target.value)} /><input type="number" min="1" max="20" placeholder="সিট" value={newTableSeats} onChange={(e) => setNewTableSeats(e.target.value)} /><button className="btn-brown" onClick={addTable}>টেবিল যোগ করুন</button></div><div className="row"><button onClick={() => window.print()}>🖨️ সব QR প্রিন্ট</button></div></div>
            <div className="qr-grid print-area">{data.tables.map((t) => { const url = `${baseUrl}?table=${t.code}`; return (<div key={t.code} className={`qr-card${printTable === t.code ? ' print-one' : ''}`}><div className="qr-print-head print-only"><img src="/logo.jpg" alt="" className="qr-print-logo" /><div><b>{data.settings.shop}</b><small>{data.settings.address}</small></div></div><b className="qr-head">{t.name}<span className="qr-seats"> • {bnNum(t.seats || 5)} সিট</span></b><div className="qr-box"><QRCodeSVG value={url} size={180} /></div><small className="qr-url">{url}</small><p className="qr-print-cta print-only">QR স্ক্যান করে অর্ডার করুন</p><div className="row qr-actions no-print"><button onClick={() => copyTableLink(url)}>🔗 লিংক কপি</button><button onClick={() => printOneTable(t.code)}>🖨️ QR প্রিন্ট</button><button className="btn-danger" onClick={() => { if (confirm(`${t.name} (${t.code}) মুছবেন?`)) upd((d) => { d.tables = d.tables.filter((x) => x.code !== t.code); return d }) }}>🗑️ মুছুন</button></div></div>) })}</div>
          </section>}


          {view === 'customer' && customerView}

          {view === 'orders' && <section>
            <h2>🧾 অর্ডার — আজ {bnNum(todayOrders.length)}টি</h2>
            {todayOrders.map((o) => <div key={o.id} className="box order"><b>{o.id}</b> • {o.table} • {o.customer} • {o.time} • <b>{STATUS[o.status]}</b> • {o.type || 'Dine-in'} {o.payment ? `• ${o.payment}` : ''} {o.billedBy ? `• ${o.billedBy}` : ''}<p>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</p><p>মোট: <b>{tk(total(o))}</b> {o.billNo && `• ${o.billNo}`}</p>
              <div className="row">{o.status === 'new' && <button onClick={() => setStatus(o.id, 'confirmed')}>✅ কনফার্ম</button>}{o.status === 'confirmed' && <button onClick={() => setStatus(o.id, 'ready')}>🍵 রেডি</button>}{o.status === 'ready' && <button onClick={() => setStatus(o.id, 'served')}>🍽️ পরিবেশন</button>}{o.status === 'served' && <button onClick={() => makeBill(o)}>💰 বিল করুন</button>}{o.status === 'paid' && <button onClick={() => reprintBill(o)}>🖨️ বিল আবার প্রিন্ট</button>}{['new', 'confirmed'].includes(o.status) && <button onClick={() => { if (confirm('অর্ডার বাতিল করবেন?')) setStatus(o.id, 'cancelled') }}>❌ বাতিল</button>}</div></div>)}
            {!todayOrders.length && <p>আজ এখনো কোনো অর্ডার নেই।</p>}
          </section>}

          {view === 'kitchen' && <section>
            <h2>👨‍🍳 কিচেন ডিসপ্লে (KDS)</h2>
            <p>স্টাফ: {activeStaff ? `${activeStaff.name} (${activeStaff.station === 'All' ? 'সব স্টেশন' : activeStaff.station + ' শুধু'}) — ` : 'কেউ লগইন করেনি — সব স্টেশন দেখা যাচ্ছে। '} <button onClick={() => setActiveStaff(null)}>লগআউট</button></p>
            <p className="note">⏱️ অপেক্ষার রং: <span className="wait-fresh">সবুজ — ৫ মিনিটের কম</span> • <span className="wait-amber">হলুদ — ৫–১০ মিনিট</span> • <span className="wait-red">লাল — ১০ মিনিটের বেশি</span> • পুরনো টিকিট আগে।<span style={{ display: 'none' }}>{kdsTick}</span></p>
            <h3>🎫 টিকিট — পুরনো আগে ({bnNum(kdsOrders.length)}টি)</h3>
            {[...kdsOrders].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map((o) => { const w = waitMins(o); return (<div key={o.id} className={`box kds-ticket ${waitClass(w)}`}><b>{o.id}</b> • {o.table} • {o.time} • ⏱️ {bnNum(w)} মিনিট • <b>{STATUS[o.status]}</b><p>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</p><p>মোট: <b>{tk(total(o))}</b></p>{['new', 'confirmed'].includes(o.status) && <button onClick={() => markReady(o.id)}>🔔 রেডি — ওয়েটারকে জানান</button>}{o.status === 'ready' && <span> ✅ রেডি — ওয়েটারকে জানানো হয়েছে</span>}</div>) })}
            {!kdsOrders.length && <p>কোনো কাজ নেই।</p>}
            <div className="chips">{['All', ...STATIONS].map((s) => <button key={s} className={(activeStaff ? activeStaff.station : kdsStation) === s ? 'on' : ''} onClick={() => setKdsStation(s)}>{s === 'All' ? 'সব' : s}</button>)}</div>
            <div className="grid2">{STATIONS.filter((s) => (activeStaff ? activeStaff.station : kdsStation) === 'All' || (activeStaff ? activeStaff.station : kdsStation) === s).map((st) => <div key={st} className="box"><h3>{st}</h3>{kdsOrders.flatMap((o) => o.items.filter((i) => i.station === st).map((i) => ({ o, i }))).map(({ o, i }, idx) => <p key={idx}><b>{o.table}</b> — {i.name} × {i.qty} <small>({o.id} • {STATUS[o.status]})</small></p>)}{!kdsOrders.some((o) => o.items.some((i) => i.station === st)) && <p>কোনো কাজ নেই।</p>}</div>)}</div>
          </section>}

          {view === 'pos' && <section>
            <h2>💰 POS + বিল</h2>
            <p>কাউন্টার থেকে সরাসরি বিল করুন — ধরন, পেমেন্ট মাধ্যম ও কুপন বেছে নিন। ভ্যাট {data.settings.vat}% ও সার্ভিস চার্জ {data.settings.service}% সেটিংস থেকে ধরা হয়। ড্রাফট নিজে থেকে সংরক্ষিত হয় {draftSavedAt ? `✓ ${draftSavedAt}` : ''}।</p>
            <div className="box"><h3>⚡ ১-ট্যাপ বিল — সবচেয়ে বেশি বিক্রি হওয়া ৫টি</h3><p>এক ট্যাপেই একটা আইটেমের Cash বিল হয়ে যাবে, বিল উপরেই দেখাবে।</p><div className="row">{(topItemsAll.length ? topItemsAll : data.menu.filter((m) => m.active).slice(0, 5).map((m) => ({ menu: m, qty: 0 }))).map(({ menu: m, qty }) => <button key={m.id} className="quick-bill" onClick={() => quickBill(m)}>⚡ {m.name}<br />{tk(m.price)}{qty ? ` • ${bnNum(qty)}টি বিক্রি` : ''}</button>)}</div></div>
            <div className="menu-form">
              <label>ধরন: <select value={posType} onChange={(e) => setPosType(e.target.value)}>{ORDER_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label>পেমেন্ট: <select value={posPayment} onChange={(e) => setPosPayment(e.target.value)}>{PAYMENTS.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label>টেবিল: <select value={posTable} onChange={(e) => setPosTable(e.target.value)}>{data.tables.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}</select></label>
              <label>মেম্বার: <select value={posMember} onChange={(e) => setPosMember(e.target.value)}><option value="">— মেম্বার নয় —</option>{data.members.map((m) => <option key={m.id} value={m.phone}>{m.name} ({m.phone}) — {bnNum(m.points || 0)} পয়েন্ট</option>)}</select></label>
            </div>
            <div className="menu-form">
              <input placeholder="কুপন কোড, যেমন CHA10" value={posCouponCode} onChange={(e) => setPosCouponCode(e.target.value.toUpperCase())} />
              <button onClick={() => { const c = data.coupons.find((x) => x.code.toUpperCase() === posCouponCode.trim().toUpperCase() && x.active); if (!c) return showToast('কুপন পাওয়া যায়নি বা বন্ধ আছে', 'err'); setPosCoupon(c); showToast(`কুপন লাগানো হয়েছে: ${c.code} — ${c.pct}% ছাড়`) }}>🎟️ কুপন লাগান</button>
              {posCoupon && <span>✅ {posCoupon.code} — {posCoupon.pct}% ছাড় <button onClick={() => { setPosCoupon(null); setPosCouponCode('') }}>✕</button></span>}
            </div>
            <div className="menu-grid">{data.menu.filter((m) => m.active).map((m) => <div key={m.id} className="menu-item"><b>{m.name}</b><span>{m.cat}</span><strong>{tk(m.price)}</strong><div className="qty"><button onClick={() => setPosCart((c) => ({ ...c, [m.id]: Math.max(0, (c[m.id] || 0) - 1) }))}>−</button><b>{posCart[m.id] || 0}</b><button onClick={() => setPosCart((c) => ({ ...c, [m.id]: (c[m.id] || 0) + 1 }))}>+</button></div></div>)}</div>
            {(() => {
              const items = Object.entries(posCart).filter(([, q]) => q > 0).map(([id, qty]) => { const m = data.menu.find((x) => x.id === id); return { id, name: m.name, price: m.price, qty, station: m.station } })
              const calc = billCalc(items.reduce((s, i) => s + i.price * i.qty, 0), posCoupon ? posCoupon.pct : 0, data.settings.vat, data.settings.service)
              return (
                <div className="box"><h3>🧾 বিলের হিসাব</h3>
                  {items.map((i) => <p key={i.id}>{i.name} × {i.qty} — {tk(i.price * i.qty)}</p>)}
                  <p>সাবটোটাল: {tk(calc.subtotal)}</p>
                  {calc.discount > 0 && <p>কুপন ছাড় ({posCoupon.code}): −{tk(calc.discount)}</p>}
                  {calc.vat > 0 && <p>ভ্যাট ({data.settings.vat}%): {tk(calc.vat)}</p>}
                  {calc.service > 0 && <p>সার্ভিস চার্জ ({data.settings.service}%): {tk(calc.service)}</p>}
                  <p><b>মোট: {tk(calc.total)}</b></p>
                  <div className="row">
                    <button disabled={!items.length} onClick={() => {
                      const seq = data.seq + 1; const t = todayStr(); const no = nextBillNo()
                      const order = { id: `ORD-${seq}`, date: t, table: posType === 'Dine-in' ? posTable : posType, customer: posMember ? (data.members.find((m) => m.phone === posMember)?.name || 'মেম্বার') : 'কাউন্টার কাস্টমার', items, status: 'paid', time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), billNo: no, type: posType, payment: posPayment, billedBy: actorName(), memberPhone: posMember || null, createdAt: Date.now() }
                      const b = { no, date: t, orderId: order.id, ...calc, payment: posPayment, type: posType, billedBy: actorName(), createdAt: Date.now() }
                      upd((d) => { d.orders.unshift(order); d.bills.push(b); d.seq = seq; if (posPayment === 'Due') { if (!Array.isArray(d.dues)) d.dues = []; d.dues.push({ id: `due-${Date.now()}`, date: t, orderId: order.id, customer: order.customer, table: order.table, amount: calc.total, paid: 0, createdAt: Date.now() }) } return d })
                      decrementStock(items)
                      if (posMember) awardPoints(posMember, calc.total)
                      setBill({ ...b, order }); setPosCart({}); setPosCoupon(null); setPosCouponCode(''); setPosMember('')
                      try { localStorage.removeItem(POS_DRAFT_KEY) } catch { /* ignore */ }
                    }}>🧾 বিল করুন ({tk(calc.total)})</button>
                    <button onClick={() => { if (!confirm('কার্ট খালি করবেন?')) return; setPosCart({}); setPosCoupon(null); setPosCouponCode(''); try { localStorage.removeItem(POS_DRAFT_KEY) } catch { /* ignore */ } }}>🗑️ কার্ট খালি করুন</button>
                  </div>
                </div>
              )
            })()}
            <h3>পরিবেশন হওয়া অর্ডারের বিল</h3>
            <p>বিল নম্বর প্রতিদিন নতুন করে Bill No-0001 থেকে শুরু হয়।</p>
            {todayOrders.filter((o) => o.status === 'served').map((o) => <div key={o.id} className="box"><b>{o.id}</b> • {o.table} • মোট {tk(total(o))} <button onClick={() => makeBill(o)}>🧾 বিল প্রিন্ট</button></div>)}
            {!todayOrders.some((o) => o.status === 'served') && <p>বিল করার মতো কোনো অর্ডার নেই।</p>}
            <h3>আজকের বিল</h3>{data.bills.filter((b) => b.date === todayStr()).map((b) => <p key={b.no}>{b.no} — {b.orderId} — {tk(b.total)} • {b.payment || ''} • {b.billedBy || ''} <button onClick={() => { const o = data.orders.find((x) => x.id === b.orderId); if (o) reprintBill(o) }}>🖨️ আবার প্রিন্ট</button></p>)}
          </section>}

          {view === 'delivery' && <section>
            <h2>🛵 ডেলিভারি</h2>
            <p>Delivery ধরনের অর্ডার এখানে আসে, আর হাতে ডেলিভারি অর্ডারও যোগ করা যায়।</p>
            <div className="menu-form">
              <input placeholder="কাস্টমারের নাম" value={newDelivery.customer} onChange={(e) => setNewDelivery({ ...newDelivery, customer: e.target.value })} />
              <input placeholder="ফোন" value={newDelivery.phone} onChange={(e) => setNewDelivery({ ...newDelivery, phone: e.target.value })} />
              <input placeholder="ঠিকানা" value={newDelivery.address} onChange={(e) => setNewDelivery({ ...newDelivery, address: e.target.value })} />
              <select value={newDelivery.itemId} onChange={(e) => setNewDelivery({ ...newDelivery, itemId: e.target.value })}>{data.menu.map((m) => <option key={m.id} value={m.id}>{m.name} — {tk(m.price)}</option>)}</select>
              <input type="number" min="1" placeholder="পরিমাণ" value={newDelivery.qty} onChange={(e) => setNewDelivery({ ...newDelivery, qty: Number(e.target.value) || 1 })} />
              <button onClick={() => { if (!newDelivery.customer) return showToast('কাস্টমারের নাম দিন', 'err'); const m = data.menu.find((x) => x.id === newDelivery.itemId); const totalAmt = m.price * newDelivery.qty; upd((d) => { d.deliveryOrders.unshift({ id: `DLV-${Date.now()}`, date: todayStr(), customer: newDelivery.customer, phone: newDelivery.phone, address: newDelivery.address, items: `${m.name} × ${newDelivery.qty}`, total: totalAmt, status: 'new' }); return d }); setNewDelivery({ customer: '', phone: '', address: '', itemId: 'm1', qty: 1 }) }}>➕ ডেলিভারি যোগ</button>
            </div>
            <h3>POS / অর্ডার থেকে আসা ডেলিভারি ({bnNum(todayOrders.filter((o) => o.type === 'Delivery').length)}টি আজ)</h3>
            {todayOrders.filter((o) => o.type === 'Delivery').map((o) => <div key={o.id} className="box"><b>{o.id}</b> • {o.customer} • {STATUS[o.status]} • মোট {tk(total(o))}<p>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</p></div>)}
            <h3>হাতে যোগ করা ডেলিভারি</h3>
            {data.deliveryOrders.map((d) => <div key={d.id} className="box"><b>{d.customer}</b> • {d.phone} • {d.address}<p>{d.items} — মোট {tk(d.total)} • {d.date}</p><div className="row"><button onClick={() => upd((x) => { const y = x.deliveryOrders.find((z) => z.id === d.id); if (y) y.status = 'delivered'; return x })}>✅ ডেলিভারি সম্পন্ন</button><button onClick={() => { if (confirm('মুছবেন?')) upd((x) => { x.deliveryOrders = x.deliveryOrders.filter((z) => z.id !== d.id); return x }) }}>🗑️</button></div></div>)}
            {!data.deliveryOrders.length && <p>হাতে যোগ করা ডেলিভারি নেই।</p>}
          </section>}

          {view === 'catering' && <section>
            <h2>🎉 ক্যাটারিং</h2>
            <div className="menu-form">
              <input type="date" value={newCatering.date} onChange={(e) => setNewCatering({ ...newCatering, date: e.target.value })} />
              <input placeholder="কাস্টমার / অনুষ্ঠানের নাম" value={newCatering.customer} onChange={(e) => setNewCatering({ ...newCatering, customer: e.target.value })} />
              <input type="number" placeholder="অতিথি সংখ্যা" value={newCatering.guests} onChange={(e) => setNewCatering({ ...newCatering, guests: e.target.value })} />
              <input placeholder="আইটেম (যেমন: মালাই চা × ৫০, ফুচকা × ৩০)" value={newCatering.items} onChange={(e) => setNewCatering({ ...newCatering, items: e.target.value })} />
              <input type="number" placeholder="মোট টাকা (৳)" value={newCatering.total} onChange={(e) => setNewCatering({ ...newCatering, total: e.target.value })} />
              <button onClick={() => { if (!newCatering.customer || !newCatering.total) return showToast('কাস্টমার ও মোট টাকা দিন', 'err'); upd((d) => { d.cateringOrders.unshift({ id: `CAT-${Date.now()}`, ...newCatering, guests: Number(newCatering.guests) || 0, total: Number(newCatering.total) }); return d }); setNewCatering({ date: todayStr(), customer: '', guests: '', items: '', total: '' }) }}>➕ ক্যাটারিং যোগ</button>
            </div>
            {data.cateringOrders.map((c) => <div key={c.id} className="box"><b>{c.customer}</b> • {c.date} • {bnNum(c.guests)} জন অতিথি • মোট <b>{tk(c.total)}</b><p>{c.items}</p><button onClick={() => { if (confirm('মুছবেন?')) upd((d) => { d.cateringOrders = d.cateringOrders.filter((x) => x.id !== c.id); return d }) }}>🗑️ মুছুন</button></div>)}
            {!data.cateringOrders.length && <p>কোনো ক্যাটারিং অর্ডার নেই।</p>}
          </section>}

          {view === 'members' && <section>
            <h2>⭐ মেম্বার / পয়েন্ট</h2>
            <p>পেইড বিলে প্রতি ৳১০-এ ১ পয়েন্ট জমা হয় (POS-এ মেম্বার বেছে বিল করলে)।</p>
            <div className="menu-form">
              <input placeholder="মেম্বারের নাম" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} />
              <input placeholder="ফোন নম্বর" value={newMember.phone} onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })} />
              <button onClick={() => { if (!newMember.name || !newMember.phone) return showToast('নাম ও ফোন দিন', 'err'); if (data.members.some((m) => m.phone === newMember.phone)) return showToast('এই ফোনে মেম্বার already আছে', 'err'); upd((d) => { d.members.push({ id: `mb-${Date.now()}`, name: newMember.name, phone: newMember.phone, points: 0 }); return d }); setNewMember({ name: '', phone: '' }) }}>➕ মেম্বার যোগ</button>
            </div>
            <table className="tbl"><thead><tr><th>নাম</th><th>ফোন</th><th>পয়েন্ট</th><th></th></tr></thead><tbody>
              {data.members.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.phone}</td><td><b>{bnNum(m.points || 0)}</b></td><td><button onClick={() => { if (confirm(`"${m.name}" মুছবেন?`)) upd((d) => { d.members = d.members.filter((x) => x.id !== m.id); return d }) }}>🗑️</button></td></tr>)}
            </tbody></table>
            {!data.members.length && <p>এখনো কোনো মেম্বার নেই।</p>}
          </section>}

          {view === 'reviews' && <section>
            <h2>💬 রিভিউ</h2>
            <p>কাস্টমার অর্ডার ট্র্যাকার থেকে রিভিউ দেয় (পরিবেশন / বিল পেইড হওয়ার পর)। মালিক এখান থেকে উত্তর দিতে পারে।</p>
            <p className="note">📖 গাইড: ভালো রিভিউ পেতে বিল দেওয়ার সময় কাস্টমারকে ট্র্যাকার থেকে রিভিউ দিতে বলুন; খারাপ রিভিউ এলে এখান থেকে ভদ্রভাবে উত্তর দিন, আর পরের বার সেবা ঠিক করুন।</p>
            {data.reviews.map((r) => <div key={r.id} className="box"><b>{r.name}</b> • {'⭐'.repeat(r.stars)} • {r.date} • {r.table} • অর্ডার {r.orderId}<p>{r.comment || '—'}</p>
              {r.reply ? <p className="note">💬 মালিকের উত্তর: {r.reply}</p> : isOwner() && <div className="menu-form"><input placeholder="উত্তর লিখুন" value={replyText[r.id] || ''} onChange={(e) => setReplyText({ ...replyText, [r.id]: e.target.value })} /><button onClick={() => { if (!replyText[r.id]) return; upd((d) => { const x = d.reviews.find((y) => y.id === r.id); if (x) x.reply = replyText[r.id]; return d }); setReplyText({ ...replyText, [r.id]: '' }) }}>💬 উত্তর দিন</button></div>}
            </div>)}
            {!data.reviews.length && <p>এখনো কোনো রিভিউ নেই।</p>}
          </section>}

          {view === 'bookings' && <section>
            <h2>📅 বুকিং</h2>
            <div className="menu-form">
              <input type="date" value={newBooking.date} onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })} />
              <input type="time" value={newBooking.time} onChange={(e) => setNewBooking({ ...newBooking, time: e.target.value })} />
              <input placeholder="নাম" value={newBooking.name} onChange={(e) => setNewBooking({ ...newBooking, name: e.target.value })} />
              <input placeholder="ফোন" value={newBooking.phone} onChange={(e) => setNewBooking({ ...newBooking, phone: e.target.value })} />
              <input type="number" placeholder="অতিথি" value={newBooking.guests} onChange={(e) => setNewBooking({ ...newBooking, guests: e.target.value })} />
              <select value={newBooking.table} onChange={(e) => setNewBooking({ ...newBooking, table: e.target.value })}>{data.tables.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}</select>
              <button onClick={() => { if (!newBooking.name || !newBooking.time) return showToast('নাম ও সময় দিন', 'err'); upd((d) => { d.bookings.push({ id: `bk-${Date.now()}`, ...newBooking, guests: Number(newBooking.guests) || 0 }); return d }); setNewBooking({ date: todayStr(), time: '', name: '', phone: '', guests: '', table: 'T-01' }) }}>➕ বুকিং যোগ</button>
            </div>
            {data.bookings.map((b) => <div key={b.id} className="box"><b>{b.name}</b> • {b.date} {b.time} • {b.table} • {bnNum(b.guests)} জন • {b.phone} <button onClick={() => { if (confirm('বুকিং মুছবেন?')) upd((d) => { d.bookings = d.bookings.filter((x) => x.id !== b.id); return d }) }}>🗑️</button></div>)}
            {!data.bookings.length && <p>কোনো বুকিং নেই।</p>}
          </section>}

          {view === 'money' && <section>
            <h2>💵 টাকা ও হিসাব</h2>
            <p>আজকের টাকার হিসাব এক নজরে — বিক্রি, খরচ, বাজার, বাকি আর শিফট।</p>
            <div className="cards">
              <div className="card"><b>{tk(todaySale)}</b><span>আজকের বিক্রি</span></div>
              <div className="card"><b>{tk(data.bills.filter((b) => b.date === todayStr() && b.payment === 'Cash').reduce((s, b) => s + b.total, 0))}</b><span>আজ Cash বিল</span></div>
              <div className="card"><b>{tk(data.expenses.filter((e) => e.date === todayStr()).reduce((s, e) => s + Number(e.amount || 0), 0))}</b><span>আজকের খরচ</span></div>
              <div className="card"><b>{tk(monthBazarTotal)}</b><span>এই মাসের বাজার</span></div>
              <div className="card"><b>{tk(totalDueOutstanding)}</b><span>মোট বাকি (Due)</span></div>
              <div className="card"><b>{openShift ? '🟢 খোলা' : '🔴 বন্ধ'}</b><span>ক্যাশ ড্রয়ার / শিফট{openShift ? ` — শুরু ${tk(openShift.startingCash)}` : ''}</span></div>
            </div>
            <div className="row"><button onClick={() => setView('reports')}>📈 রিপোর্ট দেখুন</button><button onClick={() => setView('expenses')}>💸 খরচ</button><button onClick={() => setView('bazar')}>🥬 বাজার</button><button onClick={() => setView('due')}>📒 বাকি</button><button onClick={() => setView('shift')}>💵 শিফট</button><button onClick={() => setView('dayclose')}>🌙 দিনের হিসাব বন্ধ</button></div>
          </section>}

          {view === 'reports' && <section>
            <h2>📈 রিপোর্ট — গত ৭ দিন</h2>
            <table className="tbl"><thead><tr><th>তারিখ</th><th>অর্ডার</th><th>বিক্রি</th></tr></thead><tbody>
              {[...Array(7)].map((_, i) => { const d = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); const os = data.orders.filter((o) => o.date === d && o.status !== 'cancelled'); return <tr key={d}><td>{new Date(d).toLocaleDateString('bn-BD')}</td><td>{bnNum(os.length)}</td><td>{tk(os.reduce((s, o) => s + total(o), 0))}</td></tr> })}
            </tbody></table>
            <h3>💳 পেমেন্ট মাধ্যম অনুযায়ী (সব দিনের বিল)</h3>
            {PAYMENTS.map((p) => { const bs = data.bills.filter((b) => b.payment === p); return bs.length ? <p key={p}>{p} — {bnNum(bs.length)}টি বিল — <b>{tk(bs.reduce((s, b) => s + b.total, 0))}</b></p> : null })}
            {!data.bills.length && <p>এখনো কোনো বিল হয়নি।</p>}
            <h3>সবচেয়ে বেশি বিক্রি (সব দিন)</h3>{Object.entries(data.orders.flatMap((o) => o.items).reduce((m, i) => { m[i.name] = (m[i.name] || 0) + i.qty; return m }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, q]) => <p key={n}>{n} — <b>{bnNum(q)}টি</b></p>)}
            <h3>👀 মেনু দেখা হয়েছে</h3><p>মোট {bnNum(data.visits.total || 0)} বার • আজ {bnNum(data.visits.byDate?.[todayStr()] || 0)} বার</p>
          </section>}

          {view === 'analytics' && <section>
            <h2>📊 অ্যানালিটিক্স</h2>
            {(() => {
              const paidBills = data.bills
              const avgBill = paidBills.length ? Math.round(paidBills.reduce((s, b) => s + b.total, 0) / paidBills.length) : 0
              const byTable = {}
              todayOrders.forEach((o) => { byTable[o.table] = (byTable[o.table] || 0) + 1 })
              const topItems = Object.entries(data.orders.flatMap((o) => o.items).reduce((m, i) => { m[i.name] = (m[i.name] || 0) + i.qty; return m }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)
              return (<>
                <div className="cards">
                  <div className="card"><b>{tk(avgBill)}</b><span>গড় বিল (সব দিন)</span></div>
                  <div className="card"><b>{bnNum(data.visits.total || 0)}</b><span>মোট মেনু দেখা</span></div>
                  <div className="card"><b>{bnNum(data.visits.byDate?.[todayStr()] || 0)}</b><span>আজ মেনু দেখা</span></div>
                  <div className="card"><b>{bnNum(paidBills.length)}</b><span>মোট বিল</span></div>
                </div>
                <div className="grid2">
                  <div className="box"><h3>📅 দিন অনুযায়ী বিক্রি (৭ দিন)</h3>
                    {[...Array(7)].map((_, i) => { const d = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); const os = data.orders.filter((o) => o.date === d && o.status !== 'cancelled'); return <p key={d}>{new Date(d).toLocaleDateString('bn-BD')} — {bnNum(os.length)} অর্ডার — <b>{tk(os.reduce((s, o) => s + total(o), 0))}</b></p> })}
                  </div>
                  <div className="box"><h3>🔥 টপ আইটেম</h3>{topItems.map(([n, q]) => <p key={n}>{n} — <b>{bnNum(q)}টি</b></p>)}</div>
                  <div className="box"><h3>💳 পেমেন্ট মাধ্যম অনুযায়ী বিক্রি</h3>
                    {PAYMENTS.map((p) => { const bs = paidBills.filter((b) => b.payment === p); return bs.length ? <p key={p}>{p} — {bnNum(bs.length)}টি — <b>{tk(bs.reduce((s, b) => s + b.total, 0))}</b></p> : null })}
                    {!paidBills.length && <p>এখনো বিল হয়নি।</p>}
                  </div>
                  <div className="box"><h3>🪑 ব্যস্ত টেবিল (আজ, অর্ডার সংখ্যা)</h3>
                    {Object.entries(byTable).sort((a, b) => b[1] - a[1]).map(([t, n]) => <p key={t}>{t} — <b>{bnNum(n)}টি অর্ডার</b></p>)}
                    {!Object.keys(byTable).length && <p>আজ এখনো অর্ডার নেই।</p>}
                  </div>
                </div>
              </>)
            })()}
          </section>}

          {view === 'expenses' && <section>
            <h2>💸 খরচ</h2>
            <div className="menu-form">
              <input type="date" value={newExpense.date} onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} />
              <input placeholder="খরচের নাম, যেমন দুধ" value={newExpense.title} onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })} />
              <select value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}>{['কাঁচামাল', 'বেতন', 'ভাড়া', 'বিদ্যুৎ', 'অন্যান্য'].map((c) => <option key={c}>{c}</option>)}</select>
              <input type="number" placeholder="টাকা (৳)" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} />
              <button onClick={() => { if (!newExpense.title || !newExpense.amount) return showToast('নাম ও টাকা দিন', 'err'); upd((d) => { d.expenses.unshift({ id: `ex-${Date.now()}`, ...newExpense, amount: Number(newExpense.amount) }); return d }); setNewExpense({ date: todayStr(), title: '', category: 'অন্যান্য', amount: '' }) }}>➕ খরচ যোগ</button>
            </div>
            <p>মোট খরচ: <b>{tk(data.expenses.reduce((s, e) => s + e.amount, 0))}</b></p>
            {data.expenses.map((e) => <div key={e.id} className="box"><b>{e.title}</b> • {e.category} • {e.date} • <b>{tk(e.amount)}</b> <button onClick={() => { if (confirm('মুছবেন?')) upd((d) => { d.expenses = d.expenses.filter((x) => x.id !== e.id); return d }) }}>🗑️</button></div>)}
            {!data.expenses.length && <p>কোনো খরচ লেখা হয়নি।</p>}
          </section>}

          {view === 'dayclose' && <section>
            <h2>🌙 দিনের হিসাব বন্ধ (Day-close)</h2>
            {(() => {
              const t = todayStr()
              const paidToday = data.bills.filter((b) => b.date === t)
              const sales = paidToday.reduce((s, b) => s + b.total, 0)
              const expToday = data.expenses.filter((e) => e.date === t)
              const expTotal = expToday.reduce((s, e) => s + e.amount, 0)
              const closed = data.dayCloses.find((c) => c.date === t)
              return (<>
                <div className="cards">
                  <div className="card"><b>{tk(sales)}</b><span>আজকের বিক্রি (বিল)</span></div>
                  <div className="card"><b>{tk(expTotal)}</b><span>আজকের খরচ</span></div>
                  <div className="card"><b>{tk(sales - expTotal)}</b><span>নিট (বিক্রি − খরচ)</span></div>
                  <div className="card"><b>{bnNum(paidToday.length)}</b><span>বিল সংখ্যা</span></div>
                </div>
                <div className="box"><h3>💳 পেমেন্ট অনুযায়ী</h3>
                  {PAYMENTS.map((p) => { const bs = paidToday.filter((b) => b.payment === p); return bs.length ? <p key={p}>{p} — {bnNum(bs.length)}টি — <b>{tk(bs.reduce((s, b) => s + b.total, 0))}</b></p> : null })}
                  {!paidToday.length && <p>আজ এখনো কোনো বিল হয়নি।</p>}
                </div>
                {closed
                  ? <p className="note">✅ আজকের হিসাব বন্ধ হয়েছে — {closed.time} • বিক্রি {tk(closed.sales)} • খরচ {tk(closed.expenses)} • নিট {tk(closed.net)} • বন্ধ করেছেন: {closed.closedBy}</p>
                  : <button onClick={() => { if (!confirm('আজকের হিসাব বন্ধ করবেন?')) return; upd((d) => { d.dayCloses.push({ date: t, sales, expenses: expTotal, net: sales - expTotal, byPayment: PAYMENTS.map((p) => ({ payment: p, total: paidToday.filter((b) => b.payment === p).reduce((s, b) => s + b.total, 0) })), closedBy: actorName(), time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) }); return d }); showToast('আজকের হিসাব বন্ধ হয়েছে।') }}>🌙 দিনের হিসাব বন্ধ করুন</button>}
                <h3>আগের দিনের হিসাব</h3>
                {data.dayCloses.filter((c) => c.date !== t).slice().reverse().map((c) => <p key={c.date}>{c.date} — বিক্রি {tk(c.sales)} • খরচ {tk(c.expenses)} • নিট {tk(c.net)}</p>)}
                {!data.dayCloses.filter((c) => c.date !== t).length && <p>আগের কোনো হিসাব নেই।</p>}
              </>)
            })()}
          </section>}

          {view === 'staff' && <section>
            <h2>👥 স্টাফ + PIN লগইন</h2>
            <p>ডেমো PIN: মালিক 1234, নিলয় 1111, রাতুল 2222। স্টাফ নিজের PIN দিয়ে লগইন করলে তার ভূমিকা অনুযায়ী পাতায় যাবে — কিচেন স্টাফ কিচেনে, ক্যাশিয়ার POS-এ, ওয়েটার টেবিলে, মালিক ড্যাশবোর্ডে। মালিক প্রত্যেক স্টাফের অনুমতি (৭টি) বদলাতে পারে।</p>
            {data.staff.map((s) => <div key={s.id} className="box"><b>{s.name}</b> — {s.role}<br />
              <small>অনুমতি: {(s.perms || defaultPermsForStaff(s)).map((p) => PERM_LABELS[p]).join(', ')}</small>
              {isOwner() && <div className="row">{PERMS.map((p) => <label key={p} className="perm-check"><input type="checkbox" checked={(s.perms || []).includes(p)} onChange={(e) => upd((d) => { const x = d.staff.find((y) => y.id === s.id); if (!x) return d; const cur = new Set(x.perms || []); if (e.target.checked) cur.add(p); else cur.delete(p); x.perms = [...cur]; return d })} /> {PERM_LABELS[p]}</label>)}</div>}
              {pinFor === s.id ? <span><input type="password" placeholder="PIN দিন" value={pinInput} onChange={(e) => setPinInput(e.target.value)} /> <button onClick={() => { if (pinInput === s.pin) { setActiveStaff(s); setPinFor(null); setPinInput(''); setView(pinLandingView(s)) } else showToast('ভুল PIN', 'err') }}>লগইন</button></span> : <button onClick={() => setPinFor(s.id)}>🔑 PIN দিয়ে লগইন</button>}
              {isOwner() && <button onClick={() => { if (confirm(`"${s.name}" মুছবেন?`)) upd((d) => { d.staff = d.staff.filter((x) => x.id !== s.id); return d }) }}>🗑️ মুছুন</button>}
            </div>)}
            <div className="menu-form"><input placeholder="নতুন স্টাফের নাম" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} /><input placeholder="ভূমিকা, যেমন চা-মেকার" value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} /><input placeholder="PIN" value={newStaff.pin} onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })} /><select value={newStaff.station} onChange={(e) => setNewStaff({ ...newStaff, station: e.target.value })}><option value="All">All</option>{STATIONS.map((s) => <option key={s}>{s}</option>)}</select><button onClick={() => { if (!newStaff.name || !newStaff.pin) return showToast('নাম ও PIN দিন', 'err'); const st = { id: `s${Date.now()}`, ...newStaff }; st.perms = defaultPermsForStaff(st); upd((d) => { d.staff.push(st); return d }); setNewStaff({ name: '', role: '', pin: '', station: 'Drinks' }) }}>➕ স্টাফ যোগ</button></div>
          </section>}

          {view === 'leave' && <section>
            <h2>🏖️ স্টাফ ছুটি</h2>
            <div className="menu-form">
              <select value={newLeave.staffId} onChange={(e) => setNewLeave({ ...newLeave, staffId: e.target.value })}><option value="">— স্টাফ বাছুন —</option>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <label>থেকে: <input type="date" value={newLeave.from} onChange={(e) => setNewLeave({ ...newLeave, from: e.target.value })} /></label>
              <label>পর্যন্ত: <input type="date" value={newLeave.to} onChange={(e) => setNewLeave({ ...newLeave, to: e.target.value })} /></label>
              <input placeholder="কারণ" value={newLeave.reason} onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} />
              <button onClick={() => { if (!newLeave.staffId || !newLeave.reason) return showToast('স্টাফ ও কারণ দিন', 'err'); upd((d) => { d.leaves.unshift({ id: `lv-${Date.now()}`, ...newLeave, status: 'pending' }); return d }); setNewLeave({ staffId: '', from: todayStr(), to: todayStr(), reason: '' }) }}>➕ ছুটি যোগ</button>
            </div>
            {data.leaves.map((l) => { const s = data.staff.find((x) => x.id === l.staffId); return <div key={l.id} className="box"><b>{s ? s.name : 'স্টাফ'}</b> • {l.from} → {l.to} • {l.reason} • স্ট্যাটাস: <b>{l.status === 'pending' ? 'অপেক্ষমাণ' : l.status === 'approved' ? 'অনুমোদিত' : 'বাতিল'}</b>
              {isOwner() && l.status === 'pending' && <div className="row"><button onClick={() => upd((d) => { const x = d.leaves.find((y) => y.id === l.id); if (x) x.status = 'approved'; return d })}>✅ অনুমোদন</button><button onClick={() => upd((d) => { const x = d.leaves.find((y) => y.id === l.id); if (x) x.status = 'rejected'; return d })}>❌ বাতিল</button></div>}
            </div> })}
            {!data.leaves.length && <p>কোনো ছুটির আবেদন নেই।</p>}
          </section>}

          {view === 'stock' && <section>
            <h2>📦 স্টক</h2>
            <p>৫-এর নিচে গেলে কম স্টকের সতর্কতা দেখাবে। বিল হলে স্টক নিজে থেকে কমে।</p>
            <table className="tbl"><thead><tr><th>আইটেম</th><th>স্টক</th><th></th></tr></thead><tbody>
              {data.menu.map((m) => { const q = data.stock[m.id] ?? 0; return <tr key={m.id}><td>{m.name}</td><td><b>{bnNum(q)}</b>{q < 5 && <span className="low-stock"> ⚠️ কম স্টক!</span>}</td><td><div className="row"><button onClick={() => upd((d) => { d.stock[m.id] = (d.stock[m.id] || 0) + 5; return d })}>+৫ যোগ</button><button onClick={() => upd((d) => { d.stock[m.id] = (d.stock[m.id] || 0) + 1; return d })}>+১</button><button onClick={() => upd((d) => { d.stock[m.id] = Math.max(0, (d.stock[m.id] || 0) - 1); return d })}>−১ ব্যবহার</button></div></td></tr> })}
            </tbody></table>
          </section>}

          {view === 'offers' && <section>
            <h2>🎟️ অফার / কুপন</h2>
            <p>POS-এ কুপন কোড দিলে এই ছাড় ধরা হয়।</p>
            <div className="menu-form">
              <input placeholder="কুপন কোড, যেমন CHA10" value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} />
              <input type="number" placeholder="ছাড় %" value={newCoupon.pct} onChange={(e) => setNewCoupon({ ...newCoupon, pct: e.target.value })} />
              <button onClick={() => { if (!newCoupon.code || !newCoupon.pct) return showToast('কোড ও ছাড় % দিন', 'err'); if (data.coupons.some((c) => c.code === newCoupon.code)) return showToast('এই কোড already আছে', 'err'); upd((d) => { d.coupons.push({ id: `cp-${Date.now()}`, code: newCoupon.code, pct: Number(newCoupon.pct), active: true }); return d }); setNewCoupon({ code: '', pct: '' }) }}>➕ কুপন তৈরি</button>
            </div>
            {data.coupons.map((c) => <div key={c.id} className="box"><b>{c.code}</b> — {c.pct}% ছাড় • {c.active ? '✅ চালু' : '⛔ বন্ধ'} <button onClick={() => upd((d) => { const x = d.coupons.find((y) => y.id === c.id); if (x) x.active = !x.active; return d })}>{c.active ? 'বন্ধ করুন' : 'চালু করুন'}</button> <button onClick={() => { if (confirm('কুপন মুছবেন?')) upd((d) => { d.coupons = d.coupons.filter((y) => y.id !== c.id); return d }) }}>🗑️</button></div>)}
            {!data.coupons.length && <p>কোনো কুপন নেই — উপরে তৈরি করুন।</p>}
          </section>}

{view === 'bazar' && <section>
            <h2>🛒 বাজার / কেনাকাটা</h2>
            <p>দোকানের জন্য যা কেনা হয় (দুধ, চিনি, চা-পাতা, কাপ…) এখানে লিখুন। এটা <b>খরচের পাতা থেকে আলাদা</b> — বাজার শুধু কেনাকাটার হিসাব।</p>
            <div className="row"><button onClick={() => setView('stock')}>📦 স্টক দেখুন — কোন আইটেম কত আছে</button></div>
            <div className="menu-form">
              <input placeholder="আইটেমের নাম, যেমন দুধ" value={newBazar.item} onChange={(e) => setNewBazar({ ...newBazar, item: e.target.value })} />
              <input type="number" min="1" placeholder="পরিমাণ" value={newBazar.qty} onChange={(e) => setNewBazar({ ...newBazar, qty: Number(e.target.value) || 1 })} />
              <input type="number" placeholder="মোট খরচ (৳)" value={newBazar.cost} onChange={(e) => setNewBazar({ ...newBazar, cost: e.target.value })} />
              <select value={newBazar.vendor} onChange={(e) => setNewBazar({ ...newBazar, vendor: e.target.value })}><option value="">— ভেন্ডর বাছুন —</option>{(data.vendors || []).map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}</select>
              <input type="date" value={newBazar.date} onChange={(e) => setNewBazar({ ...newBazar, date: e.target.value })} />
              <button onClick={() => { if (!newBazar.item || !newBazar.cost) return showToast('আইটেমের নাম ও খরচ দিন', 'err'); upd((d) => { if (!Array.isArray(d.bazar)) d.bazar = []; d.bazar.unshift({ id: `bz-${Date.now()}`, item: newBazar.item, qty: Number(newBazar.qty) || 1, cost: Number(newBazar.cost), vendor: newBazar.vendor, date: newBazar.date }); return d }); setNewBazar({ item: '', qty: 1, cost: '', vendor: '', date: todayStr() }) }}>➕ বাজার যোগ</button>
            </div>
            <p>এই মাসের মোট বাজার: <b>{tk(monthBazarTotal)}</b> • সব মিলিয়ে: <b>{tk((data.bazar || []).reduce((s, b) => s + Number(b.cost || 0), 0))}</b></p>
            {(data.bazar || []).map((b) => <div key={b.id} className="box"><b>{b.item}</b> × {bnNum(b.qty || 1)} • {b.vendor || 'ভেন্ডর নেই'} • {b.date} • <b>{tk(b.cost)}</b> <button onClick={() => { if (confirm('মুছবেন?')) upd((d) => { d.bazar = (d.bazar || []).filter((x) => x.id !== b.id); return d }) }}>🗑️</button></div>)}
            {!(data.bazar || []).length && <p>এখনো কোনো বাজার লেখা হয়নি। ভয়েস পাতা থেকেও বললেই বাজার যোগ হয়।</p>}
          </section>}

          {view === 'vendors' && <section>
            <h2>🏪 ভেন্ডর (সাপ্লায়ার)</h2>
            <p>যাদের কাছ থেকে বাজার কেনা হয় — বাজার পাতায় ভেন্ডর বাছতে এখানে আগে যোগ করুন।</p>
            <div className="menu-form">
              <input placeholder="ভেন্ডরের নাম" value={newVendor.name} onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })} />
              <input placeholder="ফোন নম্বর" value={newVendor.phone} onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })} />
              <button onClick={() => { if (!newVendor.name) return showToast('ভেন্ডরের নাম দিন', 'err'); upd((d) => { if (!Array.isArray(d.vendors)) d.vendors = []; d.vendors.push({ id: `v-${Date.now()}`, name: newVendor.name, phone: newVendor.phone }); return d }); setNewVendor({ name: '', phone: '' }) }}>➕ ভেন্ডর যোগ</button>
            </div>
            <table className="tbl"><thead><tr><th>নাম</th><th>ফোন</th><th></th></tr></thead><tbody>
              {(data.vendors || []).map((v) => <tr key={v.id}><td>{v.name}</td><td>{v.phone || '—'}</td><td><button onClick={() => { if (confirm(`"${v.name}" মুছবেন?`)) upd((d) => { d.vendors = (d.vendors || []).filter((x) => x.id !== v.id); return d }) }}>🗑️</button></td></tr>)}
            </tbody></table>
            {!(data.vendors || []).length && <p>কোনো ভেন্ডর নেই।</p>}
          </section>}

          {view === 'shift' && <section>
            <h2>💵 ক্যাশ ড্রয়ার / শিফট</h2>
            <p>শিফট খুলুন শুরুর ক্যাশ দিয়ে, বন্ধ করার সময় গোনা টাকা মিলিয়ে দেখুন।</p>
            {!openShift ? (
              <div className="box"><h3>🟢 শিফট খুলুন</h3><div className="menu-form">
                <input type="number" placeholder="শুরুর ক্যাশ (৳)" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
                <button onClick={() => { if (!shiftStart) return showToast('শুরুর ক্যাশ দিন', 'err'); upd((d) => { if (!Array.isArray(d.shifts)) d.shifts = []; d.shifts.push({ id: `sh-${Date.now()}`, date: todayStr(), openedAt: Date.now(), startingCash: Number(shiftStart), openedBy: actorName(), closedAt: null }); return d }); setShiftStart(''); showToast('শিফট খোলা হয়েছে') }}>🟢 শিফট খুলুন</button>
              </div></div>
            ) : (
              <div className="box"><h3>🟢 চলমান শিফট — {new Date(openShift.openedAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })} থেকে • খুলেছেন: {openShift.openedBy}</h3>
                {(() => { const cashSales = data.bills.filter((b) => b.payment === 'Cash' && (b.createdAt || 0) >= openShift.openedAt).reduce((s, b) => s + b.total, 0); const expected = Number(openShift.startingCash || 0) + cashSales; return (<>
                  <p>শুরুর ক্যাশ: <b>{tk(openShift.startingCash)}</b></p>
                  <p>শিফটে Cash বিক্রি: <b>{tk(cashSales)}</b></p>
                  <p>থাকার কথা (Expected): <b>{tk(expected)}</b></p>
                  <div className="menu-form"><input type="number" placeholder="গোনা ক্যাশ (৳)" value={shiftCounted} onChange={(e) => setShiftCounted(e.target.value)} />
                    <button onClick={() => { if (shiftCounted === '') return showToast('গোনা ক্যাশ দিন', 'err'); const counted = Number(shiftCounted); upd((d) => { const s = d.shifts.find((x) => x.id === openShift.id); if (s) { s.closedAt = Date.now(); s.expected = expected; s.counted = counted; s.difference = counted - expected; s.closedBy = actorName() } return d }); setShiftCounted(''); showToast(`শিফট বন্ধ হয়েছে — পার্থক্য ${tk(counted - expected)}`) }}>🔴 শিফট বন্ধ করুন</button></div>
                  {shiftCounted !== '' && <p>পার্থক্য হবে: <b>{tk(Number(shiftCounted) - expected)}</b> {Number(shiftCounted) - expected === 0 ? '(মিলেছে ✅)' : Number(shiftCounted) - expected > 0 ? '(বেশি আছে)' : '(কম আছে)'}</p>}
                </>) })()}
              </div>
            )}
            <h3>শিফটের ইতিহাস</h3>
            {(data.shifts || []).slice().reverse().map((s) => <div key={s.id} className="box"><b>{s.date}</b> • খুলেছেন: {s.openedBy} • শুরু: {tk(s.startingCash)} {s.closedAt ? <>• থাকার কথা ছিল: {tk(s.expected)} • গোনা: {tk(s.counted)} • পার্থক্য: <b>{tk(s.difference)}</b> {s.difference === 0 ? '✅ মিলেছে' : s.difference > 0 ? '(বেশি)' : '(কম)'} • বন্ধ করেছেন: {s.closedBy}</> : '• 🟢 এখনো খোলা'}</div>)}
            {!(data.shifts || []).length && <p>এখনো কোনো শিফট খোলা হয়নি।</p>}
          </section>}

          {view === 'due' && <section>
            <h2>📒 বাকি (Due)</h2>
            <p>POS-এ Due দিয়ে বিল করলে এখানে বাকি জমা হয়। আংশিক টাকা জমা দিলে বাকি কমে, পুরো দিলে শেষ হয়।</p>
            <p>মোট বাকি: <b>{tk(totalDueOutstanding)}</b></p>
            {(data.dues || []).map((du) => { const rem = Math.max(0, Number(du.amount || 0) - Number(du.paid || 0)); return (<div key={du.id} className="box"><b>{du.customer}</b> • {du.table} • অর্ডার {du.orderId} • {du.date}<p>মোট: {tk(du.amount)} • জমা: {tk(du.paid || 0)} • <b>বাকি: {tk(rem)}</b> {rem === 0 ? '✅ পুরো শোধ' : ''}</p>{rem > 0 && <div className="menu-form"><input type="number" placeholder="জমা দিচ্ছে (৳)" value={duePay[du.id] || ''} onChange={(e) => setDuePay({ ...duePay, [du.id]: e.target.value })} /><button onClick={() => { const amt = Number(duePay[du.id]); if (!amt || amt <= 0) return showToast('জমার টাকা দিন', 'err'); if (amt > rem) return showToast(`বাকি ${tk(rem)}-এর বেশি জমা দেওয়া যাবে না`, 'err'); upd((d) => { const x = d.dues.find((y) => y.id === du.id); if (x) x.paid = Number(x.paid || 0) + amt; return d }); setDuePay({ ...duePay, [du.id]: '' }); showToast(`✅ ${tk(amt)} জমা হয়েছে — বাকি ${tk(rem - amt)}`) }}>💰 জমা দিন</button><button onClick={() => { upd((d) => { const x = d.dues.find((y) => y.id === du.id); if (x) x.paid = Number(x.amount); return d }); showToast('✅ পুরো বাকি শোধ হয়েছে') }}>✅ পুরো শোধ</button></div>}</div>) })}
            {!(data.dues || []).length && <p>কোনো বাকি নেই।</p>}
          </section>}

          {view === 'voice' && <section>
            <h2>🎙️ ভয়েস অর্ডার / বাজার / বিক্রি</h2>
            <p>মুখে বললেই কাজ হবে — কোনো চাবি (API key) লাগে না, ব্রাউজারের নিজের Web Speech API ব্যবহার হয়।</p>
            <p className="note">⚠️ নোট: ভয়েস চালাতে <b>Chrome ব্রাউজার + ইন্টারনেট</b> লাগবে। বাংলা বলা মাঝে মাঝে ভুল শুনতে পারে — না চিনলে আবার স্পষ্ট করে বলুন।</p>
            {!SpeechRec && <p className="auth-err">❌ এই ব্রাউজারে ভয়েস সাপোর্ট নেই — Chrome ব্রাউজারে খুলুন।</p>}
            <div className="chips">{[['order', '🎙️ ভয়েস অর্ডার'], ['bazar', '🛒 ভয়েস বাজার'], ['sales', '📈 ভয়েসে বিক্রি জানুন']].map(([k, l]) => <button key={k} className={voiceMode === k ? 'on' : ''} onClick={() => { setVoiceMode(k); setVoiceMsg('') }}>{l}</button>)}</div>
            <p>{voiceMode === 'order' ? 'বলুন: "টেবিল ৫-এ দুইটা স্পেশাল মালাই চা" — আইটেম + পরিমাণ + টেবিল বললেই আসল অর্ডার তৈরি হবে।' : voiceMode === 'bazar' ? 'বলুন: "দুধ ৫ কেজি ৩০০ টাকা" — বাজার এন্ট্রি যোগ হবে।' : 'বলুন: "আজকের বিক্রি কত" — আজকের বিক্রি মুখে বলে জানাবে।'}</p>
            <div className="menu-form"><button disabled={!SpeechRec || voiceListening} onClick={startVoice}>{voiceListening ? '🎙️ শুনছি…' : '🎙️ বলুন — মাইক চালু করুন'}</button></div>
            {voiceText && <p>🗣️ শোনা গেছে: <b>{voiceText}</b></p>}
            {voiceMsg && <p className="note">{voiceMsg}</p>}
          </section>}

          {view === 'branches' && <section>
            <h2>🏬 শাখা (Branches)</h2>
            <p>মূল শাখা: <b>দ্য ডিপ্লোমা পাস চা-ওয়ালা — মূল শাখা</b>, 1640 Narsingdi, Bangladesh। নতুন শাখা এখানে যোগ করুন।</p>
            <div className="menu-form">
              <input placeholder="শাখার নাম" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} />
              <input placeholder="ঠিকানা" value={newBranch.address} onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })} />
              <button onClick={() => { if (!newBranch.name || !newBranch.address) return showToast('শাখার নাম ও ঠিকানা দিন', 'err'); upd((d) => { if (!Array.isArray(d.branches)) d.branches = []; d.branches.push({ id: `br-${Date.now()}`, name: newBranch.name, address: newBranch.address, isMain: false }); return d }); setNewBranch({ name: '', address: '' }) }}>➕ শাখা যোগ</button>
            </div>
            {(data.branches || []).map((b) => <div key={b.id} className="box"><b>{b.name}</b>{b.isMain ? ' ⭐ মূল শাখা' : ''}<p>{b.address}</p>{!b.isMain && <button onClick={() => { if (confirm(`"${b.name}" মুছবেন?`)) upd((d) => { d.branches = (d.branches || []).filter((x) => x.id !== b.id); return d }) }}>🗑️ মুছুন</button>}</div>)}
            {!(data.branches || []).length && <p>কোনো শাখা নেই।</p>}
          </section>}

          {view === 'growth' && <section>
            <h2>📈 সেলস গ্রোথ — আসল ডেটা থেকে</h2>
            {(() => {
              const y = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
              const yOrders = data.orders.filter((o) => o.date === y && o.status !== 'cancelled')
              const ySale = yOrders.reduce((s, o) => s + total(o), 0)
              const diff = todaySale - ySale
              const topToday = popular[0]
              const quiet = data.tables.filter((t) => !todayOrders.some((o) => o.table === t.code))
              return (<>
                <div className="box"><h3>💬 আজকের বার্তা</h3>
                  <p>📊 আজকের বিক্রি <b>{tk(todaySale)}</b> — গতকাল ছিল {tk(ySale)}। {diff > 0 ? `গতকালের চেয়ে ${tk(diff)} বেশি 📈` : diff < 0 ? `গতকালের চেয়ে ${tk(-diff)} কম 📉` : 'গতকালের সমান।'}</p>
                  <p>🔥 আজকের টপ আইটেম: <b>{topToday ? `${topToday[0]} — ${bnNum(topToday[1])}টি` : 'এখনো অর্ডার নেই'}</b></p>
                  <p>🪑 আজ এখনো অর্ডার আসেনি এমন টেবিল: <b>{quiet.length ? quiet.map((t) => t.code).join(', ') : 'সব টেবিলেই অর্ডার এসেছে 🎉'}</b>{quiet.length ? ' — এই টেবিলগুলোতে কাস্টমার বসানোর দিকে নজর দিন।' : ''}</p>
                  <p>🧾 আজ মোট অর্ডার <b>{bnNum(todayOrders.length)}টি</b> (গতকাল {bnNum(yOrders.length)}টি)।</p>
                </div>
              </>)
            })()}
            <p className="note">এই বার্তাগুলো আপনার আসল অর্ডার ডেটা থেকে হিসাব করা — কোনো বানানো সংখ্যা নয়।</p>
          </section>}

          {view === 'sop' && <section>
            <h2>📋 SOP — দোকান চালানোর নিয়ম</h2>
            <p>প্রতিদিনের কাজের ধাপ — মালিক চাইলে নিচে বদলে সংরক্ষণ করতে পারেন।</p>
            <ol>{(data.settings.sop || DEFAULT_SOP).split('\n').filter(Boolean).map((line, i) => <li key={i}>{line.replace(/^\d+\.\s*/, '')}</li>)}</ol>
            {isOwner() && <div className="box"><h3>✏️ SOP বদলান</h3><textarea rows={8} style={{ width: '100%', padding: 10, border: '1px solid #d8c690', borderRadius: 8 }} value={sopDraft} onChange={(e) => setSopDraft(e.target.value)} /><div className="menu-form"><button onClick={() => { upd((d) => { d.settings.sop = sopDraft; return d }); showToast('SOP সংরক্ষিত হয়েছে') }}>💾 সংরক্ষণ করুন</button></div></div>}
          </section>}

          {view === 'salary' && <section>
            <h2>💰 বেতন — {new Date().toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })}</h2>
            <p>প্রতি স্টাফের এই মাসের বেতন লিখুন, টাকা দিলে "দেওয়া হয়েছে" চাপুন।</p>
            {data.staff.map((s) => { const rec = (data.salaries || []).find((x) => x.staffId === s.id && x.month === monthKey); const amt = salaryAmt[s.id] ?? rec?.amount ?? ''; return (<div key={s.id} className="box"><b>{s.name}</b> — {s.role}<div className="menu-form"><input type="number" placeholder="মাসিক বেতন (৳)" value={amt} onChange={(e) => setSalaryAmt({ ...salaryAmt, [s.id]: e.target.value })} /><button onClick={() => { const a = Number(salaryAmt[s.id] ?? rec?.amount ?? 0); if (!a) return showToast('বেতনের টাকা দিন', 'err'); upd((d) => { if (!Array.isArray(d.salaries)) d.salaries = []; const x = d.salaries.find((y) => y.staffId === s.id && y.month === monthKey); if (x) x.amount = a; else d.salaries.push({ id: `sal-${Date.now()}`, staffId: s.id, month: monthKey, amount: a, paid: false }); return d }); showToast(`${s.name}-এর বেতন ${tk(a)} সংরক্ষিত হয়েছে`) }}>💾 সংরক্ষণ</button>{rec && <button onClick={() => upd((d) => { const x = d.salaries.find((y) => y.id === rec.id); if (x) x.paid = !x.paid; return d })}>{rec.paid ? '✅ দেওয়া হয়েছে — বাতিল করুন' : '💰 দেওয়া হয়েছে চাপুন'}</button>}</div>{rec && <p>বেতন: <b>{tk(rec.amount)}</b> • স্ট্যাটাস: <b>{rec.paid ? '✅ দেওয়া হয়েছে' : '⏳ বাকি'}</b></p>}</div>) })}
            <p>এই মাসে মোট বেতন: <b>{tk((data.salaries || []).filter((x) => x.month === monthKey).reduce((s, x) => s + Number(x.amount || 0), 0))}</b> • দেওয়া হয়েছে: <b>{tk((data.salaries || []).filter((x) => x.month === monthKey && x.paid).reduce((s, x) => s + Number(x.amount || 0), 0))}</b> • বাকি: <b>{tk((data.salaries || []).filter((x) => x.month === monthKey && !x.paid).reduce((s, x) => s + Number(x.amount || 0), 0))}</b></p>
          </section>}


          {view === 'alltools' && <section>
            <h2>🧰 সব টুল</h2>
            <p>সিস্টেমের সব পাতা এক জায়গায় — যেটা দরকার চাপুন।</p>
            <div className="grid2">
              {[['dashboard', '📊 ড্যাশবোর্ড'], ...NAV_GROUPS.flatMap((g) => g.items)].filter(([k]) => k === 'dashboard' || canView(PAGE_PERM[k])).map(([k, l]) => <button key={k} className="box" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setView(k)}><b>{l}</b></button>)}
            </div>
          </section>}

          {view === 'settings' && <section>
            <h2>⚙️ সেটিংস</h2>
            <div className="form">
              <label>দোকানের নাম <input value={settings.shop} onChange={(e) => setSettings({ ...settings, shop: e.target.value })} /></label>
              <label>ফোন (আসল নম্বর এখনো দেওয়া হয়নি — এটি placeholder) <input value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label>
              <label>ঠিকানা <input value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label>
              <label>খোলার সময় <input value={settings.open} onChange={(e) => setSettings({ ...settings, open: e.target.value })} /></label>
              <label>ভ্যাট % <input type="number" min="0" value={settings.vat} onChange={(e) => setSettings({ ...settings, vat: Number(e.target.value) || 0 })} /></label>
              <label>সার্ভিস চার্জ % <input type="number" min="0" value={settings.service} onChange={(e) => setSettings({ ...settings, service: Number(e.target.value) || 0 })} /></label>
              <label>ব্যবসার ধরন <select value={settings.businessType} onChange={(e) => setSettings({ ...settings, businessType: e.target.value })}><option>Tea shop</option><option>Cafe</option><option>Restaurant</option></select></label>
              <label>থিম <select value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value })}>{THEMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <button onClick={() => { upd((d) => { d.settings = settings; return d }); showToast('সেটিংস সংরক্ষিত হয়েছে') }}>💾 সংরক্ষণ করুন</button>
            </div>
            {!realPhone(settings.phone) && <p className="auth-err">⚠️ ফোন নম্বরটি এখনো placeholder (01900-000000) — আসল নম্বর বসান। placeholder নম্বর বিল বা QR-এ ছাপা হয় না।</p>}
            <p className="note">📱 সিঙ্ক নোট: সব ডেটা এই ডিভাইসের ব্রাউজারের localStorage-এ থাকে (key: dpcw-v1)। অন্য ফোন/কম্পিউটারে একই ডেটা দেখতে শেয়ার্ড ডেটাবেস + ব্যাকএন্ড লাগবে — এই ভার্সনে সেটা নেই।</p>
          </section>}

          </>)}
        </main>
        <footer>© {new Date().getFullYear()} {data.settings.shop} • {data.settings.address} • {VERSION} • ডেটা এই ব্রাউজারে সংরক্ষিত থাকে</footer>
      </div>
    </div>
  )
}
