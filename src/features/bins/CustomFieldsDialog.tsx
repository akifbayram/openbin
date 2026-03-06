import { GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Input } from '@chakra-ui/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  addCustomField,
  deleteCustomField,
  updateCustomField,
  useCustomFields,
} from './useCustomFields';

interface CustomFieldsDialogProps {
  locationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomFieldsDialog({ locationId, open, onOpenChange }: CustomFieldsDialogProps) {
  const { fields } = useCustomFields(open ? locationId : null);
  const { showToast } = useToast();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (open) {
      setNewName('');
      setEditingId(null);
    }
  }, [open]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId || !newName.trim()) return;
    setAdding(true);
    try {
      await addCustomField(locationId, newName.trim());
      setNewName('');
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to add field' });
    } finally {
      setAdding(false);
    }
  }

  async function handleRename(fieldId: string) {
    if (!locationId || !editName.trim()) return;
    try {
      await updateCustomField(locationId, fieldId, { name: editName.trim() });
      setEditingId(null);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to rename field' });
    }
  }

  async function handleDelete(fieldId: string, fieldName: string) {
    if (!locationId) return;
    try {
      await deleteCustomField(locationId, fieldId);
      showToast({ message: `Deleted "${fieldName}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete field' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom Fields</DialogTitle>
          <DialogDescription>
            Define custom fields that appear on all bins in this location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {fields.length === 0 && (
            <p className="text-[13px] text-[var(--text-tertiary)] py-2">
              No custom fields yet. Add one below.
            </p>
          )}

          {fields.map((field) => (
            <div key={field.id} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-[var(--text-tertiary)] shrink-0 opacity-40" />
              {editingId === field.id ? (
                <form
                  className="flex-1 flex items-center gap-2"
                  onSubmit={(e) => { e.preventDefault(); handleRename(field.id); }}
                >
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    className="h-8 text-[14px]"
                  />
                  <Button type="submit" size="xs" px="0" variant="ghost" className="shrink-0" disabled={!editName.trim()}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="xs" px="0" variant="ghost" className="shrink-0" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-[14px] text-[var(--text-primary)] truncate">
                    {field.name}
                  </span>
                  <Button
                    size="xs" px="0"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => { setEditingId(field.id); setEditName(field.name); }}
                  >
                    <Pencil className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                  </Button>
                  <Button
                    size="xs" px="0"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => handleDelete(field.id, field.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[var(--destructive)]" />
                  </Button>
                </>
              )}
            </div>
          ))}

          <form onSubmit={handleAdd} className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New field name"
              className="h-8 text-[14px]"
            />
            <Button type="submit" size="sm" disabled={!newName.trim() || adding} className="shrink-0">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
