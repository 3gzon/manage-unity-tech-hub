'use client';

import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  a({ href, children }) {
    const safe = href && /^(https?:|mailto:)/i.test(href) ? href : undefined;
    return (
      <a href={safe} target="_blank" rel="noreferrer" className="text-[#046bd2] underline">
        {children}
      </a>
    );
  },
};

export function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 text-sm leading-7 text-slate-700 [&_blockquote]:border-l-4 [&_blockquote]:border-[#046bd2] [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[#020D23] [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#020D23] [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#020D23] [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-[#020D23] [&_pre]:p-3 [&_pre]:text-[#00FF88] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
