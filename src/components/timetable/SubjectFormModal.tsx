import { useEffect, useState, type FormEvent } from 'react';
import { subjectSchema } from '../../schemas/subject.schema';
import { SUBJECT_COLOR_PALETTE, type Subject } from '../../types/domain';
import { Button, Input, Modal } from '../ui';

interface SubjectFormModalProps {
  open: boolean;
  onClose: () => void;
  initialSubject?: Subject | null;
  allowHistoricalEdit?: boolean;
  onSubmitSubject: (data: {
    name: string;
    code: string;
    color: string;
    historicalConducted: number;
    historicalAttended: number;
  }) =>
    | Promise<{ ok: true } | { ok: false; error: string }>
    | { ok: true }
    | { ok: false; error: string };
}

export function SubjectFormModal({
  open,
  onClose,
  initialSubject,
  allowHistoricalEdit = false,
  onSubmitSubject,
}: SubjectFormModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState<string>(SUBJECT_COLOR_PALETTE[0]);
  const [historicalConducted, setHistoricalConducted] = useState(0);
  const [historicalAttended, setHistoricalAttended] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSubmitError(null);
    setSaving(false);
    if (initialSubject) {
      setName(initialSubject.name);
      setCode(initialSubject.code);
      setColor(initialSubject.color);
      setHistoricalConducted(initialSubject.historicalConducted);
      setHistoricalAttended(initialSubject.historicalAttended);
    } else {
      setName('');
      setCode('');
      setColor(SUBJECT_COLOR_PALETTE[0]);
      setHistoricalConducted(0);
      setHistoricalAttended(0);
    }
  }, [open, initialSubject]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const parsed = subjectSchema.safeParse({
      name,
      code,
      color,
      historicalConducted,
      historicalAttended,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const result = await onSubmitSubject(parsed.data);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialSubject ? 'Edit Subject' : 'Add Subject'}
      description="Define subject details and color tag for your timetable and attendance tracking."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="rounded-[10px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3 py-2 text-xs font-medium text-[var(--status-danger)]">
            {submitError}
          </div>
        )}

        <Input
          label="Subject Name"
          placeholder="e.g., Data Structures & Algorithms"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <Input
          label="Subject Code"
          placeholder="e.g., CS301"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          error={errors.code}
        />

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-[var(--text-muted)]">Subject Color</span>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLOR_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Select color ${swatch}`}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  color === swatch
                    ? 'scale-110 border-[var(--text-main)] ring-2 ring-[var(--accent-primary)]/50'
                    : 'border-[var(--border-subtle)] shadow-sm hover:scale-105'
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>

        {allowHistoricalEdit && (
          <div className="grid grid-cols-2 gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-well)] p-3">
            <Input
              label="Baseline Conducted"
              type="number"
              min={0}
              value={historicalConducted}
              onChange={(e) => setHistoricalConducted(Number(e.target.value))}
              error={errors.historicalConducted}
            />
            <Input
              label="Baseline Attended"
              type="number"
              min={0}
              value={historicalAttended}
              onChange={(e) => setHistoricalAttended(Number(e.target.value))}
              error={errors.historicalAttended}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {initialSubject ? 'Save Subject' : 'Add Subject'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
