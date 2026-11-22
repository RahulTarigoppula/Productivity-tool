/** Choose a language for any text file: by file name, then by shebang line. */
import { LanguageDescription, type LanguageSupport } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

const SHEBANG: Record<string, string> = {
  python: "Python", python3: "Python", node: "JavaScript", deno: "TypeScript", bash: "Shell", sh: "Shell", zsh: "Shell",
  ruby: "Ruby", perl: "Perl", php: "PHP", lua: "Lua", pwsh: "PowerShell", Rscript: "R",
};

const EXTRA_NAMES: Record<string, string> = {
  ".gitignore": "Properties files", ".env": "Properties files", ".editorconfig": "Properties files", Dockerfile: "Dockerfile", Makefile: "CMake",
};

export function detectLanguage(name: string, firstLine: string): LanguageDescription | null {
  const base = name.split(/[\\/]/).pop() ?? name;
  if (EXTRA_NAMES[base]) return LanguageDescription.matchLanguageName(languages, EXTRA_NAMES[base], true);
  const byName = LanguageDescription.matchFilename(languages, base);
  if (byName) return byName;
  const m = /^#!\s*(?:\/usr\/bin\/env\s+)?\S*?([A-Za-z0-9]+)(?:\s|$)/.exec(firstLine);
  if (m && SHEBANG[m[1]]) return LanguageDescription.matchLanguageName(languages, SHEBANG[m[1]], true);
  if (/^\s*<\?xml/.test(firstLine)) return LanguageDescription.matchLanguageName(languages, "XML", true);
  if (/^\s*[[{]/.test(firstLine) && /\.json\w*$/i.test(base)) return LanguageDescription.matchLanguageName(languages, "JSON", true);
  return null;
}

export async function loadLanguage(desc: LanguageDescription | null): Promise<LanguageSupport | null> {
  if (!desc) return null;
  try {
    return await desc.load();
  } catch {
    return null;
  }
}

export const ALL_LANGUAGES = languages;

/** Indentation used by the file: tabs, or the most common space step. */
export function detectIndent(text: string, fallback: number): { unit: string; size: number } {
  let tabs = 0, spaces = 0;
  const steps = new Map<number, number>();
  let prev = 0;
  const lines = text.split("\n", 2000);
  for (const l of lines) {
    if (!l.trim()) continue;
    if (l[0] === "\t") tabs++;
    else if (l[0] === " ") {
      spaces++;
      const n = l.length - l.trimStart().length;
      const d = Math.abs(n - prev);
      if (d > 0 && d <= 8) steps.set(d, (steps.get(d) ?? 0) + 1);
      prev = n;
      continue;
    }
    prev = 0;
  }
  if (tabs > spaces) return { unit: "\t", size: fallback };
  if (!spaces) return { unit: " ".repeat(fallback), size: fallback };
  const best = [...steps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
  return { unit: " ".repeat(best), size: best };
}
