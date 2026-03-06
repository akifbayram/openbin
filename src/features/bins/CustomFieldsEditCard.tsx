import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomField } from '@/types';

interface CustomFieldsEditCardProps {
  fields: CustomField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function CustomFieldsEditCard({ fields, values, onChange }: CustomFieldsEditCardProps) {
  if (fields.length === 0) return null;

  function handleChange(fieldId: string, value: string) {
    onChange({ ...values, [fieldId]: value });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <Label>Custom Fields</Label>
        {fields.map((field) => (
          <div key={field.id} className="stack-xs">
            <label
              htmlFor={`cf-${field.id}`}
              className="text-[13px] text-[var(--text-secondary)]"
            >
              {field.name}
            </label>
            <Input
              id={`cf-${field.id}`}
              value={values[field.id] ?? ''}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.name}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
