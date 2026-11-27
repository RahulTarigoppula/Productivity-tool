/** Small fuzzy matcher for the command palette: subsequence match with bonuses for
 *  word starts and consecutive characters. Returns null when the query does not match. */

export interface Match {
  score: number;
  /** Indices of matched characters in the target, for highlighting. */
  positions: number[];
}

const SEPARATORS = new Set([..." \t\n-_./\\:()[]"]);
/** A word start: after a separator, or an upper-case letter after a lower-case one ("camelCase"). */
const isBoundary = (prev: string, cur = "") =>
  prev === "" || SEPARATORS.has(prev) || (cur !== cur.toLowerCase() && prev === prev.toLowerCase() && prev !== prev.toUpperCase());

/** Lower case with the same length, so positions found in it are positions in the original
 *  ("İ" lower-cases to two units; such characters are kept as they are). */
export function lowerSameLength(s: string): string {
  const l = s.toLowerCase();
  if (l.length === s.length) return l;
  let out = "";
  for (const ch of s) {
    const c = ch.toLowerCase();
    out += c.length === ch.length ? c : ch;
  }
  return out;
}

export function fuzzyMatch(query: string, target: string): Match | null {
  const q = lowerSameLength(query.trim());
  if (!q) return { score: 0, positions: [] };
  const t = lowerSameLength(target);
  // Fast path: contiguous substring.
  const idx = t.indexOf(q);
  if (idx >= 0) {
    const boundary = isBoundary(target[idx - 1] ?? "", target[idx]);
    return { score: 1000 - idx + (boundary ? 200 : 0) + (idx === 0 ? 300 : 0) - target.length * 0.5, positions: [...Array(q.length)].map((_, i) => idx + i) };
  }
  // Most targets do not contain the letters in order: find that out with the native search first.
  let at = -1;
  for (const qc of q) if (qc !== " " && (at = t.indexOf(qc, at + 1)) < 0) return null;
  const positions: number[] = [];
  let score = 0, ti = 0, prevMatch = -2;
  for (const qc of q) {
    if (qc === " ") continue;
    const found = t.indexOf(qc, ti);
    positions.push(found);
    score += 10;
    if (found === prevMatch + 1) score += 15;
    if (isBoundary(target[found - 1] ?? "", target[found])) score += 25;
    prevMatch = found;
    ti = found + 1;
  }
  score -= (positions[positions.length - 1] - positions[0]) * 0.5;
  score -= target.length * 0.3;
  return { score, positions };
}

export function rank<T>(items: T[], query: string, text: (t: T) => string, boost?: (t: T) => number, limit = 50): { item: T; match: Match }[] {
  const out: { item: T; match: Match }[] = [];
  for (const item of items) {
    const m = fuzzyMatch(query, text(item));
    if (m) out.push({ item, match: { ...m, score: m.score + (boost?.(item) ?? 0) } });
  }
  out.sort((a, b) => b.match.score - a.match.score);
  return out.slice(0, limit);
}
