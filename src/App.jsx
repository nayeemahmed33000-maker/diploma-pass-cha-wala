import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Tesseract from 'tesseract.js'
import { parseMenuText } from './scanParse.js'

const KEY = 'dpcw-v1'
const USERS_KEY = 'dpcw-users-v1'
const SESSION_KEY = 'dpcw-session-v1'
const POS_DRAFT_KEY = 'dpcw-pos-draft-v1'
// Simple one-way hash for demo localStorage auth — never store plain passwords.
function hashPw(pw) { let h = 5381; for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) >>> 0; return 'h' + h.toString(16) }
function seedUsers() { return [{ id: 'u-owner', name: 'Owner', email: 'owner@diplomacha.com', pwHash: hashPw('123456'), role: 'Owner', shop: 'দ্য ডিপ্লোমা পাস চা-ওয়ালা', created: todayStr() }] }
function loadUsers() { try { const d = JSON.parse(localStorage.getItem(USERS_KEY)); if (Array.isArray(d) && d.length) return d } catch { /* fall through to seed */ } const s = seedUsers(); try { localStorage.setItem(USERS_KEY, JSON.stringify(s)) } catch { /* ignore */ } return s }
function loadSession() { try { return localStorage.getItem(SESSION_KEY) || '' } catch { return '' } }
const todayStr = () => new Date().toISOString().slice(0, 10)
const tk = (n) => `৳${Number(n || 0).toLocaleString('en-IN')}`
const bnNum = (n) => Number(n).toLocaleString('bn-BD')
const STATUS = { new: 'নতুন', confirmed: 'কনফার্ম', ready: 'রেডি', served: 'পরিবেশন', paid: 'বিল পেইড', cancelled: 'বাতিল' }
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
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const mk = (id, date, table, items, status, time) => ({
    id, date, table, customer: 'ডেমো কাস্টমার', items: items.map(([mid, qty]) => {
      const m = seedMenu.find((x) => x.id === mid); return { id: mid, name: m.name, price: m.price, qty, station: m.station }
    }), status, time, billNo: status === 'paid' ? 'Bill No-0001' : null, type: 'Dine-in', payment: status === 'paid' ? 'Cash' : null, billedBy: status === 'paid' ? 'মালিক' : null,
  })
  const stock = {}; seedMenu.forEach((m) => { stock[m.id] = 20 })
  return {
    settings: { shop: 'দ্য ডিপ্লোমা পাস চা-ওয়ালা', phone: '01900-000000', address: '1640 Narsingdi, Bangladesh', open: 'সকাল ১০টা — রাত ১০টা', vat: 0, service: 0, businessType: 'Tea shop', theme: 'brown' },
    menu: seedMenu,
    tables: Array.from({ length: 10 }, (_, i) => ({ code: `T-${String(i + 1).padStart(2, '0')}`, name: `টেবিল ${bnNum(i + 1)}` })),
    staff: [
      { id: 's1', name: 'মালিক', role: 'Owner — সব দেখবে', pin: '1234', station: 'All', perms: [...PERMS] },
      { id: 's2', name: 'নিলয়', role: 'চা-মেকার — শুধু চা / ড্রিংকস', pin: '1111', station: 'Drinks', perms: ['order', 'kitchen'] },
      { id: 's3', name: 'রাতুল', role: 'স্ন্যাকস-মেকার — শুধু স্ন্যাকস', pin: '2222', station: 'Snacks', perms: ['order', 'kitchen'] },
    ],
    orders: [
      mk('ORD-1001', t, 'T-01', [['m1', 2], ['m21', 1]], 'new', '০৯:৩২'),
      mk('ORD-1002', t, 'T-03', [['m2', 1], ['m20', 2]], 'ready', '০৯:১৫'),
      mk('ORD-1003', t, 'T-02', [['m1', 1], ['m13', 1]], 'paid', '০৮:৫০'),
      mk('ORD-0998', y, 'T-05', [['m1', 3], ['m22', 1]], 'paid', '১৯:২০'),
    ],
    bills: [{ no: 'Bill No-0001', date: t, orderId: 'ORD-1003', total: 90, subtotal: 90, discount: 0, vat: 0, service: 0, payment: 'Cash', type: 'Dine-in', billedBy: 'মালিক' }],
    seq: 1003,
    expenses: [], coupons: [], members: [], bookings: [], stock,
    deliveryOrders: [], cateringOrders: [], reviews: [], bells: [], leaves: [],
    dayCloses: [], visits: { total: 0, byDate: {} }, posDraft: null,
    plan: { type: 'trial', price: 2000 },
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
    merged.plan = { ...s.plan, ...(d.plan || {}) }
    merged.visits = { total: 0, byDate: {}, ...(d.visits || {}) }
    merged.stock = { ...s.stock, ...(d.stock || {}) }
    merged.staff = (d.staff || []).map((st) => ({ ...st, perms: Array.isArray(st.perms) && st.perms.length ? st.perms : defaultPermsForStaff(st) }))
    for (const k of ['expenses', 'coupons', 'members', 'bookings', 'deliveryOrders', 'cateringOrders', 'reviews', 'bells', 'leaves', 'dayCloses']) if (!Array.isArray(merged[k])) merged[k] = []
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
  const [settings, setSettings] = useState(data.settings)
  const [openGroups, setOpenGroups] = useState({ menu: true, sell: true, customer: true, money: true, manage: true, settings: true })
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
  // --- Menu scan (client-side OCR with tesseract.js, ben+eng; no API key) ---
  const [scanFile, setScanFile] = useState(null)
  const [scanPreview, setScanPreview] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatus, setScanStatus] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [scanText, setScanText] = useState('')

  useEffect(() => { try { localStorage.setItem(USERS_KEY, JSON.stringify(users)) } catch { /* ignore */ } }, [users])

  function doLogin() {
    setAuthErr(''); setAuthMsg('')
    const email = authForm.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAuthErr('সঠিক ইমেইল ঠিকানা দিন'); return }
    if (!authForm.password) { setAuthErr('পাসওয়ার্ড দিন'); return }
    const u = users.find((x) => x.email.toLowerCase() === email)
    if (!u || u.pwHash !== hashPw(authForm.password)) { setAuthErr('ইমেইল বা পাসওয়ার্ড ভুল হয়েছে — আবার চেষ্টা করুন'); return }
    setUser(u); try { localStorage.setItem(SESSION_KEY, u.email) } catch { /* ignore */ }
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
    setUsers((prev) => [...prev, u]); setUser(u)
    try { localStorage.setItem(SESSION_KEY, u.email) } catch { /* ignore */ }
    setAuthMsg('সাইন আপ সফল হয়েছে — স্বাগতম!'); setAuthForm({ ...authForm, password: '', confirm: '' }); setView('dashboard')
  }
  function doLogout() { setUser(null); setActiveStaff(null); try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ } setAuthErr(''); setAuthMsg(''); setAuthTab('login'); setView('dashboard') }

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
  const baseUrl = window.location.origin + window.location.pathname
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
    if (!items.length) { alert('কার্ট খালি — আগে আইটেম যোগ করুন'); return }
    const seq = data.seq + 1
    const order = { id: `ORD-${seq}`, date: todayStr(), table: custTable, customer: custName || 'কাস্টমার', items, status: 'new', time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), billNo: null, type: 'Dine-in', payment: null, billedBy: actorName() }
    upd((d) => { d.orders.unshift(order); d.seq = seq; return d })
    setCart({}); setLastOrder(order.id); setAlert(order); setView('customer')
  }
  function setStatus(id, status) { upd((d) => { const o = d.orders.find((x) => x.id === id); if (o) o.status = status; return d }) }
  function nextBillNo() {
    const t = todayStr(); const n = data.bills.filter((b) => b.date === t).length + 1
    return `Bill No-${String(n).padStart(4, '0')}`
  }
  function makeBill(order, payment = 'Cash', couponPct = 0) {
    const t = todayStr(); const no = nextBillNo()
    const calc = billCalc(total(order), couponPct, data.settings.vat, data.settings.service)
    const b = { no, date: t, orderId: order.id, ...calc, payment, type: order.type || 'Dine-in', billedBy: actorName() }
    upd((d) => { d.bills.push(b); const o = d.orders.find((x) => x.id === order.id); if (o) { o.status = 'paid'; o.billNo = no; o.payment = payment; o.billedBy = b.billedBy } return d })
    decrementStock(order.items)
    if (order.memberPhone) awardPoints(order.memberPhone, calc.total)
    setBill({ ...b, order }); setStatus(order.id, 'paid')
  }
  function reprintBill(order) {
    const b = [...data.bills].reverse().find((x) => x.orderId === order.id)
    if (!b) { alert('এই অর্ডারের কোনো বিল পাওয়া যায়নি'); return }
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

  const PAGE_PERM = { menu: 'menu', tables: 'tables', scan: 'menu', orders: 'order', pos: 'pos', kitchen: 'kitchen', delivery: 'order', catering: 'order', members: 'order', reviews: 'order', bookings: 'order', reports: 'reports', analytics: 'reports', expenses: 'reports', dayclose: 'pos', staff: 'staff', leave: 'staff', stock: 'menu', offers: 'pos', settings: null, plan: null }
  const NAV_GROUPS = [
    { key: 'menu', label: '🍵 মেনু ও টেবিল', items: [['menu', '🍵 মেনু'], ['tables', '🪑 টেবিল + QR'], ['scan', '📸 মেনু স্ক্যান']] },
    { key: 'sell', label: '🛒 বিক্রি', items: [['orders', '🧾 অর্ডার'], ['pos', '💰 POS + বিল'], ['kitchen', '👨‍🍳 কিচেন (KDS)'], ['delivery', '🛵 ডেলিভারি'], ['catering', '🎉 ক্যাটারিং']] },
    { key: 'customer', label: '👥 কাস্টমার', items: [['customer', '🛒 কাস্টমার মেনু'], ['members', '⭐ মেম্বার / পয়েন্ট'], ['reviews', '💬 রিভিউ'], ['bookings', '📅 বুকিং']] },
    { key: 'money', label: '💵 টাকা ও হিসাব', items: [['reports', '📈 রিপোর্ট'], ['analytics', '📊 অ্যানালিটিক্স'], ['expenses', '💸 খরচ'], ['dayclose', '🌙 দিনের হিসাব বন্ধ']] },
    { key: 'manage', label: '⚙️ পরিচালনা', items: [['staff', '👥 স্টাফ'], ['leave', '🏖️ স্টাফ ছুটি'], ['stock', '📦 স্টক'], ['offers', '🎟️ অফার / কুপন']] },
    { key: 'settings', label: '🔧 সেটিংস', items: [['settings', '⚙️ সেটিংস'], ['plan', '💎 প্ল্যান']] },
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
        <button onClick={() => { upd((d) => { d.bells.push({ id: `bell-${Date.now()}`, table: custTable, time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), date: todayStr(), done: false }); return d }); alert(`🔔 ওয়েটারকে ডাকা হয়েছে — ${custTable}। একটু অপেক্ষা করুন।`) }}>🔔 ওয়েটার ডাকুন</button></div>
      {lastOrderObj && <div className="box tracker"><h3>📍 আপনার অর্ডার ট্র্যাকার — {lastOrderObj.id}</h3><p>স্ট্যাটাস: <b>{STATUS[lastOrderObj.status]}</b> {lastOrderObj.billNo ? `• ${lastOrderObj.billNo}` : ''}</p><p>মোট: {tk(total(lastOrderObj))}</p><div className="steps">{['new', 'confirmed', 'ready', 'served', 'paid'].map((s) => <span key={s} className={['new', 'confirmed', 'ready', 'served', 'paid'].indexOf(lastOrderObj.status) >= ['new', 'confirmed', 'ready', 'served', 'paid'].indexOf(s) ? 'done' : ''}>{STATUS[s]}</span>)}</div>
        {['served', 'paid'].includes(lastOrderObj.status) && <div className="review-form"><h4>💬 আপনার অভিজ্ঞতা কেমন ছিল? রিভিউ দিন</h4>
          <div className="menu-form"><input placeholder="আপনার নাম" value={reviewForm.name} onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })} />
            <select value={reviewForm.stars} onChange={(e) => setReviewForm({ ...reviewForm, stars: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{'⭐'.repeat(s)} ({s})</option>)}</select>
            <input placeholder="মন্তব্য লিখুন (ঐচ্ছিক)" value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} />
            <button onClick={() => { if (!reviewForm.name) return alert('নাম দিন'); upd((d) => { d.reviews.unshift({ id: `rv-${Date.now()}`, date: todayStr(), orderId: lastOrderObj.id, table: lastOrderObj.table, name: reviewForm.name, stars: reviewForm.stars, comment: reviewForm.comment, reply: '' }); return d }); setReviewForm({ name: '', stars: 5, comment: '' }); alert('ধন্যবাদ! আপনার রিভিউ সংরক্ষিত হয়েছে।') }}>✅ রিভিউ পাঠান</button></div></div>}
      </div>}
      <div className="chips">{['সব', ...CATS].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="menu-grid">{data.menu.filter((m) => m.active && (cat === 'সব' || m.cat === cat)).map((m) => <div key={m.id} className="menu-item"><b>{m.name}</b><span>{m.cat} • {m.station}</span><strong>{tk(m.price)}</strong><div className="qty"><button onClick={() => setCart((c) => ({ ...c, [m.id]: Math.max(0, (c[m.id] || 0) - 1) }))}>−</button><b>{cart[m.id] || 0}</b><button onClick={() => setCart((c) => ({ ...c, [m.id]: (c[m.id] || 0) + 1 }))}>+</button></div></div>)}</div>
      <div className="cart-bar">🛒 মোট: <b>{tk(cartTotal)}</b> <button disabled={!cartTotal} onClick={placeOrder}>অর্ডার দিন →</button></div>
    </section>
  )

  // --- Bill card (shown after makeBill / reprint, in any view) ---
  const billCard = bill && (
    <div className="box print-area"><div className="bill"><img src="/logo.jpg" alt="লোগো" style={{ width: 70, borderRadius: '50%' }} /><h3>{data.settings.shop}</h3><p>{data.settings.address} • {data.settings.phone}</p><hr /><p><b>{bill.no}</b> • অর্ডার {bill.orderId} • {bill.date}</p><p>{bill.type || 'Dine-in'} • পেমেন্ট: {bill.payment || 'Cash'} • বিল করেছেন: {bill.billedBy || '—'}</p>{bill.order.items.map((i) => <p key={i.id}>{i.name} × {i.qty} — {tk(i.price * i.qty)}</p>)}<hr />
      <p>সাবটোটাল: {tk(bill.subtotal ?? bill.total)}</p>
      {bill.discount ? <p>কুপন ছাড়: −{tk(bill.discount)}</p> : null}
      {bill.vat ? <p>ভ্যাট ({data.settings.vat}%): {tk(bill.vat)}</p> : null}
      {bill.service ? <p>সার্ভিস চার্জ ({data.settings.service}%): {tk(bill.service)}</p> : null}
      <p><b>মোট: {tk(bill.total)}</b></p><p>ধন্যবাদ, আবার আসবেন! ☕</p><button onClick={() => window.print()}>🖨️ প্রিন্ট</button> <button onClick={() => setBill(null)}>বন্ধ</button></div></div>
  )

  // --- First screen: Login / Sign Up. Customer QR view (?table=...) needs no login. ---
  if (!user && !isCustomer) {
    return (
      <div className={`app auth-wrap theme-${data.settings.theme || 'brown'}`}>
        <div className="auth-card">
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
          <p className="auth-foot">কাস্টমার? লগইন লাগবে না — টেবিলের QR স্ক্যান করলেই মেনু খুলবে।</p>
        </div>
      </div>
    )
  }

  // --- Customer QR view: no login, no sidebar ---
  if (isCustomer) {
    return (
      <div className={`app theme-${data.settings.theme || 'brown'}`}>
        <header className="header">
          <img src="/logo.jpg" alt="দ্য ডিপ্লোমা পাস চা-ওয়ালা লোগো" className="logo" />
          <div><h1>{data.settings.shop}</h1><p>Diploma Pass Cha-Wala • চা, গল্প, আড্ডা • {data.settings.open}</p></div>
          <div className="head-right"><span>📞 {data.settings.phone}</span><span>📍 {data.settings.address}</span></div>
        </header>
        <main>{customerView}</main>
        <footer>© {data.settings.shop} • ডেটা এই ব্রাউজারে সংরক্ষিত থাকে</footer>
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
      <div className="side-foot"><small>👤 {activeStaff ? `${activeStaff.name} (স্টাফ)` : user ? `${user.name} (${user.role})` : 'কাস্টমার'}</small><button onClick={doLogout}>🚪 লগআউট</button></div>
    </aside>
  )

  const denied = <section><div className="box"><h2>🚫 অনুমতি নেই</h2><p>এই পাতাটি দেখার অনুমতি আপনার নেই। মালিকের সঙ্গে যোগাযোগ করুন।</p></div></section>
  const viewPerm = PAGE_PERM[view]

  return (
    <div className={`app layout theme-${data.settings.theme || 'brown'}`}>
      {sidebar}
      <div className="content">
        <header className="topbar">
          <span>📞 {data.settings.phone}</span><span>📍 {data.settings.address}</span>
          <span>👤 {activeStaff ? `${activeStaff.name} (স্টাফ)` : user ? `${user.name} (${user.role})` : 'কাস্টমার'}</span>
          {user && <button onClick={doLogout}>🚪 লগআউট</button>}
        </header>
        {alert && <div className="alert">🔔 নতুন অর্ডার! <b>{alert.id}</b> — {alert.table} • {tk(total(alert))} <button onClick={() => { setAlert(null); setView('orders') }}>অর্ডার দেখুন</button> <button onClick={() => setAlert(null)}>✕</button></div>}
        {billCard}
        <main>
          {viewPerm && !canView(viewPerm) ? denied : (<>
          {view === 'dashboard' && <section>
            <h2>📊 আজকের ড্যাশবোর্ড — {new Date().toLocaleDateString('bn-BD')}</h2>
            {activeBells.length > 0 && <div className="box bell-box"><h3>🔔 ওয়েটার ডাক — {bnNum(activeBells.length)}টি</h3>{activeBells.map((b) => <p key={b.id}><b>{b.table}</b> থেকে ডেকেছে • {b.time} <button onClick={() => upd((d) => { const x = d.bells.find((y) => y.id === b.id); if (x) x.done = true; return d })}>✅ গেছি / বাতিল</button></p>)}</div>}
            <div className="cards">
              <div className="card"><b>{tk(todaySale)}</b><span>আজকের মোট বিক্রি</span></div>
              <div className="card"><b>{bnNum(todayOrders.length)}</b><span>মোট অর্ডার</span></div>
              <div className="card"><b>{bnNum(todayOrders.filter((o) => o.status === 'new').length)}</b><span>নতুন / পেন্ডিং</span></div>
              <div className="card"><b>{bnNum(todayOrders.filter((o) => o.status === 'ready').length)}</b><span>রেডি</span></div>
            </div>
            <div className="grid2">
              <div className="box"><h3>🔥 জনপ্রিয় আইটেম (আজ)</h3>{popular.length ? popular.map(([n, q]) => <p key={n}>{n} — <b>{bnNum(q)}টি</b></p>) : <p>এখনো অর্ডার নেই।</p>}</div>
              <div className="box"><h3>🕒 সাম্প্রতিক অর্ডার</h3>{todayOrders.slice(0, 5).map((o) => <p key={o.id}>{o.id} • {o.table} • {tk(total(o))} • <b>{STATUS[o.status]}</b></p>) || <p>—</p>}</div>
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
            <div className="chips">{['সব', ...CATS].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
            <div className="menu-form">
              <input placeholder="নতুন আইটেমের নাম" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <select value={newItem.cat} onChange={(e) => setNewItem({ ...newItem, cat: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              <input type="number" placeholder="দাম (৳)" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
              <select value={newItem.station} onChange={(e) => setNewItem({ ...newItem, station: e.target.value })}>{STATIONS.map((s) => <option key={s}>{s}</option>)}</select>
              <button onClick={() => { if (!newItem.name || !newItem.price) return alert('নাম ও দাম দিন'); const nid = `m${Date.now()}`; upd((d) => { d.menu.push({ id: nid, name: newItem.name, cat: newItem.cat, price: Number(newItem.price), station: newItem.station, active: true }); d.stock[nid] = 20; return d }); setNewItem({ name: '', cat: 'দুধ চা', price: '', station: 'Drinks' }) }}>➕ যোগ করুন</button>
            </div>
            <table className="tbl"><thead><tr><th>আইটেম</th><th>ক্যাটাগরি</th><th>স্টেশন</th><th>দাম</th><th>চালু</th><th></th></tr></thead><tbody>
              {data.menu.filter((m) => cat === 'সব' || m.cat === cat).map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.cat}</td><td>{m.station}</td><td>{tk(m.price)}</td><td><button onClick={() => upd((d) => { d.menu.find((x) => x.id === m.id).active = !m.active; return d })}>{m.active ? '✅ চালু' : '⛔ বন্ধ'}</button></td><td><button onClick={() => { if (confirm(`"${m.name}" মুছবেন?`)) upd((d) => { d.menu = d.menu.filter((x) => x.id !== m.id); return d }) }}>🗑️</button></td></tr>)}
            </tbody></table>
          </section>}

          {view === 'tables' && <section>
            <h2>🪑 টেবিল + QR — {bnNum(data.tables.length)}টি টেবিল</h2>
            <p>কাস্টমার টেবিলের QR স্ক্যান করলেই ওই টেবিলের মেনু খুলবে। QR প্রিন্ট করে টেবিলে লাগান।</p>
            <div className="menu-form"><input placeholder="নতুন টেবিল কোড, যেমন T-11" value={newTable} onChange={(e) => setNewTable(e.target.value)} /><button onClick={() => { if (!newTable) return; upd((d) => { d.tables.push({ code: newTable.toUpperCase(), name: `টেবিল ${newTable}` }); return d }); setNewTable('') }}>➕ টেবিল যোগ</button><button onClick={() => window.print()}>🖨️ সব QR প্রিন্ট</button></div>
            <div className="qr-grid">{data.tables.map((t) => <div key={t.code} className="qr-card"><QRCodeSVG value={`${baseUrl}?table=${t.code}`} size={130} /><b>{t.name}</b><small>{t.code}</small><small>{baseUrl}?table={t.code}</small><button onClick={() => { setCustTable(t.code); setView('customer') }}>কাস্টমার মেনু দেখুন →</button></div>)}</div>
          </section>}

          {view === 'scan' && <section>
            <h2>📸 মেনু স্ক্যান — ছবি থেকে মেনু অটো-অ্যাড</h2>
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
                <button onClick={() => setView('menu')}>🍵 মেনু পাতায় দেখুন →</button>
              </div>}
              <p className="note">💡 ভালো ফলের টিপস: পরিষ্কার আলোতে সোজা করে ছবি তুলুন, লেখা বড় ও পরিষ্কার রাখুন। OCR মাঝে মাঝে ১-২ অক্ষর ভুল পড়ে (যেমন কোল্ড → কোক্ত) — মেনু পাতায় গিয়ে নাম ঠিক করে নেবেন। বাংলা হাতের লেখা ও খুব ছোট ফন্টে কম আইটেম পেতে পারে। ইংরেজি সংখ্যা (50, 120) বাংলা সংখ্যার (৫০, ১২০) চেয়ে ভালো পড়ে। প্রথমবার OCR মডেল ডাউনলোড হতে একটু সময় লাগবে।</p>
            </div>
            <div className="box">
              <h3>⌨️ অথবা লেখা বসিয়ে স্ক্যান করুন</h3>
              <p>ছবি না থাকলে মেনুর লেখা এখানে বসান — এক লাইনে এক আইটেম, শেষে দাম (যেমন: মসলা চা ৩৫)।</p>
              <textarea rows={5} style={{ width: '100%', padding: 10, border: '1px solid #d8c690', borderRadius: 8 }} placeholder={'স্পেশাল মালাই চা ৫০\nমসলা চা ৩৫\nকোল্ড কফি ১২০'} value={scanText} onChange={(e) => setScanText(e.target.value)} />
              <div className="menu-form"><button disabled={scanBusy || !scanText.trim()} onClick={async () => { setScanError(''); setScanResult(null); setScanBusy(true); try { await runScanFromText(scanText) } finally { setScanBusy(false) } }}>🔍 লেখা থেকে আইটেম যোগ করুন</button></div>
            </div>
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
            <div className="chips">{['All', ...STATIONS].map((s) => <button key={s} className={(activeStaff ? activeStaff.station : kdsStation) === s ? 'on' : ''} onClick={() => setKdsStation(s)}>{s === 'All' ? 'সব' : s}</button>)}</div>
            <div className="grid2">{STATIONS.filter((s) => (activeStaff ? activeStaff.station : kdsStation) === 'All' || (activeStaff ? activeStaff.station : kdsStation) === s).map((st) => <div key={st} className="box"><h3>{st}</h3>{kdsOrders.flatMap((o) => o.items.filter((i) => i.station === st).map((i) => ({ o, i }))).map(({ o, i }, idx) => <p key={idx}><b>{o.table}</b> — {i.name} × {i.qty} <small>({o.id} • {STATUS[o.status]})</small></p>)}{!kdsOrders.some((o) => o.items.some((i) => i.station === st)) && <p>কোনো কাজ নেই।</p>}</div>)}</div>
          </section>}

          {view === 'pos' && <section>
            <h2>💰 POS + বিল</h2>
            <p>কাউন্টার থেকে সরাসরি বিল করুন — ধরন, পেমেন্ট মাধ্যম ও কুপন বেছে নিন। ভ্যাট {data.settings.vat}% ও সার্ভিস চার্জ {data.settings.service}% সেটিংস থেকে ধরা হয়। ড্রাফট নিজে থেকে সংরক্ষিত হয় {draftSavedAt ? `✓ ${draftSavedAt}` : ''}।</p>
            <div className="menu-form">
              <label>ধরন: <select value={posType} onChange={(e) => setPosType(e.target.value)}>{ORDER_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label>পেমেন্ট: <select value={posPayment} onChange={(e) => setPosPayment(e.target.value)}>{PAYMENTS.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label>টেবিল: <select value={posTable} onChange={(e) => setPosTable(e.target.value)}>{data.tables.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}</select></label>
              <label>মেম্বার: <select value={posMember} onChange={(e) => setPosMember(e.target.value)}><option value="">— মেম্বার নয় —</option>{data.members.map((m) => <option key={m.id} value={m.phone}>{m.name} ({m.phone}) — {bnNum(m.points || 0)} পয়েন্ট</option>)}</select></label>
            </div>
            <div className="menu-form">
              <input placeholder="কুপন কোড, যেমন CHA10" value={posCouponCode} onChange={(e) => setPosCouponCode(e.target.value.toUpperCase())} />
              <button onClick={() => { const c = data.coupons.find((x) => x.code.toUpperCase() === posCouponCode.trim().toUpperCase() && x.active); if (!c) return alert('কুপন পাওয়া যায়নি বা বন্ধ আছে'); setPosCoupon(c); alert(`কুপন লাগানো হয়েছে: ${c.code} — ${c.pct}% ছাড়`) }}>🎟️ কুপন লাগান</button>
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
                      const order = { id: `ORD-${seq}`, date: t, table: posType === 'Dine-in' ? posTable : posType, customer: posMember ? (data.members.find((m) => m.phone === posMember)?.name || 'মেম্বার') : 'কাউন্টার কাস্টমার', items, status: 'paid', time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), billNo: no, type: posType, payment: posPayment, billedBy: actorName(), memberPhone: posMember || null }
                      const b = { no, date: t, orderId: order.id, ...calc, payment: posPayment, type: posType, billedBy: actorName() }
                      upd((d) => { d.orders.unshift(order); d.bills.push(b); d.seq = seq; return d })
                      decrementStock(items)
                      if (posMember) awardPoints(posMember, calc.total)
                      setBill({ ...b, order }); setPosCart({}); setPosCoupon(null); setPosCouponCode(''); setPosMember('')
                      try { localStorage.removeItem(POS_DRAFT_KEY) } catch { /* ignore */ }
                    }}>🧾 বিল করুন ({tk(calc.total)})</button>
                    <button onClick={() => { setPosCart({}); setPosCoupon(null); setPosCouponCode(''); try { localStorage.removeItem(POS_DRAFT_KEY) } catch { /* ignore */ } }}>🗑️ কার্ট খালি করুন</button>
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
              <button onClick={() => { if (!newDelivery.customer) return alert('কাস্টমারের নাম দিন'); const m = data.menu.find((x) => x.id === newDelivery.itemId); const totalAmt = m.price * newDelivery.qty; upd((d) => { d.deliveryOrders.unshift({ id: `DLV-${Date.now()}`, date: todayStr(), customer: newDelivery.customer, phone: newDelivery.phone, address: newDelivery.address, items: `${m.name} × ${newDelivery.qty}`, total: totalAmt, status: 'new' }); return d }); setNewDelivery({ customer: '', phone: '', address: '', itemId: 'm1', qty: 1 }) }}>➕ ডেলিভারি যোগ</button>
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
              <button onClick={() => { if (!newCatering.customer || !newCatering.total) return alert('কাস্টমার ও মোট টাকা দিন'); upd((d) => { d.cateringOrders.unshift({ id: `CAT-${Date.now()}`, ...newCatering, guests: Number(newCatering.guests) || 0, total: Number(newCatering.total) }); return d }); setNewCatering({ date: todayStr(), customer: '', guests: '', items: '', total: '' }) }}>➕ ক্যাটারিং যোগ</button>
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
              <button onClick={() => { if (!newMember.name || !newMember.phone) return alert('নাম ও ফোন দিন'); if (data.members.some((m) => m.phone === newMember.phone)) return alert('এই ফোনে মেম্বার already আছে'); upd((d) => { d.members.push({ id: `mb-${Date.now()}`, name: newMember.name, phone: newMember.phone, points: 0 }); return d }); setNewMember({ name: '', phone: '' }) }}>➕ মেম্বার যোগ</button>
            </div>
            <table className="tbl"><thead><tr><th>নাম</th><th>ফোন</th><th>পয়েন্ট</th><th></th></tr></thead><tbody>
              {data.members.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.phone}</td><td><b>{bnNum(m.points || 0)}</b></td><td><button onClick={() => { if (confirm(`"${m.name}" মুছবেন?`)) upd((d) => { d.members = d.members.filter((x) => x.id !== m.id); return d }) }}>🗑️</button></td></tr>)}
            </tbody></table>
            {!data.members.length && <p>এখনো কোনো মেম্বার নেই।</p>}
          </section>}

          {view === 'reviews' && <section>
            <h2>💬 রিভিউ</h2>
            <p>কাস্টমার অর্ডার ট্র্যাকার থেকে রিভিউ দেয় (পরিবেশন / বিল পেইড হওয়ার পর)। মালিক এখান থেকে উত্তর দিতে পারে।</p>
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
              <button onClick={() => { if (!newBooking.name || !newBooking.time) return alert('নাম ও সময় দিন'); upd((d) => { d.bookings.push({ id: `bk-${Date.now()}`, ...newBooking, guests: Number(newBooking.guests) || 0 }); return d }); setNewBooking({ date: todayStr(), time: '', name: '', phone: '', guests: '', table: 'T-01' }) }}>➕ বুকিং যোগ</button>
            </div>
            {data.bookings.map((b) => <div key={b.id} className="box"><b>{b.name}</b> • {b.date} {b.time} • {b.table} • {bnNum(b.guests)} জন • {b.phone} <button onClick={() => { if (confirm('বুকিং মুছবেন?')) upd((d) => { d.bookings = d.bookings.filter((x) => x.id !== b.id); return d }) }}>🗑️</button></div>)}
            {!data.bookings.length && <p>কোনো বুকিং নেই।</p>}
          </section>}

          {view === 'reports' && <section>
            <h2>📈 রিপোর্ট — গত ৭ দিন</h2>
            <table className="tbl"><thead><tr><th>তারিখ</th><th>অর্ডার</th><th>বিক্রি</th></tr></thead><tbody>
              {[...Array(7)].map((_, i) => { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); const os = data.orders.filter((o) => o.date === d && o.status !== 'cancelled'); return <tr key={d}><td>{new Date(d).toLocaleDateString('bn-BD')}</td><td>{bnNum(os.length)}</td><td>{tk(os.reduce((s, o) => s + total(o), 0))}</td></tr> })}
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
                    {[...Array(7)].map((_, i) => { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); const os = data.orders.filter((o) => o.date === d && o.status !== 'cancelled'); return <p key={d}>{new Date(d).toLocaleDateString('bn-BD')} — {bnNum(os.length)} অর্ডার — <b>{tk(os.reduce((s, o) => s + total(o), 0))}</b></p> })}
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
              <button onClick={() => { if (!newExpense.title || !newExpense.amount) return alert('নাম ও টাকা দিন'); upd((d) => { d.expenses.unshift({ id: `ex-${Date.now()}`, ...newExpense, amount: Number(newExpense.amount) }); return d }); setNewExpense({ date: todayStr(), title: '', category: 'অন্যান্য', amount: '' }) }}>➕ খরচ যোগ</button>
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
                  : <button onClick={() => { if (!confirm('আজকের হিসাব বন্ধ করবেন?')) return; upd((d) => { d.dayCloses.push({ date: t, sales, expenses: expTotal, net: sales - expTotal, byPayment: PAYMENTS.map((p) => ({ payment: p, total: paidToday.filter((b) => b.payment === p).reduce((s, b) => s + b.total, 0) })), closedBy: actorName(), time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) }); return d }); alert('আজকের হিসাব বন্ধ হয়েছে।') }}>🌙 দিনের হিসাব বন্ধ করুন</button>}
                <h3>আগের দিনের হিসাব</h3>
                {data.dayCloses.filter((c) => c.date !== t).slice().reverse().map((c) => <p key={c.date}>{c.date} — বিক্রি {tk(c.sales)} • খরচ {tk(c.expenses)} • নিট {tk(c.net)}</p>)}
                {!data.dayCloses.filter((c) => c.date !== t).length && <p>আগের কোনো হিসাব নেই।</p>}
              </>)
            })()}
          </section>}

          {view === 'staff' && <section>
            <h2>👥 স্টাফ + PIN লগইন</h2>
            <p>ডেমো PIN: মালিক 1234, নিলয় 1111, রাতুল 2222। স্টাফ নিজের PIN দিয়ে লগইন করলে কিচেনে শুধু তার স্টেশন দেখবে। মালিক প্রত্যেক স্টাফের অনুমতি (৭টি) বদলাতে পারে।</p>
            {data.staff.map((s) => <div key={s.id} className="box"><b>{s.name}</b> — {s.role}<br />
              <small>অনুমতি: {(s.perms || defaultPermsForStaff(s)).map((p) => PERM_LABELS[p]).join(', ')}</small>
              {isOwner() && <div className="row">{PERMS.map((p) => <label key={p} className="perm-check"><input type="checkbox" checked={(s.perms || []).includes(p)} onChange={(e) => upd((d) => { const x = d.staff.find((y) => y.id === s.id); if (!x) return d; const cur = new Set(x.perms || []); if (e.target.checked) cur.add(p); else cur.delete(p); x.perms = [...cur]; return d })} /> {PERM_LABELS[p]}</label>)}</div>}
              {pinFor === s.id ? <span><input type="password" placeholder="PIN দিন" value={pinInput} onChange={(e) => setPinInput(e.target.value)} /> <button onClick={() => { if (pinInput === s.pin) { setActiveStaff(s); setPinFor(null); setPinInput(''); setView('kitchen') } else alert('ভুল PIN') }}>লগইন</button></span> : <button onClick={() => setPinFor(s.id)}>🔑 PIN দিয়ে লগইন</button>}
              {isOwner() && <button onClick={() => { if (confirm(`"${s.name}" মুছবেন?`)) upd((d) => { d.staff = d.staff.filter((x) => x.id !== s.id); return d }) }}>🗑️ মুছুন</button>}
            </div>)}
            <div className="menu-form"><input placeholder="নতুন স্টাফের নাম" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} /><input placeholder="ভূমিকা, যেমন চা-মেকার" value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} /><input placeholder="PIN" value={newStaff.pin} onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })} /><select value={newStaff.station} onChange={(e) => setNewStaff({ ...newStaff, station: e.target.value })}><option value="All">All</option>{STATIONS.map((s) => <option key={s}>{s}</option>)}</select><button onClick={() => { if (!newStaff.name || !newStaff.pin) return alert('নাম ও PIN দিন'); const st = { id: `s${Date.now()}`, ...newStaff }; st.perms = defaultPermsForStaff(st); upd((d) => { d.staff.push(st); return d }); setNewStaff({ name: '', role: '', pin: '', station: 'Drinks' }) }}>➕ স্টাফ যোগ</button></div>
          </section>}

          {view === 'leave' && <section>
            <h2>🏖️ স্টাফ ছুটি</h2>
            <div className="menu-form">
              <select value={newLeave.staffId} onChange={(e) => setNewLeave({ ...newLeave, staffId: e.target.value })}><option value="">— স্টাফ বাছুন —</option>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <label>থেকে: <input type="date" value={newLeave.from} onChange={(e) => setNewLeave({ ...newLeave, from: e.target.value })} /></label>
              <label>পর্যন্ত: <input type="date" value={newLeave.to} onChange={(e) => setNewLeave({ ...newLeave, to: e.target.value })} /></label>
              <input placeholder="কারণ" value={newLeave.reason} onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} />
              <button onClick={() => { if (!newLeave.staffId || !newLeave.reason) return alert('স্টাফ ও কারণ দিন'); upd((d) => { d.leaves.unshift({ id: `lv-${Date.now()}`, ...newLeave, status: 'pending' }); return d }); setNewLeave({ staffId: '', from: todayStr(), to: todayStr(), reason: '' }) }}>➕ ছুটি যোগ</button>
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
              <button onClick={() => { if (!newCoupon.code || !newCoupon.pct) return alert('কোড ও ছাড় % দিন'); if (data.coupons.some((c) => c.code === newCoupon.code)) return alert('এই কোড already আছে'); upd((d) => { d.coupons.push({ id: `cp-${Date.now()}`, code: newCoupon.code, pct: Number(newCoupon.pct), active: true }); return d }); setNewCoupon({ code: '', pct: '' }) }}>➕ কুপন তৈরি</button>
            </div>
            {data.coupons.map((c) => <div key={c.id} className="box"><b>{c.code}</b> — {c.pct}% ছাড় • {c.active ? '✅ চালু' : '⛔ বন্ধ'} <button onClick={() => upd((d) => { const x = d.coupons.find((y) => y.id === c.id); if (x) x.active = !x.active; return d })}>{c.active ? 'বন্ধ করুন' : 'চালু করুন'}</button> <button onClick={() => { if (confirm('কুপন মুছবেন?')) upd((d) => { d.coupons = d.coupons.filter((y) => y.id !== c.id); return d }) }}>🗑️</button></div>)}
            {!data.coupons.length && <p>কোনো কুপন নেই — উপরে তৈরি করুন।</p>}
          </section>}

          {view === 'settings' && <section>
            <h2>⚙️ সেটিংস</h2>
            <div className="form">
              <label>দোকানের নাম <input value={settings.shop} onChange={(e) => setSettings({ ...settings, shop: e.target.value })} /></label>
              <label>ফোন <input value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label>
              <label>ঠিকানা <input value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label>
              <label>খোলার সময় <input value={settings.open} onChange={(e) => setSettings({ ...settings, open: e.target.value })} /></label>
              <label>ভ্যাট % <input type="number" min="0" value={settings.vat} onChange={(e) => setSettings({ ...settings, vat: Number(e.target.value) || 0 })} /></label>
              <label>সার্ভিস চার্জ % <input type="number" min="0" value={settings.service} onChange={(e) => setSettings({ ...settings, service: Number(e.target.value) || 0 })} /></label>
              <label>ব্যবসার ধরন <select value={settings.businessType} onChange={(e) => setSettings({ ...settings, businessType: e.target.value })}><option>Tea shop</option><option>Cafe</option><option>Restaurant</option></select></label>
              <label>থিম <select value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value })}>{THEMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <button onClick={() => { upd((d) => { d.settings = settings; return d }); alert('সেটিংস সংরক্ষিত হয়েছে') }}>💾 সংরক্ষণ করুন</button>
            </div>
            <p className="note">📱 সিঙ্ক নোট: সব ডেটা এই ডিভাইসের ব্রাউজারের localStorage-এ থাকে (key: dpcw-v1)। অন্য ফোন/কম্পিউটারে একই ডেটা দেখতে শেয়ার্ড ডেটাবেস + ব্যাকএন্ড লাগবে — এই ভার্সনে সেটা নেই।</p>
          </section>}

          {view === 'plan' && <section>
            <h2>💎 প্ল্যান</h2>
            <div className="box"><h3>বর্তমান প্ল্যান: {data.plan.type === 'trial' ? 'ট্রায়াল' : 'মাসিক'}</h3>
              <p>মাসিক: <b>৳২,০০০ / মাস</b> • বার্ষিক: <b>৳২০,০০০ / বছর</b> (২ মাস ফ্রি)</p>
              <p>যা যা থাকছে:</p>
              <ul><li>মেনু, টেবিল + QR, কাস্টমার অর্ডার</li><li>কিচেন ডিসপ্লে (KDS), POS + বিল</li><li>রিপোর্ট, অ্যানালিটিক্স, খরচ ও দিনের হিসাব</li><li>স্টাফ, ছুটি, স্টক, কুপন, মেম্বার, বুকিং, ডেলিভারি, ক্যাটারিং, রিভিউ</li></ul>
              <p>💳 পেমেন্ট: ম্যানুয়াল — bKash / Nagad-এ পাঠিয়ে মালিককে জানান, মালিক হাতে প্ল্যান চালু করবেন। এই ভার্সনে অনলাইন পেমেন্ট গেটওয়ে নেই।</p>
              {data.plan.type === 'trial' && <button onClick={() => { if (confirm('মাসিক প্ল্যানে যাবেন? পেমেন্ট ম্যানুয়ালি করতে হবে।')) upd((d) => { d.plan = { type: 'monthly', price: 2000 }; return d }) }}>💎 মাসিক প্ল্যানে যান (৳২,০০০/মাস)</button>}
              {data.plan.type === 'monthly' && <p className="note">✅ মাসিক প্ল্যান চালু আছে।</p>}
            </div>
          </section>}
          </>)}
        </main>
        <footer>© {data.settings.shop} • Vercel-এ ফ্রি হোস্ট করা যায় • ডেটা এই ব্রাউজারে সংরক্ষিত থাকে</footer>
      </div>
    </div>
  )
}
