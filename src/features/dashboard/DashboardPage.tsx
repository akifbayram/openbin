import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, MapPin, ChevronRight, Plus, Inbox, ImagePlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { useDashboard } from './useDashboard';
import { BinCard } from '@/features/bins/BinCard';
import { BinCreateDialog } from '@/features/bins/BinCreateDialog';

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Card className="flex-1">
      <Wrapper
        className="w-full text-left"
        {...(onClick ? { onClick } : {})}
      >
        <CardContent className="py-3 px-4">
          <p className="text-[24px] font-bold text-[var(--text-primary)] leading-tight">
            {value}
          </p>
          <p className="text-[13px] text-[var(--text-tertiary)]">{label}</p>
        </CardContent>
      </Wrapper>
    </Card>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
        {title}
      </h2>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-0.5 text-[13px] font-medium text-[var(--accent)]"
        >
          {action.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const { totalBins, totalItems, totalAreas, needsOrganizing, recentlyScanned, recentlyUpdated, isLoading } =
    useDashboard();
  const [createOpen, setCreateOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close add menu on click outside
  useEffect(() => {
    if (!addMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [addMenuOpen]);

  if (!activeLocationId) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-6 pb-2">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Dashboard
        </h1>
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <MapPin className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
              No location selected
            </p>
            <p className="text-[13px]">
              Create or join a location to start organizing bins
            </p>
          </div>
          <Button
            onClick={() => navigate('/settings')}
            variant="outline"
            className="rounded-[var(--radius-full)] mt-1"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Manage Locations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-2">
      <div className="flex items-center justify-between">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Dashboard
        </h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/scan')}
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full"
            aria-label="Scan QR code"
          >
            <ScanLine className="h-5 w-5" />
          </Button>
          <div ref={addMenuRef} className="relative">
            <Button
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="Add bin"
            >
              <Plus className="h-5 w-5" />
            </Button>
            {addMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-lg overflow-hidden z-20">
                <button
                  onClick={() => { setAddMenuOpen(false); setCreateOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Plus className="h-4 w-4 text-[var(--text-secondary)]" />
                  New Bin
                </button>
                <button
                  onClick={() => { setAddMenuOpen(false); navigate('/bulk-add'); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <ImagePlus className="h-4 w-4 text-[var(--text-secondary)]" />
                  Add from Photos
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="flex gap-3">
          <div className="flex-1 glass-card rounded-[var(--radius-lg)] p-4">
            <Skeleton className="h-7 w-12 mb-1" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex-1 glass-card rounded-[var(--radius-lg)] p-4">
            <Skeleton className="h-7 w-12 mb-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <StatCard
            label="Total Bins"
            value={totalBins}
            onClick={() => navigate('/bins')}
          />
          <StatCard label="Total Items" value={totalItems} />
          {totalAreas > 0 && (
            <StatCard
              label="Areas"
              value={totalAreas}
              onClick={() => navigate('/areas')}
            />
          )}
        </div>
      )}

      {/* Needs Organizing */}
      {!isLoading && needsOrganizing > 0 && (
        <button
          onClick={() => navigate('/bins', { state: { needsOrganizing: true } })}
          className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Inbox className="h-[18px] w-[18px] text-amber-500" />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                {needsOrganizing} bin{needsOrganizing !== 1 ? 's' : ''} need{needsOrganizing === 1 ? 's' : ''} organizing
              </p>
              <p className="text-[12px] text-[var(--text-tertiary)]">No tags, area, or items</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
        </button>
      )}

      {/* Recently Scanned */}
      {recentlyScanned.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeader title="Recently Scanned" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recentlyScanned.map((bin) => (
              <BinCard key={bin.id} bin={bin} />
            ))}
          </div>
        </div>
      )}

      {/* Recently Updated */}
      {!isLoading && recentlyUpdated.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            title="Recently Updated"
            action={{ label: 'All Bins', onClick: () => navigate('/bins') }}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recentlyUpdated.map((bin) => (
              <BinCard key={bin.id} bin={bin} />
            ))}
          </div>
        </div>
      )}

      <BinCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
