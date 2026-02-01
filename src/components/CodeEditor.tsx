import { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'html' | 'css' | 'js' | 'javascript' | 'text';
  className?: string;
  readOnly?: boolean;
}

// Custom dark theme matching our design system
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'hsl(222 47% 6%)',
    color: 'hsl(210 40% 98%)',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '14px',
    lineHeight: '1.6',
    padding: '16px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'hsl(222 47% 8%)',
    color: 'hsl(215 20% 45%)',
    border: 'none',
    borderRight: '1px solid hsl(222 30% 18%)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'hsl(222 30% 12%)',
    color: 'hsl(187 100% 50%)',
  },
  '.cm-activeLine': {
    backgroundColor: 'hsl(222 30% 10%)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'hsl(187 100% 50% / 0.2) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'hsl(187 100% 50%)',
    borderLeftWidth: '2px',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'hsl(187 100% 50% / 0.3)',
    color: 'inherit',
  },
  '.cm-searchMatch': {
    backgroundColor: 'hsl(38 92% 50% / 0.3)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'hsl(38 92% 50% / 0.5)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'hsl(222 30% 14%)',
    color: 'hsl(187 100% 50%)',
    border: 'none',
    padding: '0 8px',
    borderRadius: '4px',
  },
  // Syntax highlighting
  '.cm-keyword': { color: 'hsl(280 100% 70%)' },
  '.cm-string': { color: 'hsl(142 76% 56%)' },
  '.cm-number': { color: 'hsl(38 92% 60%)' },
  '.cm-comment': { color: 'hsl(215 20% 45%)', fontStyle: 'italic' },
  '.cm-propertyName': { color: 'hsl(187 100% 60%)' },
  '.cm-variableName': { color: 'hsl(210 40% 90%)' },
  '.cm-function': { color: 'hsl(210 100% 70%)' },
  '.cm-operator': { color: 'hsl(187 100% 50%)' },
  '.cm-punctuation': { color: 'hsl(215 20% 65%)' },
  '.cm-tagName': { color: 'hsl(0 84% 65%)' },
  '.cm-attributeName': { color: 'hsl(38 92% 60%)' },
  '.cm-attributeValue': { color: 'hsl(142 76% 56%)' },
  '.cm-angleBracket': { color: 'hsl(215 20% 55%)' },
  '.cm-definition': { color: 'hsl(210 100% 70%)' },
}, { dark: true });

export default function CodeEditor({ 
  value, 
  onChange, 
  language, 
  className = '',
  readOnly = false 
}: CodeEditorProps) {
  const extensions = useMemo(() => {
    const exts = [EditorView.lineWrapping];
    
    switch (language) {
      case 'html':
        exts.push(html());
        break;
      case 'css':
        exts.push(css());
        break;
      case 'js':
      case 'javascript':
        exts.push(javascript());
        break;
      default:
        break;
    }
    
    return exts;
  }, [language]);

  const handleChange = useCallback((val: string) => {
    onChange(val);
  }, [onChange]);

  return (
    <CodeMirror
      value={value}
      onChange={handleChange}
      extensions={extensions}
      theme={darkTheme}
      className={`h-full ${className}`}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightSelectionMatches: true,
        closeBracketsKeymap: true,
        defaultKeymap: true,
        searchKeymap: true,
        historyKeymap: true,
        foldKeymap: true,
        completionKeymap: true,
        lintKeymap: true,
      }}
    />
  );
}
