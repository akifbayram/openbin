import { Input } from '@/components/ui/input';
import { sectionHeader } from '@/lib/utils';
import type { CustomField } from '@/types';

interface CustomFieldsEditCardProps {
  fields: CustomField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function CustomFieldsEditCard({ fields, values, onChange }: CustomFieldsEditCardProps) {
  function handleChange(fieldId: string, value: string) {
    onChange({ ...values, [fieldId]: value });
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <label htmlFor={`cf-${field.id}`} className={sectionHeader}>
            {field.name}
          </label>
          <Input
            id={`cf-${field.id}`}
            value={values[field.id] ?? ''}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={field.name}
            maxLength={2000}
          />
        </div>
      ))}
    </div>
  );
}
