import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const baseTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--surface)", color: "var(--text)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.55", overflow: "auto" },
  ".cm-content": { caretColor: "var(--accent)", padding: "10px 0 40vh" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "var(--selection) !important" },
  ".cm-gutters": { backgroundColor: "var(--surface)", color: "var(--text-3)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 14px", minWidth: "44px" },
  ".cm-activeLine": { backgroundColor: "var(--hover)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--text)" },
  ".cm-foldGutter .cm-gutterElement": { color: "var(--text-3)", padding: "0 4px" },
  ".cm-matchingBracket": { backgroundColor: "var(--accent-soft)", outline: "1px solid var(--border-strong)" },
  ".cm-selectionMatch": { backgroundColor: "var(--accent-soft)" },
  ".cm-searchMatch": { backgroundColor: "rgba(255, 196, 0, 0.35)", outline: "1px solid rgba(220, 160, 0, 0.6)" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgba(255, 140, 0, 0.5)" },
  ".cm-panels": { backgroundColor: "var(--chrome)", color: "var(--text)", borderColor: "var(--border)" },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
  ".cm-panel.cm-search": { padding: "8px 12px", fontFamily: "var(--font-ui)", fontSize: "13px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" },
  ".cm-panel.cm-search input.cm-textfield": { height: "28px", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface)", padding: "0 8px", fontSize: "13px", color: "var(--text)" },
  ".cm-panel.cm-search .cm-button": { height: "28px", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface)", backgroundImage: "none", color: "var(--text)", padding: "0 10px", fontSize: "12.5px" },
  ".cm-panel.cm-search label": { fontSize: "12.5px", color: "var(--text-2)", display: "inline-flex", alignItems: "center", gap: "4px" },
  ".cm-panel.cm-search [name=close]": { position: "absolute", right: "10px", top: "8px", fontSize: "18px", color: "var(--text-3)", background: "none", border: "0" },
  ".cm-tooltip": { backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "var(--shadow-pop)", color: "var(--text)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent-soft)", color: "var(--text)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: "4px", padding: "0 6px" },
  ".cm-gotoLine": { fontFamily: "var(--font-ui)" },
});

/** Writing mode for Markdown: proportional font, centred column, no gutters. */
export const proseTheme = EditorView.theme({
  ".cm-scroller": { fontFamily: "var(--font-doc)", lineHeight: "1.7" },
  ".cm-content": { maxWidth: "780px", margin: "0 auto", padding: "28px 40px 40vh", width: "100%" },
  ".cm-line": { padding: "0" },
  ".cm-activeLine": { backgroundColor: "transparent" },
});

export const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: "var(--syn-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "var(--syn-string)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syn-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "var(--syn-func)" },
  { tag: [t.typeName, t.className, t.namespace, t.tagName], color: "var(--syn-type)" },
  { tag: [t.propertyName, t.attributeName, t.labelName], color: "var(--syn-prop)" },
  { tag: [t.meta, t.annotation, t.processingInstruction, t.self], color: "var(--syn-meta)" },
  { tag: t.invalid, color: "var(--danger)" },
  // Markdown
  { tag: t.heading1, fontSize: "1.6em", fontWeight: "700", color: "var(--syn-heading)" },
  { tag: t.heading2, fontSize: "1.35em", fontWeight: "700", color: "var(--syn-heading)" },
  { tag: t.heading3, fontSize: "1.15em", fontWeight: "650", color: "var(--syn-heading)" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "650", color: "var(--syn-heading)" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--text-3)" },
  { tag: [t.link, t.url], color: "var(--syn-link)" },
  { tag: t.monospace, fontFamily: "var(--font-mono)", fontSize: "0.92em" },
  { tag: t.quote, color: "var(--text-2)" },
  { tag: [t.processingInstruction, t.contentSeparator], color: "var(--text-3)" },
]);
