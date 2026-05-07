import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPhone,
  hasActionableReportLocation,
  isValidPhone,
  normalizeIndonesianPhone,
  normalizeManualAddress,
  normalizeReportDescription,
  normalizeReporterName,
} from '../src/lib/utils.js';

test('normalizes Indonesian phone numbers to +62 format', () => {
  assert.equal(normalizeIndonesianPhone('08123456789'), '+628123456789');
  assert.equal(normalizeIndonesianPhone('628123456789'), '+628123456789');
  assert.equal(normalizeIndonesianPhone('+62 812-3456-789'), '+628123456789');
  assert.equal(normalizeIndonesianPhone('00628123456789'), '+628123456789');
});

test('rejects non-phone and non-Indonesian phone values', () => {
  assert.equal(normalizeIndonesianPhone('abcdefghij'), null);
  assert.equal(normalizeIndonesianPhone('0812abc6789'), null);
  assert.equal(normalizeIndonesianPhone('+12025550123'), null);
  assert.equal(normalizeIndonesianPhone('0215551234'), null);
  assert.equal(normalizeIndonesianPhone('08123'), null);
});

test('validates and displays normalized phone values', () => {
  assert.equal(isValidPhone('08123456789'), true);
  assert.equal(isValidPhone('nomor saya'), false);
  assert.equal(formatPhone('+628123456789'), '08123456789');
});

test('accepts actionable report locations from GPS or manual address', () => {
  assert.equal(hasActionableReportLocation({ latitude: -7.8, longitude: 110.4, address: '' }), true);
  assert.equal(hasActionableReportLocation({ address: 'Depan pasar Kotabaru' }), true);
});

test('rejects missing or vague report locations', () => {
  assert.equal(hasActionableReportLocation({ latitude: null, longitude: null, address: '' }), false);
  assert.equal(hasActionableReportLocation({ latitude: -7.8, longitude: null, address: '' }), false);
  assert.equal(hasActionableReportLocation({ address: 'pasar' }), false);
  assert.equal(hasActionableReportLocation({ address: '1234567890' }), false);
});

test('normalizes clear manual addresses', () => {
  assert.equal(normalizeManualAddress('  Depan   pasar Kotabaru  '), 'Depan pasar Kotabaru');
  assert.equal(normalizeManualAddress('Jl. Malioboro depan toko batik'), 'Jl. Malioboro depan toko batik');
});

test('rejects vague manual addresses', () => {
  assert.equal(normalizeManualAddress('pasar'), null);
  assert.equal(normalizeManualAddress('1234567890'), null);
  assert.equal(normalizeManualAddress('!!!!!!!!!!'), null);
});

test('normalizes plausible reporter names', () => {
  assert.equal(normalizeReporterName('  Bu   Sari  '), 'Bu Sari');
  assert.equal(normalizeReporterName('M. Hanafi'), 'M. Hanafi');
  assert.equal(normalizeReporterName("Nur Aisyah"), 'Nur Aisyah');
});

test('rejects reporter names without letters or with unsupported symbols', () => {
  assert.equal(normalizeReporterName('1'), null);
  assert.equal(normalizeReporterName('12345'), null);
  assert.equal(normalizeReporterName('!!!!'), null);
  assert.equal(normalizeReporterName('Budi @ rumah'), null);
});

test('normalizes useful report descriptions', () => {
  assert.equal(
    normalizeReportDescription('  Sampah menumpuk di dekat pasar sejak kemarin.  '),
    'Sampah menumpuk di dekat pasar sejak kemarin.',
  );
});

test('rejects short or non-descriptive report descriptions', () => {
  assert.equal(normalizeReportDescription('sampah'), null);
  assert.equal(normalizeReportDescription('12345678901234567890'), null);
  assert.equal(normalizeReportDescription('!!!!!!!!! !!!!!!!!!!'), null);
});
