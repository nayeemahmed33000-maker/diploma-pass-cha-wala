// Menu-photo OCR parser for Diploma Pass Cha-Wala.
// Pure functions (no DOM / no OCR here) so they can be unit-tested in Node.
// Rules follow the CafePilot scan upgrade, adapted client-side:
//  - Bengali digits ০-৯ are converted to ASCII before parsing.
//  - A price must be present and between ৳5 and ৳10000, otherwise the line is dropped.
//  - Headings become categories and are never added as items.
//  - Fuzzy dedupe: an item whose name already exists in the menu is skipped, never duplicated.
//    (ফুচকা vs দই ফুচকা stay separate — substring alone is NOT a duplicate.)

const BN = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' }
export function bnToAscii(s) { return String(s || '').replace(/[০-৯]/g, (d) => BN[d]) }

export const CATS = ['দুধ চা', 'রং চা', 'কফি', 'মকটেল', 'লাচ্ছি', 'স্ন্যাকস']

// Heading text (Bengali or English, as OCR usually returns it) -> menu category.
const CAT_MAP = {
  'দুধ চা': 'দুধ চা', 'milk tea': 'দুধ চা', 'dudh cha': 'দুধ চা', 'special cha': 'দুধ চা',
  'রং চা': 'রং চা', 'rong cha': 'রং চা', 'রঙ চা': 'রং চা', 'red tea': 'রং চা', 'lemon tea': 'রং চা', 'green tea': 'রং চা',
  'কফি': 'কফি', 'coffee': 'কফি', 'কফি ও কোল্ড কফি': 'কফি',
  'মকটেল': 'মকটেল', 'mocktail': 'মকটেল', 'mocktails': 'মকটেল', 'মকটেলস': 'মকটেল', 'লেমনেড': 'মকটেল', 'lemonade': 'মকটেল',
  'লাচ্ছি': 'লাচ্ছি', 'lassi': 'লাচ্ছি',
  'স্ন্যাকস': 'স্ন্যাকস', 'snacks': 'স্ন্যাকস', 'snack': 'স্ন্যাকস', 'নাস্তা': 'স্ন্যাকস', 'ফাস্ট ফুড': 'স্ন্যাকস',
  'চা': 'দুধ চা', 'tea': 'দুধ চা', 'পানীয়': 'দুধ চা', 'drinks': 'দুধ চা',
}

function cleanKey(s) {
  return bnToAscii(String(s || '').toLowerCase())
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function normalizeName(name) { return cleanKey(name) }

export function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

// Duplicate if the normalised names are equal, or differ by at most 2 edits
// (OCR often misreads 1-2 letters, e.g. কোল্ড -> কোক্ত). Substring alone is NOT
// a duplicate, so "ফুচকা" and "দই ফুচকা" stay separate items.
export function isDuplicate(name, existingNames) {
  const key = cleanKey(name)
  if (!key) return true
  for (const e of existingNames || []) {
    const ek = cleanKey(e)
    if (!ek) continue
    if (key === ek) return true
    if (Math.min(key.length, ek.length) >= 4 && levenshtein(key, ek) <= 2) return true
  }
  return false
}

function headingCategory(line) {
  const t = bnToAscii(line).toLowerCase().replace(/[:：.]+$/, '').trim()
  if (CAT_MAP[t]) return CAT_MAP[t]
  // "দুধ চা — মেনু" style headings: starts with a known heading word.
  for (const [k, v] of Object.entries(CAT_MAP)) {
    if (t === k || t.startsWith(k + ' ') || t.startsWith(k + '—') || t.startsWith(k + '-')) return v
  }
  return null
}

function guessCategory(name) {
  const t = bnToAscii(name).toLowerCase()
  if (/কফি|coffee|cold coffee|কোল্ড/.test(t)) return 'কফি'
  if (/মকটেল|mocktail|লেমনেড|lemonade|মাল্টা|তেঁতুল|mint/.test(t)) return 'মকটেল'
  if (/লাচ্ছি|lassi/.test(t)) return 'লাচ্ছি'
  if (/ফুচকা|সিঙ্গারা|সমোসা|কেক|ফ্রাই|বিস্কুট|snack|fuchka|singara|samosa|fries|cake/.test(t)) return 'স্ন্যাকস'
  if (/রং চা|রঙ চা|লেবু|lemon|green tea|পুদিনা|আদা রং/.test(t)) return 'রং চা'
  if (/চা|tea|cha/.test(t)) return 'দুধ চা'
  return null
}

function stationFor(cat) {
  return cat === 'স্ন্যাকস' ? 'Snacks' : 'Drinks'
}

// Extract the price: the LAST number on the line, usually at the end
// ("Special Malai Cha 50", "মসলা চা ৩৫", "Cold Coffee — 120", "Green Tea Tk 30").
function extractPrice(line) {
  const s = bnToAscii(line).trim()
  // Price at the end, optionally followed by ৳ / Tk / টাকা / /-
  let m = s.match(/(\d[\d,]*\.?\d*)\s*(?:৳|টাকা|Tk|taka|\/-)?\s*[.\-–—]*\s*$/)
  if (m) return Number(m[1].replace(/,/g, ''))
  // Price after a leader of dots/dashes ("Masala Cha ...... 30")
  m = s.match(/[.·\-–—]{2,}\s*(\d[\d,]*)/)
  if (m) return Number(m[1].replace(/,/g, ''))
  return null
}

function cleanName(line, price) {
  let s = bnToAscii(line).trim()
  // Drop a leading list number: "1. ", "১)", "2 - "
  s = s.replace(/^\d+\s*[.)\-–—]\s*/, '')
  // Drop the trailing price + currency + leaders, then any leftover currency word.
  s = s.replace(/(\d[\d,]*\.?\d*)\s*(?:৳|টাকা|Tk|taka|\/-)?\s*[.\-–—]*\s*$/, '')
  s = s.replace(/\s*(?:৳|টাকা|Tk|taka)\s*$/i, '')
  s = s.replace(/[.·\-–—:]+$/, '').replace(/^[.·\-–—:\s]+/, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * Parse raw OCR text into menu items.
 * @param {string} text - raw OCR output (may be Bengali, English or mixed)
 * @param {Array} existingMenu - current menu items [{name}] for dedupe
 * @returns {{items: Array<{name,cat,price,station,active}>, added: number, duplicates: number, dropped: number, totalLines: number}}
 */
export function parseMenuText(text, existingMenu = []) {
  const existingNames = (existingMenu || []).map((m) => m.name)
  const seenNames = [...existingNames]
  const items = []
  let duplicates = 0
  let dropped = 0
  let totalLines = 0
  let currentCat = null
  const lines = String(text || '').split(/\r?\n/)

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    totalLines++
    // A line WITH a price is always an item — even "Green Tea 25" or
    // "Lemon Tea 15", which look like headings but are menu items.
    // Only a line with NO price can be a heading.
    const price = extractPrice(line)
    if (price === null) {
      const heading = headingCategory(line)
      if (heading) { currentCat = heading; continue }
      dropped++; continue
    }
    if (Number.isNaN(price) || price < 5 || price > 10000) { dropped++; continue }
    const name = cleanName(line, price)
    if (name.length < 2 || !/[\p{L}]/u.test(name)) { dropped++; continue }
    // Note: no heading check here — a line with a price is an item, even if
    // its name ("Green Tea", "Lemon Tea") also looks like a category word.
    if (isDuplicate(name, seenNames)) { duplicates++; continue }
    // Strong keyword in the name (কফি, লাচ্ছি, মকটেল, রং চা) beats the
    // heading; otherwise the category comes from the nearest heading above.
    const guessed = guessCategory(name)
    const cat = (guessed && guessed !== 'দুধ চা') ? guessed : (currentCat || guessed || 'দুধ চা')
    items.push({ name, cat, price, station: stationFor(cat), active: true })
    seenNames.push(name)
  }
  return { items, added: items.length, duplicates, dropped, totalLines }
}

export default parseMenuText
