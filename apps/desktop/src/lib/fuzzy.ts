/** Small fuzzy matcher for the command palette: subsequence match with bonuses for
 *  word starts and consecutive characters. Returns null when the query does not match. */

export interface Match {
  score: number;
  /** Indices of matched characters in the target, for highlighting. */
  positions: number[];
}

const isBoundary = (prev: string, cur: string) =>
  prev === "" || /[\s\-_./\\:()[\]]/.test(prev) || (prev === prev.toLowerCase() && cur !== cur.toLowerCase());

export function fuzzyMatch(query: string, target: string): Match | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, positions: [] };
  const t = target.toLowerCase();
  // Fast path: contiguous substring.
  const idx = t.indexOf(q);
  if (idx >= 0) {
    const boundary = isBoundary(target[idx - 1] ?? "", target[idx]);
    return { score: 1000 - idx + (boundary ? 200 : 0) + (idx === 0 ? 300 : 0) - target.length * 0.5, positions: [...Array(q.length)].map((_, i) => idx + i) };
  }
  const positions: number[] = [];
  let score = 0, ti = 0, prevMatch = -2;
  for (const qc of q) {
    if (qc === " ") continue;
    let found = -1;
    while (ti < t.length) {
      if (t[ti] === qc) {
        found = ti;
        break;
      }
      ti++;
    }
    if (found < 0) return null;
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
