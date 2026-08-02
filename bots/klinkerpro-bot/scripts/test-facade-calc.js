#!/usr/bin/env node
'use strict';

const {
  FACADE_CALC_VERSION,
  parseDimensionsFromText,
  parseOpeningsFromText,
  estimateFromHistory,
} = require('../src/facade-calc');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const cases = [
  {
    name: '3×4×5 с проёмами (контроль)',
    text: 'сделай расчет дома 3 на 4 на 5, двое дверей полтора на два метра, 3 окна 120 на 80',
    expect: { S_gross: 70, S: 61.12, N: 99 },
  },
  {
    name: '8×4×3 «8 на 4 и 3 метра»',
    text: 'Расчитай 8 на 4 и 3 метра, 6 окон метр на 80 см, 2 двери 2м на 80 см',
    expect: { S_gross: 72, S: 64, N: 104 },
  },
  {
    name: '9×11×3 (контроль площади)',
    text: 'дом 9-11 высота 3 м',
    expect: { S_gross: 120 },
  },
];

console.log('facadeCalcVersion', FACADE_CALC_VERSION);
for (const c of cases) {
  const dims = parseDimensionsFromText(c.text);
  assert(dims, `${c.name}: размеры не распознаны`);
  const est = estimateFromHistory([{ role: 'user', content: c.text }]);
  assert(est, `${c.name}: нет estimate`);
  if (c.expect.S_gross != null) {
    assert(Math.abs(est.S_gross - c.expect.S_gross) < 0.01, `${c.name}: S_gross ${est.S_gross} != ${c.expect.S_gross}`);
  }
  if (c.expect.S != null) {
    assert(Math.abs(est.S - c.expect.S) < 0.02, `${c.name}: S ${est.S} != ${c.expect.S}`);
  }
  if (c.expect.N != null) {
    assert(est.N === c.expect.N, `${c.name}: N ${est.N} != ${c.expect.N}`);
  }
  console.log('OK:', c.name);
}

console.log('All facade-calc tests passed.');
