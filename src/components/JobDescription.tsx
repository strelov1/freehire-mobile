import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { getColors, Space } from '@/constants/freehire';

/**
 * Renders a job's server-sanitized description HTML as native views — the mobile
 * counterpart of the web's JobDescription. The source HTML is a constrained,
 * pre-sanitized subset (p / div / h1–h4 / ul / ol / li / strong·b / em·i / a /
 * br), so a full DOM parser is overkill: a linear tokenizer walks the tags once
 * and builds a flat list of blocks, each carrying inline runs. Unknown tags are
 * ignored (their text still flows through), so a stray tag never blanks the body.
 */

type Run = { text: string; bold: boolean; italic: boolean; href?: string };
type Block =
  | { kind: 'p'; runs: Run[] }
  | { kind: 'h'; runs: Run[] }
  | { kind: 'li'; ordered: boolean; index: number; runs: Run[] };

// --- Entity decoding (the handful the sanitizer emits) -----------------------

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1] === 'x' || code[1] === 'X'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return NAMED[code] ?? NAMED[code.toLowerCase()] ?? whole;
  });
}

// --- Parser ------------------------------------------------------------------

const BLOCK_OPEN = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'li']);

/**
 * Walk the HTML tag-by-tag, tracking an inline-style stack (bold / italic /
 * link) and the current list context (ordered + running item number). Text that
 * lands between blocks (bare text, or inside an unknown wrapper) still gets
 * flushed as a paragraph, so nothing is dropped.
 */
function parseHtml(html: string): Block[] {
  const blocks: Block[] = [];
  let runs: Run[] = [];
  let bold = 0;
  let italic = 0;
  let href: string | undefined;
  // A stack of the current list kinds, so nested lists keep their own numbering.
  const listStack: { ordered: boolean; n: number }[] = [];
  // What the next block flush should become (a heading, a list item, or a plain
  // paragraph). Set when a block tag opens.
  let pending: { kind: 'p' | 'h' } | { kind: 'li'; ordered: boolean; index: number } = {
    kind: 'p',
  };

  const pushText = (raw: string) => {
    const text = decodeEntities(raw).replace(/\s+/g, ' ');
    if (!text) return;
    if (runs.length === 0 && text === ' ') return; // drop pure tag-whitespace
    runs.push({ text, bold: bold > 0, italic: italic > 0, href });
  };

  const flush = () => {
    while (runs.length && runs[runs.length - 1]?.text.trim() === '') runs.pop();
    if (runs.length === 0) return;
    if (pending.kind === 'li') {
      blocks.push({ kind: 'li', ordered: pending.ordered, index: pending.index, runs });
    } else {
      blocks.push({ kind: pending.kind, runs });
    }
    runs = [];
  };

  const tagRe = /<\/?([a-z0-9]+)([^>]*)>/gi;
  let last = 0;
  for (const m of html.matchAll(tagRe)) {
    const at = m.index ?? 0;
    if (at > last) pushText(html.slice(last, at)); // text before this tag
    last = at + m[0].length;

    const closing = m[0][1] === '/';
    const tag = (m[1] ?? '').toLowerCase();
    const attrs = m[2] ?? '';

    if (tag === 'br') {
      runs.push({ text: '\n', bold: false, italic: false, href });
      continue;
    }
    if (tag === 'strong' || tag === 'b') {
      bold = Math.max(0, bold + (closing ? -1 : 1));
      continue;
    }
    if (tag === 'em' || tag === 'i') {
      italic = Math.max(0, italic + (closing ? -1 : 1));
      continue;
    }
    if (tag === 'a') {
      if (closing) href = undefined;
      else {
        const hm = /href\s*=\s*["']([^"']*)["']/i.exec(attrs);
        href = hm ? decodeEntities(hm[1] ?? '') : undefined;
      }
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      if (closing) listStack.pop();
      else listStack.push({ ordered: tag === 'ol', n: 0 });
      continue;
    }

    if (BLOCK_OPEN.has(tag)) {
      flush(); // a block boundary closes the previous block
      if (closing) {
        pending = { kind: 'p' };
      } else if (tag === 'li') {
        const top = listStack[listStack.length - 1];
        pending = { kind: 'li', ordered: top?.ordered ?? false, index: top ? (top.n += 1) : 1 };
      } else if (tag[0] === 'h') {
        pending = { kind: 'h' };
      } else {
        pending = { kind: 'p' };
      }
    }
  }
  if (html.length > last) pushText(html.slice(last));
  flush();
  return blocks;
}

// --- Rendering ---------------------------------------------------------------

function InlineRuns({ runs, linkColor }: { runs: Run[]; linkColor: string }) {
  return (
    <>
      {runs.map((r, i) => {
        const style = [
          r.bold && styles.bold,
          r.italic && styles.italic,
          r.href && { color: linkColor, textDecorationLine: 'underline' as const },
        ];
        if (r.href) {
          const url = r.href;
          return (
            <Text key={i} style={style} onPress={() => WebBrowser.openBrowserAsync(url)}>
              {r.text}
            </Text>
          );
        }
        return (
          <Text key={i} style={style}>
            {r.text}
          </Text>
        );
      })}
    </>
  );
}

export function JobDescription({ html }: { html?: string | null }) {
  const c = getColors(useColorScheme());
  if (!html) return null;
  const blocks = parseHtml(html);
  if (blocks.length === 0) return null;

  return (
    <View style={styles.body}>
      {blocks.map((b, i) => {
        if (b.kind === 'h') {
          return (
            <Text key={i} style={[styles.heading, { color: c.foreground }]}>
              <InlineRuns runs={b.runs} linkColor={c.brandStrong} />
            </Text>
          );
        }
        if (b.kind === 'li') {
          const marker = b.ordered ? `${b.index}.` : '•';
          return (
            <View key={i} style={styles.li}>
              <Text style={[styles.marker, { color: c.mutedForeground }]}>{marker}</Text>
              <Text style={[styles.paragraph, styles.liText, { color: c.mutedForeground }]}>
                <InlineRuns runs={b.runs} linkColor={c.brandStrong} />
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[styles.paragraph, { color: c.mutedForeground }]}>
            <InlineRuns runs={b.runs} linkColor={c.brandStrong} />
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Space.sm,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 21,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: Space.sm,
  },
  li: {
    flexDirection: 'row',
    gap: Space.sm,
    paddingLeft: Space.xs,
  },
  marker: {
    fontSize: 14,
    lineHeight: 21,
    width: 16,
  },
  liText: {
    flex: 1,
  },
  bold: {
    fontWeight: '600',
  },
  italic: {
    fontStyle: 'italic',
  },
});
