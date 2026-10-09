'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { importStudents } from '@/lib/students-api';
import { parseStudentCsv, studentCsvTemplate, type StudentCsvParseResult } from '@/lib/students-csv';

interface ImportStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
}

export function ImportStudentsDialog({ open, onOpenChange, onImported }: ImportStudentsDialogProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<StudentCsvParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  function reset() {
    setFileName(null);
    setParsed(null);
    setParseError(null);
    setImporting(false);
    setResultMessage(null);
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  async function handleFile(file: File) {
    setParseError(null);
    setResultMessage(null);
    setFileName(file.name);
    const text = await file.text();
    const next = parseStudentCsv(text);
    setParsed(next);
    if (next.students.length === 0) {
      setParseError(next.rejected[0]?.message ?? 'No students could be read from this file.');
    }
  }

  async function handleImport() {
    if (!parsed?.students.length) return;
    setImporting(true);
    setResultMessage(null);
    try {
      const response = await importStudents({
        students: parsed.students.map((item) => ({ row: item.row, student: item.student })),
      });
      const failed = response.failed.map((item) => `Row ${item.row} (${item.name}): ${item.message}`).join(' ');
      setResultMessage(
        `Created ${response.created}. Skipped ${response.skipped} already in the list.${failed ? ` ${failed}` : ''}`,
      );
      await onImported();
    } catch (error) {
      setResultMessage(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([studentCsvTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const preview = parsed?.students.slice(0, 8) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogHeader>
        <DialogTitle>Import students</DialogTitle>
        <DialogDescription>
          Upload a CSV exported from Google Sheets. First name and last name are read from Emri and Mbiemri, or from a
          full name column. A missing last name is saved as Student, and a missing registration date uses today.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" />
            Choose CSV
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = '';
              }}
            />
          </label>
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            Download template
          </Button>
        </div>

        {fileName ? <p className="text-sm text-muted-foreground">{fileName}</p> : null}
        {parseError ? (
          <p className="text-sm text-red-600" role="alert">
            {parseError}
          </p>
        ) : null}

        {parsed && parsed.students.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm">
              {parsed.students.length} students ready
              {parsed.rejected.length ? `, ${parsed.rejected.length} rows skipped` : ''}.
            </p>
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3 text-sm">
              {preview.map((item) => (
                <li key={item.row}>
                  <span className="font-medium">
                    {item.student.firstName} {item.student.lastName}
                  </span>
                  {item.student.age != null || item.student.phone ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · {item.student.age != null ? `age ${item.student.age}` : null}
                      {item.student.age != null && item.student.phone ? ' · ' : null}
                      {item.student.phone}
                    </span>
                  ) : null}
                  {item.placeholders.length ? (
                    <span className="mt-0.5 block text-xs text-amber-700">
                      Placeholder: {item.placeholders.join(', ')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {parsed.students.length > preview.length ? (
              <p className="text-xs text-muted-foreground">Showing the first {preview.length} rows.</p>
            ) : null}
            {parsed.rejected.length ? (
              <ul className="space-y-1 text-xs text-red-600">
                {parsed.rejected.slice(0, 5).map((item) => (
                  <li key={`${item.row}-${item.message}`}>
                    Row {item.row}: {item.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {resultMessage ? <p className="text-sm">{resultMessage}</p> : null}
      </div>

      <DialogFooter className="mt-4">
        <Button type="button" variant="outline" onClick={close}>
          Close
        </Button>
        <Button type="button" disabled={!parsed?.students.length || importing || Boolean(resultMessage?.startsWith('Created'))} onClick={() => void handleImport()}>
          {importing ? 'Importing...' : 'Import students'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
