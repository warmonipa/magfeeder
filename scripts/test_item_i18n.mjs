import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNames } from './sync_item_i18n.mjs';

test('covers every Mag, cell and food while preserving exact case identities', () => {
  const data = { mags: { Blade: {}, BLADE: {}, Dreamcast: {} },
    magCells: { 'Cell of Mag 213': {} }, itemOrder: ['Monomate'] };
  const before = structuredClone(data);
  assert.deepEqual(buildNames({ Blade: { zh: '突刺匕首' }, BLADE: { zh: '匕首' },
    DREAMCAST: { zh: 'DREAMCAST' }, 'Cell of MAG 213': { zh: '玛古细胞 213' },
    Monomate: { zh: '小HP回复液' } }, data),
  { BLADE: '匕首', Blade: '突刺匕首', Dreamcast: 'DREAMCAST',
    'Cell of Mag 213': '玛古细胞 213', Monomate: '小HP回复液' });
  assert.deepEqual(data, before);
});

test('missing, ambiguous and blank names cannot fall back to untranslated text', () => {
  const data = { mags: { blade: {} }, magCells: {}, itemOrder: [] };
  assert.throws(() => buildNames({}, data), /Missing or ambiguous/);
  assert.throws(() => buildNames({ Blade: { zh: '突刺匕首' }, BLADE: { zh: '匕首' } }, data), /ambiguous/);
  assert.throws(() => buildNames({ blade: { zh: ' ' }, Blade: { zh: '突刺匕首' } }, data), /Missing Chinese/);
});
