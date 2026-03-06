import { Check, Copy, Key, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { createApiKey, revokeApiKey, useApiKeys } from './useApiKeys';
import { Button, Dialog, Input } from '@chakra-ui/react'


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
      toaster.create({ description: err instanceof Error ? err.message : 'Failed to create API key' });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeId) return;
    setRevoking(true);
    try {
      await revokeApiKey(revokeId);
      toaster.create({ description: 'API key revoked' });
      setRevokeId(null);
    } catch (err) {
      toaster.create({ description: err instanceof Error ? err.message : 'Failed to revoke API key' });
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
      toaster.create({ description: 'Failed to copy' });
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
          <div className="flex items-baseline justify-between">
            <Label className="inline-flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />API Keys</Label>
            <Tooltip content="Create API key" side="bottom">
              <Button
                onClick={() => setCreateOpen(true)}
                size="xs" px="0"
                aria-label="Create API key"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
            Use API keys for smart home integrations and headless access.
          </p>

          {keys.length === 0 ? (
            <p className="text-[13px] text-gray-500 dark:text-gray-400 py-4 text-center">
              No API keys yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2 mt-3">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] bg-gray-500/12 dark:bg-gray-500/24"
                >
                  <Key className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate">
                      {k.name || k.key_prefix}
                    </p>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">
                      {k.key_prefix}... &middot; Created {formatDate(k.created_at)}
                      {k.last_used_at ? ` \u00b7 Last used ${formatDate(k.last_used_at)}` : ''}
                    </p>
                  </div>
                  <Tooltip content="Revoke API key" side="bottom">
                    <Button
                      variant="ghost"
                      size="xs" px="0"
                      className="text-red-500 dark:text-red-400 shrink-0"
                      onClick={() => setRevokeId(k.id)}
                      aria-label="Revoke API key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog.Root open={createOpen} onOpenChange={(e) => !e.open && handleCloseCreate()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>{newKey ? 'API Key Created' : 'Create API Key'}</Dialog.Title>
            <Dialog.Description>
              {newKey
                ? 'Copy this key now — it won\'t be shown again.'
                : 'Give your key a name to help you identify it later.'}
            </Dialog.Description>
          </Dialog.Header>
          {newKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[13px] bg-gray-500/12 dark:bg-gray-500/24 px-3 py-2 rounded-[var(--radius-sm)] break-all select-all font-mono">
                  {newKey}
                </code>
                <Button
                  variant="outline"
                  size="xs" px="0"
                  className="shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Dialog.Footer>
                <Button onClick={handleCloseCreate}>
                  Done
                </Button>
              </Dialog.Footer>
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
              <Dialog.Footer>
                <Button type="button" variant="ghost" onClick={handleCloseCreate}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </Dialog.Footer>
            </form>
          )}
        </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Revoke Confirmation Dialog */}
      <Dialog.Root open={!!revokeId} onOpenChange={(e) => !e.open && setRevokeId(null)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Revoke API Key?</Dialog.Title>
            <Dialog.Description>
              Any integrations using this key will stop working immediately. This cannot be undone.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => setRevokeId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-red-500 hover:opacity-90"
            >
              {revoking ? 'Revoking...' : 'Revoke'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}
