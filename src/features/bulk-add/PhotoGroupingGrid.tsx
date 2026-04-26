import { ChevronLeft, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { BulkAddAction, BulkAddState, Group, Photo } from './useBulkGroupAdd';
import { MAX_PHOTOS_PER_GROUP } from './useBulkGroupAdd';

const PHOTO_SIZE = 96;
const SPREAD = 7;
const PADDING = 7;
const MAX_VISIBLE_LAYERS = 3;
const BIN_SIZE = PHOTO_SIZE + PADDING * 2 + (MAX_VISIBLE_LAYERS - 1) * SPREAD;
const TOUCH_THRESHOLD = 6;
const MOUSE_THRESHOLD = 3;
const RECEIVE_ANIMATION_MS = 280;

type DropTarget = { type: 'bin'; groupId: string } | { type: 'split' } | null;

interface DragPayload {
  photoId: string;
  sourceGroupId: string;
  sourceGroupSize: number;
  previewUrl: string;
  indexLabel: number;
  offsetX: number;
  offsetY: number;
  pointerType: string;
}

interface ActiveDrag extends DragPayload {
  x: number;
  y: number;
  dropTarget: DropTarget;
}

type DragState =
  | { phase: 'idle' }
  | { phase: 'pending'; payload: DragPayload; startX: number; startY: number; pointerId: number }
  | { phase: 'active'; drag: ActiveDrag; pointerId: number };

interface KeyboardMoveState {
  photoId: string;
  sourceGroupId: string;
  sourceGroupSize: number;
  indexLabel: number;
}

interface PhotoGroupingGridProps {
  state: BulkAddState;
  dispatch: React.Dispatch<BulkAddAction>;
  effectiveMax: number;
  locationId: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAddMore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onContinue: () => void;
  onBack: () => void;
}

type PointerPayload = Omit<DragPayload, 'offsetX' | 'offsetY' | 'pointerType'>;

function hitTest(x: number, y: number): DropTarget {
  const el = document.elementFromPoint(x, y);
  if (!(el instanceof HTMLElement)) return null;
  if (el.closest('[data-split-zone]')) return { type: 'split' };
  const binEl = el.closest<HTMLElement>('[data-bin-id]');
  if (binEl) {
    const id = binEl.getAttribute('data-bin-id');
    if (id) return { type: 'bin', groupId: id };
  }
  return null;
}

function vibrate(ms: number) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
  }
}

export function PhotoGroupingGrid({
  state,
  dispatch,
  effectiveMax,
  locationId,
  fileInputRef,
  onAddMore,
  onContinue,
  onBack,
}: PhotoGroupingGridProps) {
  const t = useTerminology();
  const totalPhotos = state.groups.reduce((acc, g) => acc + g.photos.length, 0);
  const { showToast } = useToast();
  const lastToggleRef = useRef<typeof state.lastToggle>(null);
  const [drag, setDrag] = useState<DragState>({ phase: 'idle' });
  const [keyboardMove, setKeyboardMove] = useState<KeyboardMoveState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [recentlyReceivedId, setRecentlyReceivedId] = useState<string | null>(null);
  const receiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashReceive = useCallback((groupId: string) => {
    if (receiveTimerRef.current) clearTimeout(receiveTimerRef.current);
    setRecentlyReceivedId(groupId);
    receiveTimerRef.current = setTimeout(() => {
      setRecentlyReceivedId(null);
      receiveTimerRef.current = null;
    }, RECEIVE_ANIMATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (receiveTimerRef.current) clearTimeout(receiveTimerRef.current);
    },
    [],
  );

  // Surface a new lastToggle as a toast
  useEffect(() => {
    if (state.lastToggle && state.lastToggle !== lastToggleRef.current) {
      lastToggleRef.current = state.lastToggle;
      showToast({
        message: state.lastToggle.verb,
        duration: 4000,
        action: { label: 'Undo', onClick: () => dispatch({ type: 'UNDO_LAST_TOGGLE' }) },
      });
      const timer = setTimeout(() => dispatch({ type: 'CLEAR_LAST_TOGGLE' }), 4000);
      return () => clearTimeout(timer);
    }
    if (!state.lastToggle) lastToggleRef.current = null;
  }, [state.lastToggle, showToast, dispatch]);

  // Window listeners for pointermove / pointerup during drag
  useEffect(() => {
    if (drag.phase === 'idle') return;

    const handleMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      if (drag.phase === 'pending') {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const threshold =
          drag.payload.pointerType === 'touch' ? TOUCH_THRESHOLD : MOUSE_THRESHOLD;
        if (Math.hypot(dx, dy) >= threshold) {
          e.preventDefault();
          const dropTarget = hitTest(e.clientX, e.clientY);
          setDrag({
            phase: 'active',
            pointerId: drag.pointerId,
            drag: { ...drag.payload, x: e.clientX, y: e.clientY, dropTarget },
          });
          vibrate(8);
        }
      } else {
        e.preventDefault();
        const dropTarget = hitTest(e.clientX, e.clientY);
        setDrag({
          phase: 'active',
          pointerId: drag.pointerId,
          drag: { ...drag.drag, x: e.clientX, y: e.clientY, dropTarget },
        });
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      if (drag.phase === 'active') {
        const { dropTarget, photoId, sourceGroupId, sourceGroupSize } = drag.drag;
        if (dropTarget?.type === 'bin' && dropTarget.groupId !== sourceGroupId) {
          dispatch({
            type: 'MOVE_PHOTO_TO_GROUP',
            photoId,
            targetGroupId: dropTarget.groupId,
          });
          flashReceive(dropTarget.groupId);
          vibrate(12);
        } else if (dropTarget?.type === 'split' && sourceGroupSize > 1) {
          dispatch({ type: 'MOVE_PHOTO_TO_NEW_GROUP', photoId });
          vibrate(12);
        }
      }
      setDrag({ phase: 'idle' });
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [drag, dispatch, flashReceive]);

  // Escape cancels keyboard move
  useEffect(() => {
    if (!keyboardMove) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setKeyboardMove(null);
        setAnnouncement('Move canceled.');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [keyboardMove]);

  const handlePhotoPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, payload: PointerPayload) => {
      if (e.button !== undefined && e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setDrag({
        phase: 'pending',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        payload: {
          ...payload,
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top,
          pointerType: e.pointerType,
        },
      });
    },
    [],
  );

  const handlePhotoKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, payload: KeyboardMoveState) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!keyboardMove) {
        setKeyboardMove(payload);
        setAnnouncement(
          `Moving photo ${payload.indexLabel}. Press another photo to move it, or press Escape to cancel.`,
        );
      } else if (keyboardMove.photoId === payload.photoId) {
        setKeyboardMove(null);
        setAnnouncement('Move canceled.');
      } else if (keyboardMove.sourceGroupId === payload.sourceGroupId) {
        setAnnouncement('That photo is in the same bin. Pick a different bin.');
      } else {
        const targetBinCount = state.groups.find((g) => g.id === payload.sourceGroupId)?.photos.length ?? 0;
        if (targetBinCount + 1 > MAX_PHOTOS_PER_GROUP) {
          setAnnouncement(`Target bin is full (max ${MAX_PHOTOS_PER_GROUP} photos).`);
          return;
        }
        dispatch({
          type: 'MOVE_PHOTO_TO_GROUP',
          photoId: keyboardMove.photoId,
          targetGroupId: payload.sourceGroupId,
        });
        flashReceive(payload.sourceGroupId);
        setAnnouncement(`Moved photo ${keyboardMove.indexLabel}.`);
        setKeyboardMove(null);
      }
    },
    [keyboardMove, state.groups, dispatch, flashReceive],
  );

  const handleKeyboardSplit = useCallback(() => {
    if (!keyboardMove) return;
    dispatch({ type: 'MOVE_PHOTO_TO_NEW_GROUP', photoId: keyboardMove.photoId });
    setAnnouncement(`Photo ${keyboardMove.indexLabel} moved to a new bin.`);
    setKeyboardMove(null);
  }, [keyboardMove, dispatch]);

  const activeDrag = drag.phase === 'active' ? drag.drag : null;
  const showSplitZone = activeDrag !== null && activeDrag.sourceGroupSize > 1;
  const showKeyboardSplitButton = keyboardMove !== null && keyboardMove.sourceGroupSize > 1;
  const isSinglePhoto = totalPhotos === 1;

  let displayIndex = 0;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-6 space-y-1">
        <h2 className="text-[17px] font-semibold leading-tight text-[var(--text-primary)]">
          One {t.bin} per stack
        </h2>
        {!keyboardMove && (
          <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
            {isSinglePhoto
              ? `Add more photos to create several ${t.bins} at once.`
              : `Drag photos onto each other to put them in the same ${t.bin}.`}
          </p>
        )}
        {keyboardMove && (
          <p className="text-[13px] leading-snug text-[var(--accent)]">
            Moving photo {keyboardMove.indexLabel}. Press another photo, or{' '}
            <kbd className="rounded border border-[var(--border-flat)] bg-[var(--bg-input)] px-1 text-[11px]">
              Esc
            </kbd>{' '}
            to cancel.
          </p>
        )}
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onAddMore}
      />

      <div className="flex flex-wrap" style={{ gap: 10 }}>
        {state.groups.map((group, gi) => {
          const baseIndex = displayIndex;
          displayIndex += group.photos.length;
          return (
            <BinStack
              key={group.id}
              group={group}
              binNumber={gi + 1}
              t={t}
              baseDisplayIndex={baseIndex}
              activeDrag={activeDrag}
              keyboardMove={keyboardMove}
              isReceiving={recentlyReceivedId === group.id}
              onPhotoPointerDown={handlePhotoPointerDown}
              onPhotoKeyDown={handlePhotoKeyDown}
              onRemove={(photoId) => dispatch({ type: 'REMOVE_PHOTO', photoId })}
            />
          );
        })}
        {totalPhotos < effectiveMax && (
          <AddMoreTile onClick={() => fileInputRef.current?.click()} />
        )}
      </div>

      {showKeyboardSplitButton && keyboardMove && (
        <button
          type="button"
          onClick={handleKeyboardSplit}
          className="mt-4 self-start rounded-[var(--radius-md)] border border-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
        >
          Move photo {keyboardMove.indexLabel} to a new {t.bin}
        </button>
      )}

      <SplitZone
        visible={showSplitZone}
        active={activeDrag?.dropTarget?.type === 'split'}
        t={t}
      />

      <div className="mt-6 space-y-2">
        <Label className="text-[13px] font-medium text-[var(--text-primary)]">
          {t.Area}
          <span className="ml-1 text-[12px] font-normal text-[var(--text-tertiary)]">· optional</span>
        </Label>
        <AreaPicker
          locationId={locationId ?? undefined}
          value={state.sharedAreaId}
          onChange={(areaId) => dispatch({ type: 'SET_SHARED_AREA', areaId })}
        />
      </div>

      <div className="row-spread sticky bottom-0 -mx-5 mt-auto bg-[var(--bg-flat-heavy)] border-t border-[var(--border-subtle)] px-5 pt-3 pb-[calc(12px+var(--safe-bottom))]">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button onClick={onContinue} disabled={state.groups.length === 0}>
          Continue
        </Button>
      </div>

      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>

      {activeDrag && <DragGhost drag={activeDrag} />}
    </div>
  );
}

interface BinStackProps {
  group: Group;
  binNumber: number;
  t: ReturnType<typeof useTerminology>;
  baseDisplayIndex: number;
  activeDrag: ActiveDrag | null;
  keyboardMove: KeyboardMoveState | null;
  isReceiving: boolean;
  onPhotoPointerDown: (e: React.PointerEvent<HTMLDivElement>, payload: PointerPayload) => void;
  onPhotoKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, payload: KeyboardMoveState) => void;
  onRemove: (photoId: string) => void;
}

function BinStack({
  group,
  binNumber,
  t,
  baseDisplayIndex,
  activeDrag,
  keyboardMove,
  isReceiving,
  onPhotoPointerDown,
  onPhotoKeyDown,
  onRemove,
}: BinStackProps) {
  const count = group.photos.length;
  const countLabel = count === 1 ? '1 photo' : `${count} photos`;
  const hoverTarget =
    activeDrag?.dropTarget?.type === 'bin' && activeDrag.dropTarget.groupId === group.id;
  const isHoverFromOther = hoverTarget && activeDrag?.sourceGroupId !== group.id;
  const wouldExceed = isHoverFromOther && count + 1 > MAX_PHOTOS_PER_GROUP;
  const showValidRing = !!isHoverFromOther && !wouldExceed;
  const showRejectedRing = !!wouldExceed;

  return (
    <div className="flex flex-col items-center">
      {/* biome-ignore lint/a11y/useSemanticElements: <fieldset> requires a <legend> and imposes form-field semantics that don't fit a drag-and-drop canvas; role=group is the correct ARIA match for a labeled photo container */}
      <div
        data-bin-id={group.id}
        role="group"
        aria-label={`${t.Bin} ${binNumber}, ${countLabel}`}
        className={cn(
          'relative rounded-[6px] transition-[transform,box-shadow] duration-150',
          showValidRing &&
            'scale-[1.05] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-page)]',
          showRejectedRing &&
            'ring-2 ring-[var(--destructive)] ring-offset-2 ring-offset-[var(--bg-page)]',
          isReceiving && !showValidRing && !showRejectedRing && 'animate-stack-receive',
        )}
        style={{ width: BIN_SIZE, height: BIN_SIZE, overflow: 'visible' }}
      >
        {group.photos.map((photo, i) => {
          const layerFromTop = count - 1 - i;
          const depth = Math.min(layerFromTop, MAX_VISIBLE_LAYERS - 1);
          const isTop = layerFromTop === 0;
          const isSingle = count === 1;
          return (
            <StackedPhotoTile
              key={photo.id}
              photo={photo}
              indexLabel={baseDisplayIndex + i + 1}
              offsetX={isSingle ? 0 : PADDING + depth * SPREAD}
              offsetY={isSingle ? 0 : PADDING + depth * SPREAD}
              tileSize={isSingle ? BIN_SIZE : PHOTO_SIZE}
              depth={depth}
              zIndex={i + 1}
              isTop={isTop}
              isDragging={activeDrag?.photoId === photo.id}
              isKeyboardSelected={keyboardMove?.photoId === photo.id}
              sourceGroupId={group.id}
              sourceGroupSize={count}
              onPointerDown={onPhotoPointerDown}
              onKeyDown={onPhotoKeyDown}
              onRemove={() => onRemove(photo.id)}
            />
          );
        })}
        {count > 1 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center justify-center font-bold text-white"
            style={{
              top: PADDING - 9,
              left: PADDING + PHOTO_SIZE - 11,
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              border: '2px solid var(--bg-page)',
              fontSize: 11,
              zIndex: count + 10,
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }}
          >
            {count}
          </div>
        )}
      </div>
      <span className="mt-2 text-[11px] leading-tight text-[var(--text-tertiary)]">
        {t.Bin} {binNumber}
      </span>
    </div>
  );
}

interface StackedPhotoTileProps {
  photo: Photo;
  indexLabel: number;
  offsetX: number;
  offsetY: number;
  tileSize: number;
  depth: number;
  zIndex: number;
  isTop: boolean;
  isDragging: boolean;
  isKeyboardSelected: boolean;
  sourceGroupId: string;
  sourceGroupSize: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, payload: PointerPayload) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, payload: KeyboardMoveState) => void;
  onRemove: () => void;
}

const DEPTH_BRIGHTNESS = [1, 0.92, 0.84];
const DEPTH_SATURATION = [1, 0.9, 0.8];
const TOP_SHADOW = '0 4px 8px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12)';
const BACK_SHADOW = '0 1px 2px rgba(0,0,0,0.12)';

function StackedPhotoTile({
  photo,
  indexLabel,
  offsetX,
  offsetY,
  tileSize,
  depth,
  zIndex,
  isTop,
  isDragging,
  isKeyboardSelected,
  sourceGroupId,
  sourceGroupSize,
  onPointerDown,
  onKeyDown,
  onRemove,
}: StackedPhotoTileProps) {
  const payload: PointerPayload = {
    photoId: photo.id,
    sourceGroupId,
    sourceGroupSize,
    previewUrl: photo.previewUrl,
    indexLabel,
  };
  const keyboardPayload: KeyboardMoveState = {
    photoId: photo.id,
    sourceGroupId,
    sourceGroupSize,
    indexLabel,
  };
  const brightness = DEPTH_BRIGHTNESS[depth] ?? DEPTH_BRIGHTNESS[DEPTH_BRIGHTNESS.length - 1];
  const saturation = DEPTH_SATURATION[depth] ?? DEPTH_SATURATION[DEPTH_SATURATION.length - 1];
  const filter = isTop ? undefined : `brightness(${brightness}) saturate(${saturation})`;
  const shadow = isTop ? TOP_SHADOW : BACK_SHADOW;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a native <button> cannot host the nested Remove <button> child without invalid-DOM warnings, and drag semantics rely on preventing the button's default submit/activation behavior
    <div
      role="button"
      tabIndex={isTop ? 0 : -1}
      aria-label={`Photo ${indexLabel} — drag to group with another photo`}
      aria-grabbed={isDragging || undefined}
      onPointerDown={isTop ? (e) => onPointerDown(e, payload) : undefined}
      onKeyDown={isTop ? (e) => onKeyDown(e, keyboardPayload) : undefined}
      className={cn(
        'group absolute select-none',
        isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
        isDragging && 'opacity-30',
        isKeyboardSelected &&
          'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-page)] rounded-[var(--radius-sm)]',
      )}
      style={{
        top: 0,
        left: 0,
        width: tileSize,
        height: tileSize,
        transform: `translate(${offsetX}px, ${offsetY}px)`,
        touchAction: 'none',
        transition: isDragging ? 'none' : 'opacity 120ms',
        zIndex,
        filter,
      }}
    >
      <img
        src={photo.previewUrl}
        draggable={false}
        // biome-ignore lint/a11y/noRedundantAlt: accessible name must match /photo \d+/i for tests
        alt={`Photo ${indexLabel}`}
        className="pointer-events-none h-full w-full rounded-[var(--radius-sm)] object-cover"
        style={{ boxShadow: shadow }}
      />
      {isTop && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Remove photo ${indexLabel}`}
          className="absolute top-1 right-1 size-8 flex items-center justify-center rounded-[var(--radius-xs)] bg-[var(--overlay-button)] text-white opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity hover:bg-[var(--overlay-button-hover)] hover:text-[var(--destructive)]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface AddMoreTileProps {
  onClick: () => void;
}

function AddMoreTile({ onClick }: AddMoreTileProps) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        aria-label="Add more photos"
        className="flex flex-col items-center justify-center gap-1 rounded-[6px] border-2 border-dashed border-[var(--border-flat)] text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--bg-input)] hover:text-[var(--accent)]"
        style={{ width: BIN_SIZE, height: BIN_SIZE }}
      >
        <Plus className="h-5 w-5" />
        <span className="text-[11px] leading-tight">Add</span>
      </button>
    </div>
  );
}

interface SplitZoneProps {
  visible: boolean;
  active: boolean;
  t: ReturnType<typeof useTerminology>;
}

function SplitZone({ visible, active, t }: SplitZoneProps) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'overflow-hidden transition-[max-height,opacity] duration-200',
        visible ? 'mt-6 max-h-[80px] opacity-100' : 'mt-0 max-h-0 opacity-0',
      )}
    >
      <div
        data-split-zone
        className={cn(
          'rounded-[6px] border-2 border-dashed text-center transition-colors',
          visible ? 'pointer-events-auto' : 'pointer-events-none',
          active
            ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'
            : 'border-[var(--border-flat)] text-[var(--text-secondary)]',
        )}
        style={{ padding: 16, fontSize: 12, fontWeight: 500 }}
      >
        Drop here to put this photo in its own {t.bin}
      </div>
    </div>
  );
}

interface DragGhostProps {
  drag: ActiveDrag;
}

function DragGhost({ drag }: DragGhostProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px) scale(1.08) rotate(-2deg)`,
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        pointerEvents: 'none',
        zIndex: 100,
        willChange: 'transform',
      }}
    >
      <img
        src={drag.previewUrl}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.18)',
        }}
      />
    </div>,
    document.body,
  );
}
