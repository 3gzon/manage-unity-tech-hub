import type { MaterialProgress, MaterialStatus } from '@unity/types';

export function materialStatusLabel(status: MaterialStatus) {
  if (status === 'APPROVED') return 'Published';
  if (status === 'CHANGES_REQUESTED') return 'Changes requested';
  return 'Awaiting approval';
}

export function materialProgressText(progress: MaterialProgress) {
  const instructors = `${progress.instructorApprovals} of ${progress.instructorTarget} instructors`;
  const admin =
    progress.superAdminApproved || progress.authorIsSuperAdmin
      ? 'Super Admin included'
      : 'Waiting for Super Admin';
  return `${instructors} · ${admin}`;
}

const MARKDOWN_BODY_LIMIT = 50000;

export function readMarkdownFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.md') && !name.endsWith('.markdown')) {
    return Promise.reject(new Error('Choose a Markdown file ending in .md'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const text = String(reader.result ?? '').replace(/^\uFEFF/, '');
      if (!text.trim()) {
        reject(new Error('That Markdown file is empty'));
        return;
      }
      if (text.length > MARKDOWN_BODY_LIMIT) {
        reject(new Error('Markdown files can be at most 50,000 characters'));
        return;
      }
      resolve(text);
    };
    reader.readAsText(file);
  });
}

export function titleFromMarkdown(fileName: string, markdown: string) {
  const firstLine = markdown.split(/\r?\n/, 1)[0]?.trim() ?? '';
  const heading = firstLine.match(/^#\s+(.+)$/);
  const raw = heading?.[1]?.trim() || fileName.replace(/\.markdown$/i, '').replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim();
  return raw.slice(0, 160);
}

export function downloadMarkdown(title: string, markdown: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'material';
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}.md`;
  link.click();
  URL.revokeObjectURL(url);
}
