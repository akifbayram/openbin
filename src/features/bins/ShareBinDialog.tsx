import { Check, Clock, Copy, Eye, Globe, Link2, Loader2, Lock, Trash2 } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { usePlan } from '@/lib/usePlan';
import { cn, getErrorMessage } from '@/lib/utils';
import { type BinShare, createShare, revokeShare, useBinShare } from './useBinShare';

const UpgradePrompt = __EE__
  ? lazy(() => import('@/ee/UpgradePrompt').then(m => ({ default: m.UpgradePrompt })))
  : (() => null) as React.FC<Record<string, unknown>>;

interface ShareBinDialogProps {
  binId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareBinDialog({ binId, open, onOpenChange }: ShareBinDialogProps) {
  const { isGated, isSelfHosted, planInfo } = usePlan();
  const sharingGated = !isSelfHosted && isGated('binSharing');
  const { share, isLoading, setShare } = useBinShare(open ? binId : undefined);
  const { showToast } = useToast();
  const [visibility, setVisibility] = useState<'public' | 'unlisted'>('unlisted');
  const [expiry, setExpiry] = useState<string>('none');
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  function computeExpiresAt(): string | null {
    if (expiry === 'none') return null;
    const now = new Date();
    const hours = { '1h': 1, '24h': 24, '7d': 168, '30d': 720 }[expiry];
    if (!hours) return null;
    return new Date(now.getTime() + hours * 3600_000).toISOString();
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await createShare(binId, visibility, computeExpiresAt());
      setShare(result);
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to create share link'), variant: 'error' });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      await revokeShare(binId);
      setShare(null);
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to revoke share link'), variant: 'error' });
    } finally {
      setRevoking(false);
    }
  }

  function getShareUrl(s: BinShare): string {
    return s.url || `${window.location.origin}/s/${s.token}`;
  }

  async function handleCopy() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(getShareUrl(share));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast({ message: 'Link copied to clipboard', variant: 'success' });
    } catch {
      showToast({ message: 'Failed to copy link', variant: 'error' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>

        {sharingGated ? (
          __EE__ && (
            <Suspense fallback={null}>
              <UpgradePrompt
                feature="Bin Sharing"
                description="Generate public or unlisted links to share bins with anyone."
                upgradeAction={planInfo.upgradeAction}
              />
            </Suspense>
          )
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        ) : share ? (
          <div className="space-y-4">
            {/* Share URL */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={getShareUrl(share)}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 rounded-[var(--radius-sm)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] truncate outline-none border-none"
              />
              <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy link">
                {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Info row */}
            <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium',
                share.visibility === 'public'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              )}>
                {share.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {share.visibility === 'public' ? 'Public' : 'Unlisted'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {share.viewCount} view{share.viewCount !== 1 ? 's' : ''}
              </span>
              {share.expiresAt && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires {new Date(share.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Revoke */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevoke}
              disabled={revoking}
              className="text-[var(--destructive)]"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {revoking ? 'Revoking...' : 'Revoke Link'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Create a link that anyone can use to view this bin without logging in.
            </p>

            {/* Visibility selector */}
            <div className="space-y-2">
              <span className="ui-group-label">Visibility</span>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="share-visibility"
                    checked={visibility === 'unlisted'}
                    onChange={() => setVisibility('unlisted')}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)] inline-flex items-center gap-1">
                      <Link2 className="h-3.5 w-3.5" /> Unlisted
                    </span>
                    <p className="text-xs text-[var(--text-tertiary)]">Only people with the link can view</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="share-visibility"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)] inline-flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" /> Public
                    </span>
                    <p className="text-xs text-[var(--text-tertiary)]">Discoverable and visible to anyone</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Expiration selector */}
            <div className="space-y-2">
              <span className="ui-group-label">Expiration</span>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] border border-[var(--border-flat)] outline-none"
              >
                <option value="none">Never</option>
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
              </select>
            </div>

            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Share Link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
