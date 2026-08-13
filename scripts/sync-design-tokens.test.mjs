import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseCulori, formatHex as culoriFormatHex } from 'culori';

import {
  TokenSyncError,
  remToPx,
  evalCalc,
  convertDimension,
  convertColor,
  camelCase,
  spacingKey,
  radiusKey,
  resolveAliases,
  buildPalette,
  buildSpacing,
  buildRadius,
  loadTokens,
  syncTokens,
  generateFileContent,
} from './sync-design-tokens.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '__fixtures__');

// ---- rem -> px ----

test('remToPx converts a plain rem value to px at a 16px base', () => {
  assert.equal(remToPx('1rem'), 16);
  assert.equal(remToPx('0.625rem'), 10);
});

test('remToPx throws on a non-rem value', () => {
  assert.throws(() => remToPx('16px'), TokenSyncError);
});

// ---- calc() evaluator ----

test('evalCalc evaluates calc(<rem> * <number>)', () => {
  assert.equal(evalCalc('calc(0.625rem * 0.6)'), 6);
  assert.equal(evalCalc('calc(0.625rem * 1.4)'), 14);
});

test('evalCalc throws on an unsupported calc shape', () => {
  assert.throws(() => evalCalc('calc(1rem + 1rem)'), TokenSyncError);
});

// ---- dimension conversion ----

test('convertDimension handles "0", rem, and calc forms', () => {
  assert.equal(convertDimension('0'), 0);
  assert.equal(convertDimension('1rem'), 16);
  assert.equal(convertDimension('calc(0.625rem * 0.6)'), 6);
});

test('convertDimension throws on an unrecognized dimension format', () => {
  assert.throws(() => convertDimension('10px'), TokenSyncError);
});

// ---- color conversion ----

test('convertColor passes plain hex colors through unchanged', () => {
  assert.equal(convertColor('#111111'), '#111111');
});

test('convertColor converts an opaque oklch color to hex', () => {
  const expected = culoriFormatHex(parseCulori('oklch(0.997 0.003 130)'));
  assert.equal(convertColor('oklch(0.997 0.003 130)'), expected);
});

test('convertColor converts an oklch color with alpha to rgba', () => {
  const result = convertColor('oklch(1 0 0 / 8%)');
  assert.match(result, /^rgba\(/);
});

test('convertColor throws on an unrecognized color format', () => {
  assert.throws(() => convertColor('not-a-color'), TokenSyncError);
});

// ---- naming ----

test('camelCase converts kebab-case to camelCase', () => {
  assert.equal(camelCase('card-foreground'), 'cardForeground');
  assert.equal(camelCase('background'), 'background');
});

test('spacingKey strips the spacing- prefix', () => {
  assert.equal(spacingKey('spacing-4'), '4');
  assert.equal(spacingKey('spacing-0'), '0');
});

test('spacingKey throws on an unexpected token name', () => {
  assert.throws(() => spacingKey('gap-4'), TokenSyncError);
});

test('radiusKey maps the bare radius token to DEFAULT and strips the prefix otherwise', () => {
  assert.equal(radiusKey('radius'), 'DEFAULT');
  assert.equal(radiusKey('radius-sm'), 'sm');
  assert.equal(radiusKey('radius-xl'), 'xl');
});

test('radiusKey throws on an unexpected token name', () => {
  assert.throws(() => radiusKey('corner-sm'), TokenSyncError);
});

// ---- alias resolution ----

test('resolveAliases substitutes an alias with the referenced token value', () => {
  const raw = { ring: '{brand-ring}', 'brand-ring': 'oklch(0.7 0.1 120)' };
  const resolved = resolveAliases(raw, 'fixture.tokens.json');
  assert.equal(resolved.ring, 'oklch(0.7 0.1 120)');
  assert.equal(resolved['brand-ring'], 'oklch(0.7 0.1 120)');
});

test('resolveAliases throws on a reference to an unknown token', () => {
  const raw = { ring: '{does-not-exist}' };
  assert.throws(() => resolveAliases(raw, 'fixture.tokens.json'), TokenSyncError);
});

test('resolveAliases rejects a chained alias rather than resolving it multi-hop', () => {
  const raw = { a: '{b}', b: '{c}', c: 'oklch(0.5 0.1 100)' };
  assert.throws(
    () => resolveAliases(raw, 'fixture.tokens.json'),
    (err) => err instanceof TokenSyncError && /chained/.test(err.message),
  );
});

// ---- buildPalette / buildSpacing / buildRadius over fixtures ----

function readFixture(name) {
  const json = JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
  const entries = {};
  for (const [key, value] of Object.entries(json)) {
    if (key.startsWith('$')) continue;
    entries[key] = value.$value;
  }
  return entries;
}

test('buildPalette camelCases keys, converts colors, and resolves aliases', () => {
  const raw = readFixture('color.tokens.json');
  const palette = buildPalette(raw, 'color.tokens.json');

  assert.equal(palette.foreground, '#111111');
  assert.equal(palette.ring, palette.brandRing);
  assert.match(palette.background, /^#[0-9a-f]{6}$/);
});

test('buildSpacing produces numeric px values keyed by the spacing scale number', () => {
  const raw = readFixture('spacing.tokens.json');
  const spacing = buildSpacing(raw, 'spacing.tokens.json');

  assert.equal(spacing['0'], 0);
  assert.equal(spacing['4'], 16);
});

test('buildRadius produces numeric px values with DEFAULT for the bare radius token', () => {
  const raw = readFixture('radius.tokens.json');
  const radius = buildRadius(raw, 'radius.tokens.json');

  assert.equal(radius.DEFAULT, 10);
  assert.equal(radius.sm, 6);
});

test('buildPalette error messages name the offending token and file', () => {
  const raw = { foo: 'not-a-color' };
  assert.throws(
    () => buildPalette(raw, 'color.tokens.json'),
    (err) => err instanceof TokenSyncError && /foo/.test(err.message) && /color\.tokens\.json/.test(err.message),
  );
});

test('buildPalette wraps a non-TokenSyncError failure (e.g. a missing $value) with file and token context', () => {
  const raw = { foo: undefined };
  assert.throws(
    () => buildPalette(raw, 'color.tokens.json'),
    (err) => err instanceof TokenSyncError && /foo/.test(err.message) && /color\.tokens\.json/.test(err.message),
  );
});

test('buildSpacing error messages name the offending token and file', () => {
  const raw = { 'spacing-4': '10px' };
  assert.throws(
    () => buildSpacing(raw, 'spacing.tokens.json'),
    (err) => err instanceof TokenSyncError && /spacing-4/.test(err.message) && /spacing\.tokens\.json/.test(err.message),
  );
});

test('buildRadius error messages name the offending token and file', () => {
  const raw = { 'radius-sm': '10px' };
  assert.throws(
    () => buildRadius(raw, 'radius.tokens.json'),
    (err) => err instanceof TokenSyncError && /radius-sm/.test(err.message) && /radius\.tokens\.json/.test(err.message),
  );
});

// ---- source reading ----

test('loadTokens throws a clear error when the tokens directory is missing', () => {
  assert.throws(
    () => loadTokens('/definitely/does/not/exist/tokens'),
    (err) => err instanceof TokenSyncError && /sibling directory/.test(err.message),
  );
});

test('loadTokens reads all four token files from a valid directory', () => {
  const { color, colorDark, spacing, radius } = loadTokens(fixturesDir);
  assert.ok(color.background);
  assert.ok(colorDark.background);
  assert.ok(spacing['spacing-4']);
  assert.ok(radius.radius);
});

test('loadTokens throws a clear error naming the file when a token file has malformed JSON', () => {
  const dir = join(__dirname, '__fixtures__', 'malformed-json');
  assert.throws(
    () => loadTokens(dir),
    (err) => err instanceof TokenSyncError && /color\.tokens\.json/.test(err.message),
  );
});

// ---- end-to-end generation ----

test('syncTokens generates a TS file with header, palettes, spacing, and radius from fixtures', () => {
  const content = syncTokens(fixturesDir);

  assert.match(content, /^\/\/ AUTO-GENERATED by scripts\/sync-design-tokens\.mjs/);
  assert.match(content, /do not edit by hand/);
  assert.match(content, /export type GeneratedPalette/);
  assert.match(content, /export const paletteLight: GeneratedPalette/);
  assert.match(content, /export const paletteDark: GeneratedPalette/);
  assert.match(content, /export const spacing: Record<string, number>/);
  assert.match(content, /export const radius: Record<string, number>/);

  // Alias resolution should land the same converted color at both keys.
  const brandRingMatch = content.match(/"brandRing":\s*"([^"]+)"/);
  const ringMatch = content.match(/"ring":\s*"([^"]+)"/);
  assert.ok(brandRingMatch && ringMatch);
  assert.equal(ringMatch[1], brandRingMatch[1]);

  // Spot-check a spacing and a radius value.
  assert.match(content, /"4":\s*16/);
  assert.match(content, /"sm":\s*6/);
});

test('generateFileContent accepts light/dark palettes with the same keys in a different order', () => {
  const paletteLight = { background: '#111111', foreground: '#222222' };
  const paletteDark = { foreground: '#eeeeee', background: '#dddddd' };
  assert.doesNotThrow(() =>
    generateFileContent({ sourceLabel: 'test', paletteLight, paletteDark, spacing: {}, radius: {} }),
  );
});

test('generateFileContent still rejects palettes with genuinely different key sets', () => {
  const paletteLight = { background: '#111111' };
  const paletteDark = { background: '#dddddd', foreground: '#eeeeee' };
  assert.throws(() =>
    generateFileContent({ sourceLabel: 'test', paletteLight, paletteDark, spacing: {}, radius: {} }),
  );
});

test('convertColor rejects a malformed hex color instead of passing it through', () => {
  assert.throws(() => convertColor('#12345'), TokenSyncError);
});

test('syncTokens uses a stable source label when given one, instead of the resolved read path', () => {
  const content = syncTokens(fixturesDir, '../hire/design-system/tokens');
  assert.match(content, /\/\/ Source: \.\.\/hire\/design-system\/tokens/);
  assert.doesNotMatch(content, new RegExp(fixturesDir.replace(/[/\\]/g, '\\$&')));
});

test('syncTokens throws naming the offending token and file when a token value is unsupported', () => {
  const invalidDir = join(__dirname, '__fixtures__', 'invalid');
  assert.throws(
    () => syncTokens(invalidDir),
    (err) => err instanceof TokenSyncError && /bogus/.test(err.message) && /color\.tokens\.json/.test(err.message),
  );
});
