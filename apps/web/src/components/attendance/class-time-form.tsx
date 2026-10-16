import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function ClassTimeForm({
  dateLabel,
  startTime,
  endTime,
  saving,
  error,
  disabled,
  existing,
  onStartTimeChange,
  onEndTimeChange,
  onSave,
}: {
  dateLabel: string;
  startTime: string;
  endTime: string;
  saving: boolean;
  error: string | null;
  disabled?: boolean;
  existing: boolean;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSave: () => void;
}) {
  const invalid = !startTime || !endTime || startTime >= endTime;

  return (
    <div className="max-w-md">
      <p className="mb-2 text-sm font-medium">{dateLabel}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="class-start">Start</Label>
          <Input
            id="class-start"
            type="time"
            value={startTime}
            disabled={disabled || saving}
            onChange={(event) => onStartTimeChange(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="class-end">End</Label>
          <Input
            id="class-end"
            type="time"
            value={endTime}
            disabled={disabled || saving}
            onChange={(event) => onEndTimeChange(event.target.value)}
          />
        </div>
      </div>
      {invalid && startTime && endTime ? (
        <p className="mt-2 text-sm text-red-600">End time must be after the start time.</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <Button className="mt-3" disabled={disabled || saving || invalid} onClick={onSave}>
        {saving ? 'Saving…' : existing ? 'Update class time' : 'Schedule class'}
      </Button>
    </div>
  );
}
