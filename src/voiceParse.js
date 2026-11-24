// Voice-command parsers for Diploma Pass Cha-Wala (Web Speech API, bn-BD).
// Pure functions (no DOM) so they can be unit-tested in Node.
// Rules:
//  - Bengali digits ০-৯ are converted to ASCII before parsing.
//  - Voice order: longest menu-name match wins (মালাই চা স্পেশাল beats মালাই চা).
//  - Voice bazar: last number is the cost, an earlier number (if any) is the qty.

const BN = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' }
export function bnToAscii(s) { return String(s || '').replace(/[০-৯]/g, (d) => BN[d]) }

const NUM_WORDS = {
  'এক': 1, 'দুই': 2, 'দুইটা': 2, 'দুটি': 2, 'তিন': 3, 'তিনটা': 3, 'তিনটি': 3,
  'চার': 4, 'চারটা': 4, 'পাঁচ': 5, 'পাঁচটা': 5, 'ছয়': 6, 'ছয়টা': 6, 'সাত': 7,
  'আট': 8, 'নয়': 9, 'দশ': 10,
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
  'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
}

export function normalizeVoice(s) {
  return bnToAscii(String(s || '').toLowerCase()).replace(/\s+/g, ' ').trim()
}

// All numbers (digits or number-words) in the text, in order, with their span.
function findNumbers(text) {
  const out = []
  const re = /\d+/g
  let m
  while ((m = re.exec(text)) !== null) out.push({ value: Number(m[0]), index: m.index, len: m[0].length })
  const words = text.split(' ')
  let pos = 0
  for (const w of words) {
    const clean = w.replace(/[.,!?।]+$/g, '')
    if (NUM_WORDS[clean] != null) out.push({ value: NUM_WORDS[clean], index: pos, len: w.length })
    pos += w.length + 1
  }
  return out.sort((a, b) => a.index - b.index)
}

export function parseTableCode(text) {
  const t = normalizeVoice(text)
  const m = t.match(/(?:table|টেবিল)\s*(\d{1,2})/)
  if (!m) return null
  return `T-${String(Number(m[1])).padStart(2, '0')}`
}

// Longest menu-name match: sort by name length desc so "স্পেশাল মালাই চা"
// beats "মালাই চা" when both appear in the transcript.
export function findMenuItem(text, menu) {
  const t = normalizeVoice(text)
  const flat = t.replace(/\s+/g, '')
  const sorted = [...(menu || [])].filter((x) => x.active !== false)
    .sort((a, b) => bnToAscii(b.name).length - bnToAscii(a.name).length)
  for (const item of sorted) {
    const name = normalizeVoice(item.name)
    if (!name) continue
    if (t.includes(name)) return item
    if (flat.includes(name.replace(/\s+/g, ''))) return item
  }
  return null
}

// "two biryani for table 5" / "টেবিল ৫-এ দুইটা মালাই চা" ->
// { item, qty, table } — table may be null (caller defaults to T-01).
export function parseVoiceOrder(text, menu) {
  const t = normalizeVoice(text)
  const item = findMenuItem(t, menu)
  if (!item) return null
  const table = parseTableCode(t)
  // Qty: first number that is NOT the table number.
  const tablePart = t.match(/(?:table|টেবিল)\s*\d{1,2}/)
  const withoutTable = tablePart ? t.replace(tablePart[0], ' ') : t
  const nums = findNumbers(withoutTable)
  const qty = nums.length ? Math.min(Math.max(nums[0].value, 1), 99) : 1
  return { item, qty, table }
}

// "দুধ ৫ কেজি ৩০০ টাকা" -> { item: 'দুধ', qty: 5, cost: 300 }
// "চিনি ২০০ টাকা" -> { item: 'চিনি', qty: 1, cost: 200 }
export function parseVoiceBazar(text) {
  const t = normalizeVoice(text)
  const nums = findNumbers(t)
  if (!nums.length) return null
  const cost = nums[nums.length - 1].value
  const qty = nums.length >= 2 ? Math.min(Math.max(nums[0].value, 1), 999) : 1
  let item = t
  // Remove the cost number and currency words, and the qty number if present.
  item = item.replace(String(cost), ' ')
  if (nums.length >= 2) item = item.replace(new RegExp(`\\b${nums[0].value}\\b`), ' ')
  item = item
    .replace(/টাকা|taka|৳|\/-|কেজি|kg|লিটার|প্যাকেট|বাজার|কিনলাম|কিনেছি/g, ' ')
    .replace(/\s+/g, ' ').trim()
  if (!item || item.length < 2) return null
  return { item, qty, cost }
}

export default parseVoiceOrder
