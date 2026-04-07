import type { CustomField } from '@/types';

interface CustomFieldsViewCardProps {
  fields: CustomField[];
  values: Record<string, string>;
}

export function CustomFieldsViewCard({ fields, values }: CustomFieldsViewCardProps) {
  const populated = fields.filter((f) => values[f.id]?.trim());

  return (
    <div className="space-y-4">
      {populated.map((field) => (
        <div key={field.id}>
          <p className="text-[13px] text-[var(--text-tertiary)]">{field.name}</p>
          <p className="mt-0.5 text-[15px] text-[var(--text-primary)]">{values[field.id]}</p>
        </div>
      ))}
    </div>
  );
}
