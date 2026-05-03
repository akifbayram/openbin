import { Check, Copy, Download, QrCode, RefreshCw, Share2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { getQRCodeStyling, rawQrToDataURL } from '@/lib/qr';
import { cn, getErrorMessage } from '@/lib/utils';
import type { Location } from '@/types';
import { regenerateInvite } from './useLocations';

interface LocationInviteShareProps {
  location: Location;
  variant?: 'card' | 'compact';
}

export function LocationInviteShare({ location, variant = 'card' }: LocationInviteShareProps) {
  const { showToast } = useToast();
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const isAdmin = location.role === 'admin';
  const inviteCode = location.invite_code;
  const inviteLink = useMemo(
    () => (inviteCode ? `${window.location.origin}/register?invite=${encodeURIComponent(inviteCode)}` : ''),
    [inviteCode],
  );

  useEffect(() => {
    if (!qrOpen || !inviteLink) {
      setQrUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const Ctor = await getQRCodeStyling();
      const qr = new Ctor({
        width: 256,
        height: 256,
        type: 'canvas',
        data: inviteLink,
        margin: 1,
        dotsOptions: { type: 'square', color: '#000000' },
        backgroundOptions: { color: '#ffffff' },
      });
      const raw = await qr.getRawData('png');
      if (!raw || cancelled) return;
      const url = await rawQrToDataURL(raw);
      if (!cancelled) setQrUrl(url);
    })();
    return () => { cancelled = true; };
  }, [qrOpen, inviteLink]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      showToast({ message: 'Failed to copy', variant: 'error' });
    }
  }, [inviteLink, showToast]);

  const handleCopyCode = useCallback(async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      showToast({ message: 'Failed to copy', variant: 'error' });
    }
  }, [inviteCode, showToast]);

  const handleShare = useCallback(async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${location.name}`, url: inviteLink });
      } catch { /* cancelled by user */ }
    } else {
      try {
        await navigator.clipboard.writeText(inviteLink);
        showToast({ message: 'Invite link copied', variant: 'success' });
      } catch {
        showToast({ message: 'Failed to copy', variant: 'error' });
      }
    }
  }, [inviteLink, location.name, showToast]);

  const handleDownloadQr = useCallback(() => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `invite-qr-${location.name}.png`;
    a.click();
  }, [qrUrl, location.name]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      await regenerateInvite(location.id);
      setConfirmRegenerate(false);
      showToast({ message: 'Invite link regenerated', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to regenerate'), variant: 'error' });
    } finally {
      setRegenerating(false);
    }
  }, [location.id, showToast]);

  if (!isAdmin || !inviteCode) return null;

  const role = location.default_join_role === 'viewer' ? 'viewer' : 'member';
  const isCompact = variant === 'compact';

  return (
    <div className={cn('space-y-2', !isCompact && 'pt-3 border-t border-[var(--border-flat)]')}>
      {/* Role chip */}
      <div className="px-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-full)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-medium">
          Joins as {role === 'viewer' ? 'Viewer' : 'Member'}
        </span>
      </div>

      {/* Link row */}
      <div className="flex items-center gap-1.5 p-2 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
        <span className="flex-1 min-w-0 px-1 text-[13px] text-[var(--text-secondary)] truncate" title={inviteLink}>
          {inviteLink}
        </span>
        <Tooltip content={linkCopied ? 'Copied' : 'Copy link'} side="top">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleCopyLink}
            className="shrink-0"
            aria-label="Copy invite link"
          >
            {linkCopied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
            {linkCopied ? 'Copied' : 'Copy'}
          </Button>
        </Tooltip>
        <Tooltip content={qrOpen ? 'Hide QR code' : 'Show QR code'} side="top">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setQrOpen((o) => !o)}
            className="shrink-0"
            aria-label={qrOpen ? 'Hide QR code' : 'Show QR code'}
            aria-pressed={qrOpen}
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Share" side="top">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleShare}
            className="shrink-0"
            aria-label="Share invite link"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>

      {/* Helper text */}
      <p className="text-[12px] text-[var(--text-tertiary)] px-0.5">
        Anyone with this link can join <span className="font-medium text-[var(--text-secondary)]">{location.name}</span>.
      </p>

      {/* QR code panel */}
      {qrOpen && (
        <div className="flex flex-col items-center gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
          <p className="text-[12px] text-[var(--text-secondary)]">
            Scan to join <span className="font-semibold">{location.name}</span>
          </p>
          {qrUrl ? (
            <img src={qrUrl} alt="Invite QR code" className="w-44 h-44 rounded-[var(--radius-md)]" />
          ) : (
            <Skeleton className="w-44 h-44" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownloadQr}
            disabled={!qrUrl}
            className="text-[12px]"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Download
          </Button>
        </div>
      )}

      {/* Manual code disclosure (Regenerate now lives inside) */}
      <div className="pt-1">
        <Disclosure label="Show code" labelClassName="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] py-1">
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-[var(--text-tertiary)]">
              For typing manually in the Join dialog.
            </p>
            <div className="flex items-center gap-1.5 p-2 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
              <code className="flex-1 min-w-0 text-[12px] font-mono text-[var(--text-primary)] tracking-wider break-all">
                {inviteCode}
              </code>
              <Tooltip content={codeCopied ? 'Copied' : 'Copy code'} side="top">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopyCode}
                  className="shrink-0"
                  aria-label="Copy invite code"
                >
                  {codeCopied
                    ? <Check className="h-4 w-4 text-[var(--color-success)]" />
                    : <Copy className="h-4 w-4" />}
                </Button>
              </Tooltip>
            </div>
            <button
              type="button"
              onClick={() => setConfirmRegenerate(true)}
              disabled={regenerating}
              className="inline-flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--destructive)] disabled:opacity-50 transition-colors py-1"
              aria-label="Regenerate invite link"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', regenerating && 'animate-spin')} />
              <span>Regenerate link</span>
            </button>
          </div>
        </Disclosure>
      </div>

      {/* Regenerate confirmation */}
      <Dialog open={confirmRegenerate} onOpenChange={(v) => { if (!regenerating) setConfirmRegenerate(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate invite link?</DialogTitle>
            <DialogDescription>
              The current link and QR code will stop working immediately. Anyone you've already shared them with — including printed QR codes — will lose access until you share the new link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmRegenerate(false)}
              disabled={regenerating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
