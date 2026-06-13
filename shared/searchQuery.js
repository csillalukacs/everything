import { cityOf } from './items.js';

const FIELD_ALIASES = { year: 'acquired', description: 'desc', created: 'added', lastused: 'used' };
const VALID_FIELDS = new Set(['tag', 'acquired', 'added', 'used', 'uses', 'city', 'name', 'desc', 'ocr']);

function tokenize(input) {
  const tokens = [];
  const s = input;
  let i = 0;

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;

    let negated = false;
    if (s[i] === '-' && i + 1 < s.length && !/\s/.test(s[i + 1])) {
      negated = true;
      i++;
    }

    let field = null;
    let j = i;
    while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
    if (j > i && s[j] === ':') {
      const candidate = s.slice(i, j).toLowerCase();
      const resolved = FIELD_ALIASES[candidate] ?? candidate;
      if (VALID_FIELDS.has(resolved)) {
        field = resolved;
        i = j + 1;
      }
    }

    let value;
    let quoted = false;
    if (s[i] === '"') {
      quoted = true;
      i++;
      const start = i;
      while (i < s.length && s[i] !== '"') i++;
      value = s.slice(start, i);
      if (s[i] === '"') i++;
    } else {
      const start = i;
      while (i < s.length && !/\s/.test(s[i])) i++;
      value = s.slice(start, i);
    }

    if (!value && field == null) continue;
    tokens.push({ field, value, negated, quoted });
  }

  return tokens;
}

function parseDate(raw) {
  const s = raw.trim().toLowerCase();
  let date;
  let precision;

  if (s === 'today') {
    date = new Date();
    precision = 'day';
  } else if (s === 'yesterday') {
    date = new Date();
    date.setDate(date.getDate() - 1);
    precision = 'day';
  } else {
    const m = s.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
    if (!m) return null;
    const y = parseInt(m[1], 10);
    const mo = m[2] ? parseInt(m[2], 10) : null;
    const d = m[3] ? parseInt(m[3], 10) : null;
    if (d != null) { date = new Date(y, mo - 1, d); precision = 'day'; }
    else if (mo != null) { date = new Date(y, mo - 1, 1); precision = 'month'; }
    else { date = new Date(y, 0, 1); precision = 'year'; }
  }

  const lower = new Date(date);
  const upper = new Date(date);
  if (precision === 'day') {
    lower.setHours(0, 0, 0, 0);
    upper.setHours(23, 59, 59, 999);
  } else if (precision === 'month') {
    lower.setDate(1);
    lower.setHours(0, 0, 0, 0);
    upper.setMonth(upper.getMonth() + 1, 0);
    upper.setHours(23, 59, 59, 999);
  } else {
    lower.setMonth(0, 1);
    lower.setHours(0, 0, 0, 0);
    upper.setFullYear(upper.getFullYear() + 1, 0, 0);
    upper.setHours(23, 59, 59, 999);
  }
  return { lower: lower.getTime(), upper: upper.getTime() };
}

function parseRangeOrCmp(field, value, negated) {
  if (value.toLowerCase() === 'none') {
    return { field, op: 'none', value: null, negated };
  }

  const rangeMatch = value.match(/^(.*?)\.\.(.*)$/);
  if (rangeMatch) {
    const fromStr = rangeMatch[1];
    const toStr = rangeMatch[2];
    const from = fromStr ? parseFieldValue(field, fromStr) : null;
    const to = toStr ? parseFieldValue(field, toStr) : null;
    if (from == null && to == null) return null;
    return { field, op: 'range', value: { from, to }, negated };
  }

  const cmpMatch = value.match(/^(>=|<=|>|<)(.+)$/);
  if (cmpMatch) {
    const op = { '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' }[cmpMatch[1]];
    const v = parseFieldValue(field, cmpMatch[2]);
    if (v == null) return null;
    return { field, op, value: v, negated };
  }

  const v = parseFieldValue(field, value);
  if (v == null) return null;
  return { field, op: 'eq', value: v, negated };
}

function parseFieldValue(field, raw) {
  if (field === 'acquired' || field === 'uses') {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return null;
    return n;
  }
  if (field === 'added' || field === 'used') return parseDate(raw);
  return null;
}

function parseClause(tok) {
  const { field, value, negated, quoted } = tok;

  if (field == null) {
    if (!value) return null;
    if (!quoted && value === 'OR' && !negated) return { type: 'OR' };
    return { field: null, op: 'contains', value: value.toLowerCase(), negated };
  }

  if (!value) return null;

  if (field === 'tag' || field === 'city') {
    if (value.toLowerCase() === 'none') return { field, op: 'none', value: null, negated };
    return { field, op: 'eq', value: value.toLowerCase(), negated };
  }

  if (field === 'name' || field === 'desc' || field === 'ocr') {
    if (value.toLowerCase() === 'none') return { field, op: 'none', value: null, negated };
    return { field, op: 'contains', value: value.toLowerCase(), negated };
  }

  if (field === 'acquired' || field === 'added' || field === 'used' || field === 'uses') {
    return parseRangeOrCmp(field, value, negated);
  }

  return null;
}

export function parseQuery(input) {
  if (!input || typeof input !== 'string' || !input.trim()) return [];

  const tokens = tokenize(input);
  const ast = [];
  let group = null;
  let pendingOr = false;

  for (const tok of tokens) {
    const clause = parseClause(tok);
    if (!clause) continue;

    if (clause.type === 'OR') {
      pendingOr = true;
      continue;
    }

    if (pendingOr && group) {
      group.push(clause);
    } else {
      if (group) ast.push(group);
      group = [clause];
    }
    pendingOr = false;
  }

  if (group) ast.push(group);
  return ast;
}

function matchClause(item, clause) {
  if (clause.field == null) {
    const needle = clause.value;
    const name = (item.name ?? '').toLowerCase();
    if (name.includes(needle)) return true;
    const desc = (item.description ?? '').toLowerCase();
    if (desc.includes(needle)) return true;
    const ocr = (item.ocr_text ?? '').toLowerCase();
    if (ocr.includes(needle)) return true;
    return (item.tags ?? []).some(t => (t.name ?? '').toLowerCase().includes(needle));
  }

  if (clause.field === 'tag') {
    const tags = (item.tags ?? []).map(t => (t.name ?? '').toLowerCase());
    if (clause.op === 'none') return tags.length === 0;
    return tags.includes(clause.value);
  }

  if (clause.field === 'city') {
    const c = cityOf(item.acquired_location);
    if (clause.op === 'none') return c == null;
    return c != null && c.toLowerCase() === clause.value;
  }

  if (clause.field === 'name') {
    const v = (item.name ?? '').trim();
    if (clause.op === 'none') return v === '';
    return v.toLowerCase().includes(clause.value);
  }
  if (clause.field === 'desc') {
    const v = (item.description ?? '').trim();
    if (clause.op === 'none') return v === '';
    return v.toLowerCase().includes(clause.value);
  }
  if (clause.field === 'ocr') {
    const v = (item.ocr_text ?? '').trim();
    if (clause.op === 'none') return v === '';
    return v.toLowerCase().includes(clause.value);
  }

  if (clause.field === 'acquired') {
    const y = item.acquired_year;
    if (clause.op === 'none') return y == null;
    if (y == null) return false;
    if (clause.op === 'eq') return y === clause.value;
    if (clause.op === 'gt') return y > clause.value;
    if (clause.op === 'gte') return y >= clause.value;
    if (clause.op === 'lt') return y < clause.value;
    if (clause.op === 'lte') return y <= clause.value;
    if (clause.op === 'range') {
      const { from, to } = clause.value;
      if (from != null && y < from) return false;
      if (to != null && y > to) return false;
      return true;
    }
    return false;
  }

  if (clause.field === 'added') {
    const t = item.created_at ? new Date(item.created_at).getTime() : null;
    if (clause.op === 'none') return t == null;
    if (t == null || Number.isNaN(t)) return false;
    const v = clause.value;
    if (clause.op === 'eq') return t >= v.lower && t <= v.upper;
    if (clause.op === 'gt') return t > v.upper;
    if (clause.op === 'gte') return t >= v.lower;
    if (clause.op === 'lt') return t < v.lower;
    if (clause.op === 'lte') return t <= v.upper;
    if (clause.op === 'range') {
      const { from, to } = v;
      if (from != null && t < from.lower) return false;
      if (to != null && t > to.upper) return false;
      return true;
    }
    return false;
  }

  if (clause.field === 'used') {
    // last_used_on is a 'YYYY-MM-DD' local calendar day (or null = never used).
    // Parse to local midnight so it lines up with parseDate's local-time bounds.
    const raw = item.last_used_on;
    if (clause.op === 'none') return raw == null;
    const m = raw ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null;
    if (!m) return false;
    const t = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    const v = clause.value;
    if (clause.op === 'eq') return t >= v.lower && t <= v.upper;
    if (clause.op === 'gt') return t > v.upper;
    if (clause.op === 'gte') return t >= v.lower;
    if (clause.op === 'lt') return t < v.lower;
    if (clause.op === 'lte') return t <= v.upper;
    if (clause.op === 'range') {
      const { from, to } = v;
      if (from != null && t < from.lower) return false;
      if (to != null && t > to.upper) return false;
      return true;
    }
    return false;
  }

  if (clause.field === 'uses') {
    const n = item.usage_count ?? 0;
    if (clause.op === 'none') return n === 0;
    if (clause.op === 'eq') return n === clause.value;
    if (clause.op === 'gt') return n > clause.value;
    if (clause.op === 'gte') return n >= clause.value;
    if (clause.op === 'lt') return n < clause.value;
    if (clause.op === 'lte') return n <= clause.value;
    if (clause.op === 'range') {
      const { from, to } = clause.value;
      if (from != null && n < from) return false;
      if (to != null && n > to) return false;
      return true;
    }
    return false;
  }

  return false;
}

export function matchItem(item, ast) {
  if (!ast || ast.length === 0) return true;
  for (const group of ast) {
    let any = false;
    for (const clause of group) {
      const m = matchClause(item, clause);
      if (clause.negated ? !m : m) { any = true; break; }
    }
    if (!any) return false;
  }
  return true;
}
