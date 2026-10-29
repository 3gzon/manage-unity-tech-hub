'use client';

import { useRef, useState } from 'react';
import { MarkdownView } from '@/components/materials/markdown-view';
import { readMarkdownFile } from '@/components/materials/material-format';

const ACTIONS: Array<{ label: string; apply: (selected: string) => { text: string; cursor?: number } }> = [
  { label: 'H1', apply: (selected) => ({ text: `# ${selected || 'Heading'}` }) },
  { label: 'H2', apply: (selected) => ({ text: `## ${selected || 'Heading'}` }) },
  { label: 'Bold', apply: (selected) => ({ text: `**${selected || 'bold'}**` }) },
  { label: 'Italic', apply: (selected) => ({ text: `*${selected || 'italic'}*` }) },
  { label: 'List', apply: (selected) => ({ text: selected ? selected.split('\n').map((line) => `- ${line}`).join('\n') : '- Item' }) },
  { label: 'Numbered', apply: (selected) => ({ text: selected ? selected.split('\n').map((line, index) => `${index + 1}. ${line}`).join('\n') : '1. Item' }) },
  { label: 'Quote', apply: (selected) => ({ text: `> ${selected || 'Quote'}` }) },
  { label: 'Code', apply: (selected) => ({ text: `\`${selected || 'code'}\`` }) },
  { label: 'Code block', apply: (selected) => ({ text: `\`\`\`\n${selected || 'code'}\n\`\`\`` }) },
  { label: 'Link', apply: (selected) => ({ text: `[${selected || 'link text'}](https://)` }) },
];

export function MarkdownEditor({
  value,
  onChange,
  onImported,
}: {
  value: string;
  onChange: (value: string) => void;
  onImported?: (markdown: string, fileName: string) => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await readMarkdownFile(file);
      if (value.trim() && text !== value && !window.confirm('Replace the lesson text with this file?')) return;
      onChange(text);
      onImported?.(text, file.name);
      setImportedName(file.name);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import that file');
    }
  }

  function apply(action: (typeof ACTIONS)[number]) {
    const element = area.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end);
    const nextPiece = action.apply(selected).text;
    const next = `${value.slice(0, start)}${nextPiece}${value.slice(end)}`;
    onChange(next);
    const cursor = start + nextPiece.length;
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap gap-1 border-b bg-slate-50 p-2">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => apply(action)}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white hover:text-[#03FE94]"
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-[#03FE94] hover:bg-white"
        >
          Import .md
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".md,.markdown,text/markdown"
          className="hidden"
          aria-label="Import a Markdown file"
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      <div className="grid lg:grid-cols-2">
        <textarea
          ref={area}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={'# Lesson title\n\nWrite the lesson in Markdown.'}
          className="min-h-[360px] w-full resize-y border-b bg-white p-4 font-mono text-sm leading-6 outline-none lg:border-b-0 lg:border-r"
        />
        <div className="min-h-[360px] bg-slate-50/60 p-4">
          {value.trim() ? (
            <MarkdownView markdown={value} />
          ) : (
            <p className="text-sm text-slate-400">The preview appears as you write.</p>
          )}
        </div>
      </div>
      <p className={`border-t px-4 py-2 text-xs ${importError ? 'text-red-600' : 'text-slate-400'}`}>
        {importError ?? (importedName ? `Imported ${importedName}. Saved as a Markdown file.` : 'Saved as a Markdown file. Import an existing .md file to fill this lesson.')}
      </p>
    </div>
  );
}
