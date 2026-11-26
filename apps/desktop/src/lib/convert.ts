/** Conversion registry with route-finding (docs/plans/10-universal-export.md).
 *  Converters are edges between formats; the best route is the one with the best
 *  worst-step quality, then the fewest steps. */

export type Quality = "exact" | "good" | "text";

export const QUALITY_LABEL: Record<Quality, string> = {
  exact: "Exact",
  good: "Good",
  text: "Text only",
};

const QUALITY_RANK: Record<Quality, number> = { exact: 3, good: 2, text: 1 };

/** What the open document knows that its bytes do not, such as a table's header-row choice. */
export interface ExportHints {
  header?: boolean;
}

export interface ConvertInput {
  bytes: Uint8Array;
  name: string;
  /** Hints describe the source document, so only the first step of a route receives them. */
  hints?: ExportHints;
}

export interface ConvertOutput {
  /** One or more output files (for example one image per PDF page). */
  files: { suffix: string; bytes: Uint8Array }[];
}

export interface Converter {
  id: string;
  from: string;
  to: string;
  quality: Quality;
  /** What is lost, in plain words, shown before converting when quality is not exact. A function
   *  decides from the source document's text, so a note appears only when it applies (for example
   *  "images are left out" only for a document that has images). */
  loses?: string | ((sourceText: string) => string | null);
  run(input: ConvertInput): Promise<ConvertOutput>;
}

export interface Route {
  to: string;
  steps: Converter[];
  quality: Quality;
}

export class ConversionRegistry {
  private converters: Converter[] = [];

  register(c: Converter) {
    this.converters.push(c);
  }

  /** Every reachable target format from `from`, with its best route. */
  routes(from: string, maxSteps = 3): Route[] {
    const best = new Map<string, Route>();
    const better = (a: Route, b?: Route) =>
      !b || QUALITY_RANK[a.quality] > QUALITY_RANK[b.quality] || (a.quality === b.quality && a.steps.length < b.steps.length);
    let frontier: Route[] = [{ to: from, steps: [], quality: "exact" }];
    for (let depth = 0; depth < maxSteps; depth++) {
      const next: Route[] = [];
      for (const r of frontier) {
        for (const c of this.converters.filter((c) => c.from === r.to)) {
          if (c.to === from || r.steps.some((s) => s.from === c.to)) continue;
          const quality = QUALITY_RANK[c.quality] < QUALITY_RANK[r.quality] ? c.quality : r.quality;
          // Multi-step outputs only make sense when every intermediate step yields one file.
          const route: Route = { to: c.to, steps: [...r.steps, c], quality };
          if (better(route, best.get(c.to))) {
            best.set(c.to, route);
            next.push(route);
          }
        }
      }
      frontier = next;
    }
    return [...best.values()].sort((a, b) => QUALITY_RANK[b.quality] - QUALITY_RANK[a.quality] || a.to.localeCompare(b.to));
  }

  async run(route: Route, input: ConvertInput): Promise<ConvertOutput> {
    let current: ConvertOutput = { files: [{ suffix: "", bytes: input.bytes }] };
    for (const [i, step] of route.steps.entries()) {
      if (current.files.length !== 1) throw new Error("This route produces several files part-way and cannot continue.");
      current = await step.run({ bytes: current.files[0].bytes, name: input.name, hints: i === 0 ? input.hints : undefined });
    }
    return current;
  }

  lossNote(route: Route, sourceText: () => string = () => ""): string | null {
    // The first lossy step decides what survives; later notes would only repeat or contradict it.
    for (const s of route.steps) {
      const note = typeof s.loses === "function" ? s.loses(sourceText()) : s.loses;
      if (note) return note;
    }
    return null;
  }

}
