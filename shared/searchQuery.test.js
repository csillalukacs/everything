import { parseQuery, matchItem } from './searchQuery.js';

const items = [
  { id: 1, name: 'old camera',    description: 'vintage',   ocr_text: '',      tags: [{ name: 'electronics' }, { name: 'vintage' }],     acquired_year: 2019, acquired_location: 'Berlin, DE',    created_at: '2025-06-15T10:00:00Z', last_used_on: '2026-06-10', usage_count: 5 },
  { id: 2, name: 'tea kettle',    description: 'ceramic',   ocr_text: '',      tags: [{ name: 'kitchen' }, { name: 'tea and coffee' }],  acquired_year: 2024, acquired_location: 'Paris, FR',     created_at: '2026-01-10T10:00:00Z', last_used_on: '2026-06-13', usage_count: 1 },
  { id: 3, name: 'notebook',      description: 'leather',   ocr_text: 'ideas', tags: [{ name: 'stationery' }],                            acquired_year: null, acquired_location: null,            created_at: '2026-04-20T10:00:00Z', last_used_on: '2025-12-25', usage_count: 12 },
  { id: 4, name: 'fiction novel', description: 'paperback', ocr_text: '',      tags: [{ name: 'books' }, { name: 'fiction' }],            acquired_year: 2022, acquired_location: 'New York, US',  created_at: '2025-12-01T10:00:00Z', last_used_on: null,         usage_count: 0 },
  { id: 5, name: 'history book',  description: 'hardcover', ocr_text: '',      tags: [{ name: 'books' }],                                 acquired_year: 2024, acquired_location: 'Berlin, DE',    created_at: '2026-03-05T10:00:00Z', last_used_on: '2026-06-01', usage_count: 3 },
  { id: 6, name: '',              description: '',          ocr_text: '',      tags: [],                                                  acquired_year: null, acquired_location: null,            created_at: '2026-05-01T10:00:00Z', last_used_on: null,         usage_count: 0 },
];

const cases = [
  ['camera',                                      [1]],
  ['tag:books',                                   [4, 5]],
  ['tag:books -tag:fiction',                      [5]],
  ['tag:"tea and coffee"',                        [2]],
  ['tag:books OR tag:kitchen',                    [2, 4, 5]],
  ['acquired:2024',                               [2, 5]],
  ['acquired:>2020',                              [2, 4, 5]],
  ['acquired:2020..2024',                         [2, 4, 5]],
  ['acquired:none',                               [3, 6]],
  ['year:2024',                                   [2, 5]],
  ['added:>2026-01-01',                           [2, 3, 5, 6]],
  ['added:2026',                                  [2, 3, 5, 6]],
  ['added:2025..2026-01',                         [1, 2, 4]],
  ['city:Berlin',                                 [1, 5]],
  ['city:"new york"',                             [4]],
  ['city:none',                                   [3, 6]],
  ['tag:books -fiction',                          [5]],
  ['tag:books OR tag:kitchen acquired:2024',      [2, 5]],
  ['"old camera"',                                [1]],
  ['',                                            [1, 2, 3, 4, 5, 6]],
  ['nonsense:foo',                                []],
  ['ideas',                                       [3]],
  ['name:book',                                   [3, 5]],
  ['desc:hardcover',                              [5]],
  ['ocr:ideas',                                   [3]],
  ['-tag:books',                                  [1, 2, 3, 6]],
  ['name:none',                                   [6]],
  ['desc:none',                                   [6]],
  ['ocr:none',                                    [1, 2, 4, 5, 6]],
  ['tag:vintage tag:electronics',                 [1]],
  ['acquired:<2023 OR acquired:>2024',            [1, 4]],
  ['used:none',                                   [4, 6]],
  ['used:2026',                                   [1, 2, 5]],
  ['used:>2026-06-01',                            [1, 2]],
  ['used:2025..2026-05',                          [3]],
  ['lastused:none',                               [4, 6]],
  ['uses:none',                                   [4, 6]],
  ['uses:0',                                      [4, 6]],
  ['uses:>3',                                     [1, 3]],
  ['uses:1..3',                                   [2, 5]],
];

let failed = 0;
for (const [q, expected] of cases) {
  const ast = parseQuery(q);
  const matched = items.filter(i => matchItem(i, ast)).map(i => i.id);
  const ok = JSON.stringify(matched) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(ok ? 'ok  ' : 'FAIL', JSON.stringify(q).padEnd(48), '→', JSON.stringify(matched), 'expected', JSON.stringify(expected));
}
console.log(failed === 0 ? `\n${cases.length} passed` : `\n${failed} of ${cases.length} failed`);
process.exit(failed === 0 ? 0 : 1);
