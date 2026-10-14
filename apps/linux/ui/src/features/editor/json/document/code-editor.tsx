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

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  suggestions?: readonly string[];
  height?: string;
  liveValidation?: boolean;
}
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  suggestions = noSuggestions,
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
    () => ({ ...editorSetup, autocompletion: suggestions.length > 0 }),
    [suggestions],
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
        }) => {
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
    [suggestions, liveValidation],
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
