#!/usr/bin/env node
'use strict';

const {
  FACADE_CALC_VERSION,
  parseDimensionsFromText,
  parseFacadeAreaFromText,
  estimateFromHistory,
  buildCalcClientNarrative,
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
  {
    name: 'площадь 120 кв.м без проёмов',
    text: 'посчитай на 120 кв.м',
    areaOnly: true,
    expect: { S_gross: 120, S: 120, N: 194, areaInput: true },
  },
  {
    name: 'фасад 85 м2',
    text: 'фасад 85 м2, сколько панелей',
    areaOnly: true,
    expect: { S_gross: 85, S: 85, N: 138, areaInput: true },
  },
  {
    name: 'площадь + проёмы в кв.м',
    text: 'площадь фасада 120 м², проёмы 15 м²',
    areaOnly: true,
    expect: { S_gross: 120, S: 105, N: 170, areaInput: true },
  },
  {
    name: 'площадь + размеры проёмов',
    text: 'площадь 100, 2 двери 1×2, 3 окна 120 на 80',
    areaOnly: true,
    expect: { S_gross: 100, S: 93.12, N: 151, areaInput: true },
  },
];

console.log('facadeCalcVersion', FACADE_CALC_VERSION);
for (const c of cases) {
  if (c.areaOnly) {
    const area = parseFacadeAreaFromText(c.text);
    assert(area, `${c.name}: площадь не распознана`);
    assert(!parseDimensionsFromText(c.text), `${c.name}: не должны быть L×W×H`);
  } else {
    const dims = parseDimensionsFromText(c.text);
    assert(dims, `${c.name}: размеры не распознаны`);
  }
  const est = estimateFromHistory([{ role: 'user', content: c.text }]);
  assert(est, `${c.name}: нет estimate`);
  if (c.expect.areaInput) {
    assert(est.areaInput, `${c.name}: ожидался areaInput`);
    const text = buildCalcClientNarrative(est);
    assert(/без вычета проёмов|с вычетом проёмов/.test(text), `${c.name}: нет оговорки про проёмы`);
  }
  if (c.expect.S_gross != null) {
    assert(Math.abs(est.S_gross - c.expect.S_gross) < 0.01, `${c.name}: S_gross ${est.S_gross} != ${c.expect.S_gross}`);
  }
  if (c.expect.S != null) {
    assert(Math.abs(est.S - c.expect.S) < 0.02, `${c.name}: S ${est.S} != ${c.expect.S}`);
  }
  if (c.expect.N != null) {
    assert(est.N === c.expect.N, `${c.name}: N ${est.N} != ${c.expect.N}`);
  }
  if (c.expect.areaInput) {
    assert(est.areaInput === true, `${c.name}: areaInput`);
  }
  console.log('OK:', c.name);
}

console.log('All facade-calc tests passed.');
