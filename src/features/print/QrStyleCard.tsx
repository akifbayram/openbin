import { ChevronDown, QrCode, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { Label } from '@/components/ui/label';
import { OptionGroup } from '@/components/ui/option-group';
import { Switch } from '@/components/ui/switch';
import { HueGradientPicker } from '@/features/bins/ColorPicker';
import { buildColorKey, hexToHsl, resolveColor, SHADE_COUNT } from '@/lib/colorPalette';
import { cn } from '@/lib/utils';
import { CARD_PAD_RATIO, CARD_RADIUS_RATIO } from './pdfConstants';
import type { QrStyleOptions } from './usePrintSettings';
import { DEFAULT_QR_STYLE, isDefaultQrStyle } from './usePrintSettings';

const DOT_TYPES: { key: QrStyleOptions['dotType']; label: string }[] = [
  { key: 'square', label: 'Square' },
  { key: 'rounded', label: 'Rounded' },
  { key: 'dots', label: 'Dots' },
  { key: 'classy', label: 'Classy' },
  { key: 'classy-rounded', label: 'Classy R.' },
  { key: 'extra-rounded', label: 'Extra R.' },
];

const CORNER_SQUARE_TYPES: { key: string; label: string }[] = [
  { key: '', label: 'Auto' },
  { key: 'square', label: 'Square' },
  { key: 'dot', label: 'Rounded' },
  { key: 'extra-rounded', label: 'Extra R.' },
];

const CORNER_DOT_TYPES: { key: string; label: string }[] = [
  { key: '', label: 'Auto' },
  { key: 'square', label: 'Square' },
  { key: 'dot', label: 'Rounded' },
];

const ERROR_LEVELS: { key: QrStyleOptions['errorCorrection']; label: string }[] = [
  { key: 'L', label: 'L' },
  { key: 'M', label: 'M' },
  { key: 'Q', label: 'Q' },
  { key: 'H', label: 'H' },
];

interface QrStyleCardProps {
  qrStyle: QrStyleOptions;
  onUpdateStyle: (style: QrStyleOptions) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

const QR_PREVIEW_SIZE = 140;
const QR_PREVIEW_PAD = Math.round(QR_PREVIEW_SIZE * CARD_PAD_RATIO);
const QR_PREVIEW_OUTER = QR_PREVIEW_SIZE + QR_PREVIEW_PAD * 2;
const QR_PREVIEW_RADIUS = Math.round(QR_PREVIEW_OUTER * CARD_RADIUS_RATIO);

function MiniPreview({ style }: { style: QrStyleOptions }) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [prevUrl, setPrevUrl] = useState<string>('');
  const [transitioning, setTransitioning] = useState(false);
  const styleKey = JSON.stringify(style);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const { generateStyledQRDataURL } = await import('@/lib/styledQr');
        const url = await generateStyledQRDataURL('DEMO01', 280, style);
        if (cancelled) return;

        if (dataUrl) {
          setPrevUrl(dataUrl);
          setTransitioning(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setPrevUrl('');
            setTransitioning(false);
          }, 250);
        }
        setDataUrl(url);
      } catch {
        // Silently fail — preview is non-critical
      }
    }

    render();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [styleKey]);

  return (
    <div className="flex items-center justify-center py-1">
      <div
        className="relative bg-white dark:bg-[#f8f8f8] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
        style={{
          padding: QR_PREVIEW_PAD,
          borderRadius: QR_PREVIEW_RADIUS,
        }}
      >
        {/* Previous image (crossfade out) */}
        {transitioning && prevUrl && (
          <img
            src={prevUrl}
            alt=""
            className="absolute inset-0 m-auto transition-opacity duration-250 opacity-0"
            style={{ width: QR_PREVIEW_SIZE, height: QR_PREVIEW_SIZE }}
          />
        )}

        {/* Current image */}
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="QR preview"
            className="transition-opacity duration-250"
            style={{
              width: QR_PREVIEW_SIZE,
              height: QR_PREVIEW_SIZE,
              opacity: 1,
            }}
          />
        ) : (
          <div
            className="rounded-[var(--radius-xs)] bg-[var(--bg-input)] animate-pulse"
            style={{ width: QR_PREVIEW_SIZE, height: QR_PREVIEW_SIZE }}
          />
        )}
      </div>
    </div>
  );
}

/** Convert a hex color to the nearest color key for HueGradientPicker. */
function hexToColorKey(hex: string): string {
  if (!hex) return '';
  const lower = hex.toLowerCase();
  if (lower === '#000000' || lower === '#1c1c1e') return 'black';
  if (lower === '#f2f2f7' || lower === '#ffffff') return 'white';

  const { h, s, l } = hexToHsl(hex);
  const hue = s < 10 ? 'neutral' as const : h;
  const shadeLightness = [72, 62, 52, 42, 32];
  let bestShade = 2;
  let bestDist = Infinity;
  for (let i = 0; i < SHADE_COUNT; i++) {
    const dist = Math.abs(l - shadeLightness[i]);
    if (dist < bestDist) { bestDist = dist; bestShade = i; }
  }
  return buildColorKey(hue, bestShade);
}

function QrColorPicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [colorKey, setColorKey] = useState(() => hexToColorKey(value));

  useEffect(() => {
    setColorKey(hexToColorKey(value));
  }, [value]);

  function handleChange(key: string) {
    setColorKey(key);
    if (key) {
      const preset = resolveColor(key);
      onChange(preset?.dot ?? '#000000');
    }
  }

  return (
    <div>
      <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">{label}</span>
      <HueGradientPicker value={colorKey} onChange={handleChange} />
    </div>
  );
}

/** Check whether any advanced QR setting differs from default. */
function hasAdvancedChanges(style: QrStyleOptions): boolean {
  return (
    style.cornerSquareType !== DEFAULT_QR_STYLE.cornerSquareType ||
    style.cornerSquareColor !== DEFAULT_QR_STYLE.cornerSquareColor ||
    style.cornerDotType !== DEFAULT_QR_STYLE.cornerDotType ||
    style.cornerDotColor !== DEFAULT_QR_STYLE.cornerDotColor ||
    style.useGradient !== DEFAULT_QR_STYLE.useGradient ||
    style.errorCorrection !== DEFAULT_QR_STYLE.errorCorrection
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
      {children}
    </span>
  );
}

export function QrStyleCard({ qrStyle, onUpdateStyle, expanded, onExpandedChange }: QrStyleCardProps) {
  function update<K extends keyof QrStyleOptions>(key: K, value: QrStyleOptions[K]) {
    onUpdateStyle({ ...qrStyle, [key]: value });
  }

  const advancedModified = hasAdvancedChanges(qrStyle);

  return (
    <Card>
      <CardContent>
        <button
          type="button"
          className="flex items-center justify-between w-full"
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-[var(--text-tertiary)]" />
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">QR Style</Label>
          </div>
          <ChevronDown className={cn(
            'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
            expanded && 'rotate-180',
          )} />
        </button>

        {expanded && (
          <div className="mt-3 space-y-4">
            <MiniPreview style={qrStyle} />

            {/* Dot Style */}
            <div className="px-1">
              <SectionLabel>Dot Style</SectionLabel>
              <OptionGroup
                options={DOT_TYPES}
                value={qrStyle.dotType}
                onChange={(v) => update('dotType', v)}
                size="sm"
              />
            </div>

            {/* Dot Color */}
            <div className="px-1">
              <QrColorPicker value={qrStyle.dotColor} onChange={(v) => update('dotColor', v)} label="Dot Color" />
            </div>

            {/* Advanced */}
            <div className="px-1">
              <Disclosure label="Advanced" indicator={advancedModified}>
                <div className="space-y-3">
                  {/* Corner Square Style */}
                  <div>
                    <SectionLabel>Corner Square Style</SectionLabel>
                    <OptionGroup
                      options={CORNER_SQUARE_TYPES}
                      value={qrStyle.cornerSquareType}
                      onChange={(v) => update('cornerSquareType', v as QrStyleOptions['cornerSquareType'])}
                      size="sm"
                    />
                    {qrStyle.cornerSquareType && (
                      <div className="mt-3">
                        <QrColorPicker value={qrStyle.cornerSquareColor} onChange={(v) => update('cornerSquareColor', v)} label="Corner Square Color" />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[var(--border-subtle)]" />

                  {/* Corner Dot Style */}
                  <div>
                    <SectionLabel>Corner Dot Style</SectionLabel>
                    <OptionGroup
                      options={CORNER_DOT_TYPES}
                      value={qrStyle.cornerDotType}
                      onChange={(v) => update('cornerDotType', v as QrStyleOptions['cornerDotType'])}
                      size="sm"
                    />
                    {qrStyle.cornerDotType && (
                      <div className="mt-3">
                        <QrColorPicker value={qrStyle.cornerDotColor} onChange={(v) => update('cornerDotColor', v)} label="Corner Dot Color" />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[var(--border-subtle)]" />

                  {/* Gradient */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <SectionLabel>Gradient</SectionLabel>
                      <Switch checked={qrStyle.useGradient} onCheckedChange={(v) => update('useGradient', v)} />
                    </div>
                    {qrStyle.useGradient && (
                      <div className="space-y-3 mt-1">
                        <OptionGroup
                          options={[
                            { key: 'linear' as const, label: 'Linear' },
                            { key: 'radial' as const, label: 'Radial' },
                          ]}
                          value={qrStyle.gradientType}
                          onChange={(v) => update('gradientType', v)}
                          size="sm"
                        />
                        <QrColorPicker value={qrStyle.gradientColor1} onChange={(v) => update('gradientColor1', v)} label="Start Color" />
                        <QrColorPicker value={qrStyle.gradientColor2} onChange={(v) => update('gradientColor2', v)} label="End Color" />
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] text-[var(--text-secondary)] font-medium">Rotation</span>
                            <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums font-medium">{qrStyle.gradientRotation}°</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={360}
                            step={15}
                            value={qrStyle.gradientRotation}
                            onChange={(e) => update('gradientRotation', parseInt(e.target.value, 10))}
                            className="qr-range-slider w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[var(--border-subtle)]" />

                  {/* Error Correction */}
                  <div>
                    <SectionLabel>Error Correction</SectionLabel>
                    <OptionGroup
                      options={ERROR_LEVELS}
                      value={qrStyle.errorCorrection}
                      onChange={(v) => update('errorCorrection', v)}
                      size="sm"
                    />
                  </div>
                </div>
              </Disclosure>
            </div>

            {/* Reset */}
            {!isDefaultQrStyle(qrStyle) && (
              <div className="px-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateStyle({ ...DEFAULT_QR_STYLE })}
                  className="w-full"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset QR Style
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
