import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const KEY = 'dpcw-v1'
const todayStr = () => new Date().toISOString().slice(0, 10)
const tk = (n) => `৳${Number(n || 0).toLocaleString('en-IN')}`
const bnNum = (n) => Number(n).toLocaleString('bn-BD')
const STATUS = { new: 'নতুন', confirmed: 'কনফার্ম', ready: 'রেডি', served: 'পরিবেশন', paid: 'বিল পেইড', cancelled: 'বাতিল' }
const STATIONS = ['Drinks', 'Kitchen', 'Snacks']
const CATS = ['দুধ চা', 'রং চা', 'কফি', 'মকটেল', 'লাচ্ছি', 'স্ন্যাকস']

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

function seed() {
  const t = todayStr()
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const mk = (id, date, table, items, status, time) => ({
    id, date, table, customer: 'ডেমো কাস্টমার', items: items.map(([mid, qty]) => {
      const m = seedMenu.find((x) => x.id === mid); return { id: mid, name: m.name, price: m.price, qty, station: m.station }
    }), status, time, billNo: status === 'paid' ? 'Bill No-0001' : null,
  })
  return {
    settings: { shop: 'দ্য ডিপ্লোমা পাস চা-ওয়ালা', phone: '01900-000000', address: 'নারায়ণগঞ্জ', open: 'সকাল ১০টা — রাত ১০টা' },
    menu: seedMenu,
    tables: Array.from({ length: 10 }, (_, i) => ({ code: `T-${String(i + 1).padStart(2, '0')}`, name: `টেবিল ${bnNum(i + 1)}` })),
    staff: [
      { id: 's1', name: 'মালিক', role: 'Owner — সব দেখবে', pin: '1234', station: 'All' },
      { id: 's2', name: 'নিলয়', role: 'চা-মেকার — শুধু চা / ড্রিংকস', pin: '1111', station: 'Drinks' },
      { id: 's3', name: 'রাতুল', role: 'স্ন্যাকস-মেকার — শুধু স্ন্যাকস', pin: '2222', station: 'Snacks' },
    ],
    orders: [
      mk('ORD-1001', t, 'T-01', [['m1', 2], ['m21', 1]], 'new', '০৯:৩২'),
      mk('ORD-1002', t, 'T-03', [['m2', 1], ['m20', 2]], 'ready', '০৯:১৫'),
      mk('ORD-1003', t, 'T-02', [['m1', 1], ['m13', 1]], 'paid', '০৮:৫০'),
      mk('ORD-0998', y, 'T-05', [['m1', 3], ['m22', 1]], 'paid', '১৯:২০'),
    ],
    bills: [{ no: 'Bill No-0001', date: t, orderId: 'ORD-1003', total: 90 }],
    seq: 1003,
  }
}
function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); return d && d.menu ? d : seed() } catch { return seed() } }
const total = (o) => o.items.reduce((s, i) => s + i.price * i.qty, 0)

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

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)) }, [data])
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('table')
    if (p) { setCustTable(p); setView('customer') }
  }, [])
  useEffect(() => { setSettings(data.settings) }, [data.settings])

  const upd = (fn) => setData((d) => fn(structuredClone(d)))
  const todayOrders = useMemo(() => data.orders.filter((o) => o.date === todayStr()), [data.orders])
  const todaySale = todayOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + total(o), 0)
  const popular = useMemo(() => {
    const m = {}; todayOrders.forEach((o) => o.items.forEach((i) => { m[i.name] = (m[i.name] || 0) + i.qty }))
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [todayOrders])
  const baseUrl = window.location.origin + window.location.pathname

  function placeOrder() {
    const items = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => {
      const m = data.menu.find((x) => x.id === id); return { id, name: m.name, price: m.price, qty, station: m.station }
    })
    if (!items.length) { alert('কার্ট খালি — আগে আইটেম যোগ করুন'); return }
    const seq = data.seq + 1
    const order = { id: `ORD-${seq}`, date: todayStr(), table: custTable, customer: custName || 'কাস্টমার', items, status: 'new', time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }), billNo: null }
    upd((d) => { d.orders.unshift(order); d.seq = seq; return d })
    setCart({}); setLastOrder(order.id); setAlert(order); setView('customer')
  }
  function setStatus(id, status) { upd((d) => { const o = d.orders.find((x) => x.id === id); if (o) o.status = status; return d }) }
  function makeBill(order) {
    const t = todayStr(); const n = data.bills.filter((b) => b.date === t).length + 1
    const no = `Bill No-${String(n).padStart(4, '0')}`
    const b = { no, date: t, orderId: order.id, total: total(order) }
    upd((d) => { d.bills.push(b); const o = d.orders.find((x) => x.id === order.id); if (o) { o.status = 'paid'; o.billNo = no } return d })
    setBill({ ...b, order }); setStatus(order.id, 'paid')
  }
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => { const m = data.menu.find((x) => x.id === id); return s + (m ? m.price * q : 0) }, 0)
  const lastOrderObj = data.orders.find((o) => o.id === lastOrder)
  const kdsOrders = data.orders.filter((o) => ['new', 'confirmed', 'ready'].includes(o.status))

  const NAV = [['dashboard', '📊 ড্যাশবোর্ড'], ['menu', '🍵 মেনু'], ['tables', '🪑 টেবিল + QR'], ['customer', '🛒 কাস্টমার মেনু'], ['orders', '🧾 অর্ডার'], ['kitchen', '👨‍🍳 কিচেন (KDS)'], ['pos', '💰 POS + বিল'], ['staff', '👥 স্টাফ'], ['reports', '📈 রিপোর্ট'], ['settings', '⚙️ সেটিংস']]

  return (
    <div className="app">
      <header className="header">
        <img src="/logo.jpg" alt="দ্য ডিপ্লোমা পাস চা-ওয়ালা লোগো" className="logo" />
        <div><h1>{data.settings.shop}</h1><p>Diploma Pass Cha-Wala • চা, গল্প, আড্ডা • {data.settings.open}</p></div>
        <div className="head-right"><span>📞 {data.settings.phone}</span><span>📍 {data.settings.address}</span></div>
      </header>
      {alert && <div className="alert">🔔 নতুন অর্ডার! <b>{alert.id}</b> — {alert.table} • {tk(total(alert))} <button onClick={() => { setAlert(null); setView('orders') }}>অর্ডার দেখুন</button> <button onClick={() => setAlert(null)}>✕</button></div>}
      <nav className="nav">{NAV.map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}</nav>
      <main>
        {view === 'dashboard' && <section>
          <h2>📊 আজকের ড্যাশবোর্ড — {new Date().toLocaleDateString('bn-BD')}</h2>
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
          <p className="note">ডেমো ডেটা সহ সাজানো আছে। আসল ব্যবহারে নতুন অর্ডার এলেই এখানে আপডেট হবে। <button onClick={() => { if (confirm('সব ডেটা রিসেট করে ডেমো ডেটা ফেরাবেন?')) { const s = seed(); setData(s); localStorage.setItem(KEY, JSON.stringify(s)) } }}>ডেমো ডেটা রিসেট</button></p>
        </section>}

        {view === 'menu' && <section>
          <h2>🍵 মেনু ম্যানেজমেন্ট — {bnNum(data.menu.filter((m) => m.active).length)}টি আইটেম</h2>
          <div className="chips">{['সব', ...CATS].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div className="menu-form">
            <input placeholder="নতুন আইটেমের নাম" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
            <select value={newItem.cat} onChange={(e) => setNewItem({ ...newItem, cat: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <input type="number" placeholder="দাম (৳)" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
            <select value={newItem.station} onChange={(e) => setNewItem({ ...newItem, station: e.target.value })}>{STATIONS.map((s) => <option key={s}>{s}</option>)}</select>
            <button onClick={() => { if (!newItem.name || !newItem.price) return alert('নাম ও দাম দিন'); upd((d) => { d.menu.push({ id: `m${Date.now()}`, name: newItem.name, cat: newItem.cat, price: Number(newItem.price), station: newItem.station, active: true }); return d }); setNewItem({ name: '', cat: 'দুধ চা', price: '', station: 'Drinks' }) }}>➕ যোগ করুন</button>
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

        {view === 'customer' && <section>
          <h2>🛒 কাস্টমার মেনু — {custTable} {data.tables.find((t) => t.code === custTable)?.name || ''}</h2>
          <div className="menu-form"><label>টেবিল: <select value={custTable} onChange={(e) => setCustTable(e.target.value)}>{data.tables.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}</select></label><input placeholder="আপনার নাম (ঐচ্ছিক)" value={custName} onChange={(e) => setCustName(e.target.value)} /></div>
          {lastOrderObj && <div className="box tracker"><h3>📍 আপনার অর্ডার ট্র্যাকার — {lastOrderObj.id}</h3><p>স্ট্যাটাস: <b>{STATUS[lastOrderObj.status]}</b> {lastOrderObj.billNo ? `• ${lastOrderObj.billNo}` : ''}</p><p>মোট: {tk(total(lastOrderObj))}</p><div className="steps">{['new', 'confirmed', 'ready', 'served', 'paid'].map((s) => <span key={s} className={['new', 'confirmed', 'ready', 'served', 'paid'].indexOf(lastOrderObj.status) >= ['new', 'confirmed', 'ready', 'served', 'paid'].indexOf(s) ? 'done' : ''}>{STATUS[s]}</span>)}</div></div>}
          <div className="chips">{['সব', ...CATS].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div className="menu-grid">{data.menu.filter((m) => m.active && (cat === 'সব' || m.cat === cat)).map((m) => <div key={m.id} className="menu-item"><b>{m.name}</b><span>{m.cat} • {m.station}</span><strong>{tk(m.price)}</strong><div className="qty"><button onClick={() => setCart((c) => ({ ...c, [m.id]: Math.max(0, (c[m.id] || 0) - 1) }))}>−</button><b>{cart[m.id] || 0}</b><button onClick={() => setCart((c) => ({ ...c, [m.id]: (c[m.id] || 0) + 1 }))}>+</button></div></div>)}</div>
          <div className="cart-bar">🛒 মোট: <b>{tk(cartTotal)}</b> <button disabled={!cartTotal} onClick={placeOrder}>অর্ডার দিন →</button></div>
        </section>}

        {view === 'orders' && <section>
          <h2>🧾 অর্ডার — আজ {bnNum(todayOrders.length)}টি</h2>
          {todayOrders.map((o) => <div key={o.id} className="box order"><b>{o.id}</b> • {o.table} • {o.customer} • {o.time} • <b>{STATUS[o.status]}</b><p>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</p><p>মোট: <b>{tk(total(o))}</b> {o.billNo && `• ${o.billNo}`}</p>
            <div className="row">{o.status === 'new' && <button onClick={() => setStatus(o.id, 'confirmed')}>✅ কনফার্ম</button>}{o.status === 'confirmed' && <button onClick={() => setStatus(o.id, 'ready')}>🍵 রেডি</button>}{o.status === 'ready' && <button onClick={() => setStatus(o.id, 'served')}>🍽️ পরিবেশন</button>}{o.status === 'served' && <button onClick={() => makeBill(o)}>💰 বিল করুন</button>}{['new', 'confirmed'].includes(o.status) && <button onClick={() => { if (confirm('অর্ডার বাতিল করবেন?')) setStatus(o.id, 'cancelled') }}>❌ বাতিল</button>}</div></div>)}
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
          <p>পরিবেশন হওয়া অর্ডারের বিল করুন — বিল নম্বর প্রতিদিন নতুন করে Bill No-0001 থেকে শুরু হয়।</p>
          {todayOrders.filter((o) => o.status === 'served').map((o) => <div key={o.id} className="box"><b>{o.id}</b> • {o.table} • মোট {tk(total(o))} <button onClick={() => makeBill(o)}>🧾 বিল প্রিন্ট</button></div>)}
          {!todayOrders.some((o) => o.status === 'served') && <p>বিল করার মতো কোনো অর্ডার নেই।</p>}
          <h3>আজকের বিল</h3>{data.bills.filter((b) => b.date === todayStr()).map((b) => <p key={b.no}>{b.no} — {b.orderId} — {tk(b.total)}</p>)}
          {bill && <div className="box print-area"><div className="bill"><img src="/logo.jpg" alt="লোগো" style={{ width: 70, borderRadius: '50%' }} /><h3>{data.settings.shop}</h3><p>{data.settings.address} • {data.settings.phone}</p><hr /><p><b>{bill.no}</b> • অর্ডার {bill.orderId} • {bill.date}</p>{bill.order.items.map((i) => <p key={i.id}>{i.name} × {i.qty} — {tk(i.price * i.qty)}</p>)}<hr /><p><b>মোট: {tk(bill.total)}</b></p><p>ধন্যবাদ, আবার আসবেন! ☕</p><button onClick={() => window.print()}>🖨️ প্রিন্ট</button> <button onClick={() => setBill(null)}>বন্ধ</button></div></div>}
        </section>}

        {view === 'staff' && <section>
          <h2>👥 স্টাফ + PIN লগইন</h2>
          <p>ডেমো PIN: মালিক 1234, নিলয় 1111, রাতুল 2222। স্টাফ নিজের PIN দিয়ে লগইন করলে কিচেনে শুধু তার স্টেশন দেখবে।</p>
          {data.staff.map((s) => <div key={s.id} className="box"><b>{s.name}</b> — {s.role}<br />{pinFor === s.id ? <span><input type="password" placeholder="PIN দিন" value={pinInput} onChange={(e) => setPinInput(e.target.value)} /> <button onClick={() => { if (pinInput === s.pin) { setActiveStaff(s); setPinFor(null); setPinInput(''); setView('kitchen') } else alert('ভুল PIN') }}>লগইন</button></span> : <button onClick={() => setPinFor(s.id)}>🔑 PIN দিয়ে লগইন</button>}</div>)}
          <div className="menu-form"><input placeholder="নতুন স্টাফের নাম" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} /><input placeholder="ভূমিকা, যেমন চা-মেকার" value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} /><input placeholder="PIN" value={newStaff.pin} onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })} /><select value={newStaff.station} onChange={(e) => setNewStaff({ ...newStaff, station: e.target.value })}><option value="All">All</option>{STATIONS.map((s) => <option key={s}>{s}</option>)}</select><button onClick={() => { if (!newStaff.name || !newStaff.pin) return alert('নাম ও PIN দিন'); upd((d) => { d.staff.push({ id: `s${Date.now()}`, ...newStaff }); return d }); setNewStaff({ name: '', role: '', pin: '', station: 'Drinks' }) }}>➕ স্টাফ যোগ</button></div>
        </section>}

        {view === 'reports' && <section>
          <h2>📈 রিপোর্ট</h2>
          <table className="tbl"><thead><tr><th>তারিখ</th><th>অর্ডার</th><th>বিক্রি</th></tr></thead><tbody>
            {[...Array(7)].map((_, i) => { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); const os = data.orders.filter((o) => o.date === d && o.status !== 'cancelled'); return <tr key={d}><td>{new Date(d).toLocaleDateString('bn-BD')}</td><td>{bnNum(os.length)}</td><td>{tk(os.reduce((s, o) => s + total(o), 0))}</td></tr> })}
          </tbody></table>
          <h3>সবচেয়ে বেশি বিক্রি (সব দিন)</h3>{Object.entries(data.orders.flatMap((o) => o.items).reduce((m, i) => { m[i.name] = (m[i.name] || 0) + i.qty; return m }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, q]) => <p key={n}>{n} — <b>{bnNum(q)}টি</b></p>)}
        </section>}

        {view === 'settings' && <section>
          <h2>⚙️ সেটিংস</h2>
          <div className="form">
            <label>দোকানের নাম <input value={settings.shop} onChange={(e) => setSettings({ ...settings, shop: e.target.value })} /></label>
            <label>ফোন <input value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label>
            <label>ঠিকানা <input value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label>
            <label>খোলার সময় <input value={settings.open} onChange={(e) => setSettings({ ...settings, open: e.target.value })} /></label>
            <button onClick={() => { upd((d) => { d.settings = settings; return d }); alert('সেটিংস সংরক্ষিত হয়েছে') }}>💾 সংরক্ষণ করুন</button>
          </div>
          <p className="note">সব ডেটা এই ব্রাউজারের localStorage-এ থাকে। অন্য ফোনে একই ডেটা দেখতে শেয়ার্ড ডেটাবেস লাগবে — README দেখুন।</p>
        </section>}
      </main>
      <footer>© {data.settings.shop} • Vercel-এ ফ্রি হোস্ট করা যায় • ডেটা এই ব্রাউজারে সংরক্ষিত থাকে</footer>
    </div>
  )
}
