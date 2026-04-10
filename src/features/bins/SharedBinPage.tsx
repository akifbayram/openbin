import { ExternalLink, Package, Unlink } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { BrandIcon } from '@/components/BrandIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { useSharedBin } from './useBinShare';

function SharedPhotoGrid({ photos, token }: { photos: Array<{ id: string; filename: string }>; token: string }) {
  if (photos.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {photos.map((p) => (
        <a
          key={p.id}
          href={`/api/shared/${token}/photos/${p.id}/file`}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--bg-input)]"
        >
          <img
            src={`/api/shared/${token}/photos/${p.id}/thumb`}
            alt={p.filename}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}

export function SharedBinPage() {
  const { token } = useParams<{ token: string }>();
  const { bin, isLoading, error } = useSharedBin(token);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !bin) {
    return (
      <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Unlink className="h-10 w-10 text-[var(--text-tertiary)] mx-auto" />
          <p className="text-lg font-semibold">This link is no longer available</p>
          <p className="text-sm text-[var(--text-tertiary)]">The share link may have been revoked or the bin deleted.</p>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline mt-2"
          >
            Go to OpenBin
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  const hasItems = bin.items.length > 0;
  const hasNotes = bin.notes.trim().length > 0;
  const hasTags = bin.tags.length > 0;
  const hasPhotos = bin.photos.length > 0;
  const customFields = Object.entries(bin.custom_fields).filter(([, v]) => v);

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-5 w-5 text-[var(--text-secondary)]" />
            <h1 className="text-xl font-semibold">{bin.name}</h1>
          </div>
          {bin.area_name && (
            <p className="text-sm text-[var(--text-tertiary)]">{bin.area_name}</p>
          )}
        </div>

        {/* Photos */}
        {hasPhotos && (
          <div className="flat-card p-4 space-y-2">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">Photos</h2>
            <SharedPhotoGrid photos={bin.photos} token={bin.shareToken} />
          </div>
        )}

        {/* Items */}
        {hasItems && (
          <div className="flat-card p-4 space-y-2">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">Items</h2>
            <ul className="space-y-1">
              {bin.items.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm py-1 border-b border-[var(--border-subtle)] last:border-0">
                  <span>{item.name}</span>
                  {item.quantity != null && (
                    <span className="text-[var(--text-tertiary)] tabular-nums">{item.quantity}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        {hasNotes && (
          <div className="flat-card p-4 space-y-2">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{bin.notes}</p>
          </div>
        )}

        {/* Tags */}
        {hasTags && (
          <div className="flat-card p-4 space-y-2">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">Tags</h2>
            <div className="flex flex-wrap gap-1.5">
              {bin.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-[var(--bg-input)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Custom fields */}
        {customFields.length > 0 && (
          <div className="flat-card p-4 space-y-2">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">Details</h2>
            <dl className="space-y-1">
              {customFields.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm py-1 border-b border-[var(--border-subtle)] last:border-0">
                  <dt className="text-[var(--text-tertiary)]">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Footer branding */}
        <div className="pt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--text-tertiary)]">
          <BrandIcon className="h-3.5 w-3.5" />
          <span>Powered by OpenBin</span>
        </div>
      </div>
    </div>
  );
}
