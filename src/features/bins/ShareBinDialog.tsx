import { Check, Copy, Eye, Globe, Link2, Loader2, Lock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { UpgradePrompt } from '@/components/ui/upgrade-prompt';
import { usePlan } from '@/lib/usePlan';
import { cn } from '@/lib/utils';
import { type BinShare, createShare, revokeShare, useBinShare } from './useBinShare';

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
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await createShare(binId, visibility);
      setShare(result);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create share link', variant: 'error' });
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
      showToast({ message: err instanceof Error ? err.message : 'Failed to revoke share link', variant: 'error' });
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
          <UpgradePrompt
            feature="Bin Sharing"
            description="Generate public or unlisted links to share bins with anyone."
            upgradeUrl={planInfo.upgradeUrl}
          />
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
              <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Visibility</span>
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

            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Share Link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
