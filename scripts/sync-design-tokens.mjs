#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatHex, formatRgb, parse } from 'culori';

const REM_PX = 16;

export class TokenSyncError extends Error {}

function withTokenContext(fileLabel, tokenName, fn) {
  try {
    return fn();
  } catch (err) {
    throw new TokenSyncError(`${fileLabel}: token "${tokenName}": ${err.message}`);
  }
}

// ---- dimension conversion ----

export function remToPx(value) {
  const match = /^(-?\d*\.?\d+)rem$/.exec(value.trim());
  if (!match) {
    throw new TokenSyncError(`cannot convert "${value}" to px: expected a plain rem value`);
  }
  return parseFloat(match[1]) * REM_PX;
}

const CALC_MULTIPLY = /^calc\(\s*(-?\d*\.?\d+)rem\s*\*\s*(-?\d*\.?\d+)\s*\)$/;

export function evalCalc(value) {
  const match = CALC_MULTIPLY.exec(value.trim());
  if (!match) {
    throw new TokenSyncError(
      `cannot evaluate calc expression "${value}": only "calc(<rem> * <number>)" is supported`,
    );
  }
  const [, rem, multiplier] = match;
  return parseFloat(rem) * REM_PX * parseFloat(multiplier);
}

export function convertDimension(value) {
  const trimmed = value.trim();
  if (trimmed === '0') return 0;
  if (trimmed.startsWith('calc(')) return evalCalc(trimmed);
  if (trimmed.endsWith('rem')) return remToPx(trimmed);
  throw new TokenSyncError(`cannot convert dimension "${value}": unrecognized format`);
}

// ---- color conversion ----

const HEX_COLOR = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function convertColor(value) {
  const trimmed = value.trim();
  if (HEX_COLOR.test(trimmed)) return trimmed;

  const parsed = parse(trimmed);
  if (!parsed) {
    throw new TokenSyncError(`cannot convert color "${value}": not a recognized color format`);
  }
  if (parsed.alpha !== undefined && parsed.alpha !== 1) {
    return formatRgb(parsed);
  }
  return formatHex(parsed);
}

// ---- naming ----

export function camelCase(kebab) {
  return kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function spacingKey(tokenName) {
  const match = /^spacing-(\d+)$/.exec(tokenName);
  if (!match) {
    throw new TokenSyncError(`unexpected spacing token name "${tokenName}"`);
  }
  return match[1];
}

export function radiusKey(tokenName) {
  if (tokenName === 'radius') return 'DEFAULT';
  const match = /^radius-([a-z]+)$/.exec(tokenName);
  if (!match) {
    throw new TokenSyncError(`unexpected radius token name "${tokenName}"`);
  }
  return camelCase(match[1]);
}

// ---- alias resolution ----

const ALIAS = /^\{(.+)\}$/;

export function resolveAliases(rawTokens, fileLabel) {
  const resolved = {};
  for (const [name, value] of Object.entries(rawTokens)) {
    const match = typeof value === 'string' ? ALIAS.exec(value) : null;
    if (!match) {
      resolved[name] = value;
      continue;
    }
    const target = match[1];
    if (!(target in rawTokens)) {
      throw new TokenSyncError(`${fileLabel}: token "${name}" references unknown alias "{${target}}"`);
    }
    const targetValue = rawTokens[target];
    if (typeof targetValue === 'string' && ALIAS.test(targetValue)) {
      throw new TokenSyncError(
        `${fileLabel}: token "${name}" aliases "${target}", which is itself an alias — chained aliases are not supported`,
      );
    }
    resolved[name] = targetValue;
  }
  return resolved;
}

// ---- building token groups ----

export function buildPalette(rawTokens, fileLabel) {
  const resolved = resolveAliases(rawTokens, fileLabel);
  const palette = {};
  for (const [name, value] of Object.entries(resolved)) {
    palette[camelCase(name)] = withTokenContext(fileLabel, name, () => convertColor(value));
  }
  return palette;
}

export function buildSpacing(rawTokens, fileLabel) {
  const spacing = {};
  for (const [name, value] of Object.entries(rawTokens)) {
    withTokenContext(fileLabel, name, () => {
      spacing[spacingKey(name)] = convertDimension(value);
    });
  }
  return spacing;
}

export function buildRadius(rawTokens, fileLabel) {
  const radius = {};
  for (const [name, value] of Object.entries(rawTokens)) {
    withTokenContext(fileLabel, name, () => {
      radius[radiusKey(name)] = convertDimension(value);
    });
  }
  return radius;
}

// ---- source reading ----

function readTokenFile(path) {
  let json;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new TokenSyncError(`cannot read token file ${path}: ${err.message}`);
  }
  const entries = {};
  for (const [key, value] of Object.entries(json)) {
    if (key.startsWith('$')) continue;
    entries[key] = value.$value;
  }
  return entries;
}

export function loadTokens(tokensDir) {
  if (!existsSync(tokensDir)) {
    throw new TokenSyncError(
      `hire design-system tokens not found at ${tokensDir} — expected 'hire' checked out as a sibling directory (e.g. ../hire relative to freehire-mobile).`,
    );
  }
  return {
    color: readTokenFile(join(tokensDir, 'color.tokens.json')),
    colorDark: readTokenFile(join(tokensDir, 'color-dark.tokens.json')),
    spacing: readTokenFile(join(tokensDir, 'spacing.tokens.json')),
    radius: readTokenFile(join(tokensDir, 'radius.tokens.json')),
  };
}

// ---- code generation ----

export function generateFileContent({ sourceLabel, paletteLight, paletteDark, spacing, radius }) {
  const lightKeys = Object.keys(paletteLight);
  const darkKeySet = new Set(Object.keys(paletteDark));
  const sameKeys = lightKeys.length === darkKeySet.size && lightKeys.every((k) => darkKeySet.has(k));
  if (!sameKeys) {
    throw new TokenSyncError(
      'color.tokens.json and color-dark.tokens.json define different token sets — cannot build a single GeneratedPalette type',
    );
  }

  const typeFields = lightKeys.map((key) => `  ${key}: string;`).join('\n');

  return `// AUTO-GENERATED by scripts/sync-design-tokens.mjs — do not edit by hand.
// Source: ${sourceLabel}

export type GeneratedPalette = {
${typeFields}
};

export const paletteLight: GeneratedPalette = ${JSON.stringify(paletteLight, null, 2)};

export const paletteDark: GeneratedPalette = ${JSON.stringify(paletteDark, null, 2)};

export const spacing: Record<string, number> = ${JSON.stringify(spacing, null, 2)};

export const radius: Record<string, number> = ${JSON.stringify(radius, null, 2)};
`;
}

// ---- pipeline ----

export function syncTokens(tokensDir, sourceLabel = tokensDir) {
  const { color, colorDark, spacing, radius } = loadTokens(tokensDir);
  return generateFileContent({
    sourceLabel,
    paletteLight: buildPalette(color, 'color.tokens.json'),
    paletteDark: buildPalette(colorDark, 'color-dark.tokens.json'),
    spacing: buildSpacing(spacing, 'spacing.tokens.json'),
    radius: buildRadius(radius, 'radius.tokens.json'),
  });
}

// ---- CLI entry point ----

function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const tokensDir = resolve(__dirname, '../../hire/design-system/tokens');
  const outputPath = resolve(__dirname, '../src/constants/tokens.generated.ts');

  try {
    const content = syncTokens(tokensDir, '../hire/design-system/tokens');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, 'utf8');
    console.log(`Wrote ${outputPath}`);
  } catch (err) {
    console.error(`sync-design-tokens failed: ${err.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
