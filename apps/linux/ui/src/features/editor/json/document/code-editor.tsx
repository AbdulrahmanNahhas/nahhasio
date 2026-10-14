import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

const editorSetup = {
  foldGutter: true,
  searchKeymap: true,
  bracketMatching: true,
  closeBrackets: true,
  highlightSelectionMatches: false,
  autocompletion: false,
};
const noSuggestions: readonly string[] = [];
const noValueOptions: Readonly<Record<string, readonly string[]>> = {};

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  suggestions?: readonly string[];
  valueOptions?: Readonly<Record<string, readonly string[]>>;
  height?: string;
  liveValidation?: boolean;
}
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  suggestions = noSuggestions,
  valueOptions = noValueOptions,
  height = "420px",
  liveValidation = true,
}: CodeEditorProps) {
  const change = useRef(onChange);
  useLayoutEffect(() => {
    change.current = onChange;
  }, [onChange]);
  // The wrapper reconfigures the entire editor when this callback identity changes.
  const handleChange = useCallback((text: string) => change.current(text), []);
  const setup = useMemo(
    () => ({
      ...editorSetup,
      autocompletion: suggestions.length > 0 || Object.keys(valueOptions).length > 0,
    }),
    [suggestions, valueOptions],
  );
  const extensions = useMemo(
    () => [
      EditorView.cspNonce.of(
        document.querySelector<HTMLMetaElement>('meta[name="nahhasio-style-nonce"]')?.content ?? "",
      ),
      json(),
      jsonLanguage.data.of({
        autocomplete: (context: {
          matchBefore: (pattern: RegExp) => { from: number; text: string } | null;
          explicit: boolean;
          pos: number;
          state: { sliceDoc: (from: number, to: number) => string; doc: { length: number } };
        }) => {
          const prefix = context.state.sliceDoc(Math.max(0, context.pos - 500), context.pos);
          const valueMatch = prefix.match(/"([^"\\]+)"\s*:\s*"([^"\\]*)$/);
          if (valueMatch && valueOptions[valueMatch[1]])
            return {
              from: context.pos - valueMatch[2].length,
              to:
                context.pos +
                (context.state
                  .sliceDoc(context.pos, context.pos + 500)
                  .match(/^(?:\\.|[^"\\])*/)?.[0].length ?? 0),
              options: valueOptions[valueMatch[1]].map((label) => ({
                label,
                type: "text",
                apply: JSON.stringify(label).slice(1, -1),
              })),
            };
          const word = context.matchBefore(/"[A-Za-z][A-Za-z0-9]*|[A-Za-z][A-Za-z0-9]*/);
          if (!word || (!context.explicit && word.text.length < 2)) return null;
          return {
            from: word.from + (word.text.startsWith('"') ? 1 : 0),
            options: suggestions.map((label) => ({ label, type: "property" })),
          };
        },
      }),
      ...(liveValidation ? [linter(jsonParseLinter(), { delay: 1200 }), lintGutter()] : []),
      EditorView.contentAttributes.of({ "aria-label": "محرر مسودة JSON" }),
    ],
    [suggestions, liveValidation, valueOptions],
  );
  return (
    <div dir="ltr" className="overflow-hidden rounded-lg border border-border">
      <CodeMirror
        value={value}
        editable={!readOnly}
        onChange={handleChange}
        extensions={extensions}
        height={height}
        theme="dark"
        basicSetup={setup}
        aria-label="محرر مسودة JSON"
      />
    </div>
  );
}
