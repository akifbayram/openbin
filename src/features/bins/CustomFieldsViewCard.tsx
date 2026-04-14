import { sectionHeader } from '@/lib/utils';
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
        <div key={field.id} className="space-y-1.5">
          <p className={sectionHeader}>{field.name}</p>
          <p className="text-[15px] text-[var(--text-primary)]">{values[field.id]}</p>
        </div>
      ))}
    </div>
  );
}
