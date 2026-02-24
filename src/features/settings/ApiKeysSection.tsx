import { useState } from 'react';
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiKeys, createApiKey, revokeApiKey } from './useApiKeys';

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ApiKeysSection() {
  const { keys, isLoading } = useApiKeys();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await createApiKey(keyName.trim());
      setNewKey(result.key);
      setKeyName('');
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create API key' });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeId) return;
    setRevoking(true);
    try {
      await revokeApiKey(revokeId);
      showToast({ message: 'API key revoked' });
      setRevokeId(null);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to revoke API key' });
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ message: 'Failed to copy' });
    }
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    setNewKey(null);
    setKeyName('');
    setCopied(false);
  }

  if (isLoading) return null;

  return (
    <>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>API Keys</Label>
            <Button
              onClick={() => setCreateOpen(true)}
              size="icon"
              className="h-8 w-8 rounded-full"
              aria-label="Create API key"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
            Use API keys for smart home integrations and headless access.
          </p>

          {keys.length === 0 ? (
            <p className="text-[13px] text-[var(--text-tertiary)] py-4 text-center">
              No API keys yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2 mt-3">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-input)]"
                >
                  <Key className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                      {k.name || k.key_prefix}
                    </p>
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      {k.key_prefix}... &middot; Created {formatDate(k.created_at)}
                      {k.last_used_at ? ` \u00b7 Last used ${formatDate(k.last_used_at)}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-8 w-8 text-[var(--destructive)] shrink-0"
                    onClick={() => setRevokeId(k.id)}
                    aria-label="Revoke API key"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && handleCloseCreate()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
            <DialogDescription>
              {newKey
                ? 'Copy this key now — it won\'t be shown again.'
                : 'Give your key a name to help you identify it later.'}
            </DialogDescription>
          </DialogHeader>
          {newKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[13px] bg-[var(--bg-input)] px-3 py-2 rounded-[var(--radius-sm)] break-all select-all font-mono">
                  {newKey}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full h-9 w-9"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseCreate} className="rounded-[var(--radius-full)]">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Home Assistant, Alexa"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={handleCloseCreate} className="rounded-[var(--radius-full)]">
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} className="rounded-[var(--radius-full)]">
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key?</DialogTitle>
            <DialogDescription>
              Any integrations using this key will stop working immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeId(null)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button
              onClick={handleRevoke}
              disabled={revoking}
              className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:opacity-90"
            >
              {revoking ? 'Revoking...' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
