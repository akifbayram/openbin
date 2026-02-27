import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TagInput } from './TagInput';
import { ItemsInput } from './ItemsInput';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { StylePicker } from './StylePicker';
import { VisibilityPicker } from './VisibilityPicker';
import { BinPreviewCard } from './BinPreviewCard';
import { getSecondaryColorInfo, setSecondaryColor } from '@/lib/cardStyle';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useAreaList } from '@/features/areas/useAreas';
import { useTerminology } from '@/lib/terminology';
import type { useEditBinForm } from './useEditBinForm';
import type { Photo } from '@/types';

interface BinEditContentProps {
  edit: ReturnType<typeof useEditBinForm>;
  photosSection: ReactNode;
  photos: Photo[];
  allTags: string[];
  aiEnabled: boolean;
  aiConfigured: boolean;
  activeLocationId: string | undefined;
  canChangeVisibility: boolean;
  onAiSetupNeeded: () => void;
}

export function BinEditContent({
  edit,
  photosSection,
  photos,
  allTags,
  aiEnabled,
  aiConfigured,
  activeLocationId,
  canChangeVisibility,
  onAiSetupNeeded,
}: BinEditContentProps) {
  const t = useTerminology();
  const { areas } = useAreaList(activeLocationId);
  const editAreaName = areas.find((a) => a.id === edit.areaId)?.name;
  const secondaryInfo = getSecondaryColorInfo(edit.cardStyle);

  return (
    <div className="fade-in-fast contents">
      {/* Items */}
      <Card>
        <CardContent className="space-y-2 py-5">
          <Label>Items</Label>
          <ItemsInput
            items={edit.items}
            onChange={edit.setItems}
            showAi={aiEnabled}
            aiConfigured={aiConfigured}
            onAiSetupNeeded={onAiSetupNeeded}
            binName={edit.name}
            locationId={activeLocationId}
          />
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="space-y-2 py-5">
          <Label htmlFor="edit-notes">Notes</Label>
          <Textarea
            id="edit-notes"
            value={edit.notes}
            onChange={(e) => edit.setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Organization: Area + Tags */}
      <Card>
        <CardContent className="space-y-5 py-5">
          <div className="space-y-2">
            <Label>{t.Area}</Label>
            <AreaPicker locationId={activeLocationId} value={edit.areaId} onChange={edit.setAreaId} />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput tags={edit.tags} onChange={edit.setTags} suggestions={allTags} />
          </div>
        </CardContent>
      </Card>

      {photosSection}

      {/* Appearance — icon, color, style */}
      <Card>
        <CardContent className="space-y-5 py-5">
          <div className="space-y-2">
            <Label>Preview</Label>
            <BinPreviewCard
              name={edit.name}
              color={edit.color}
              items={edit.items}
              tags={edit.tags}
              icon={edit.icon}
              cardStyle={edit.cardStyle}
              areaName={editAreaName}
            />
          </div>
          <div className="space-y-2">
            <Label>Icon</Label>
            <IconPicker value={edit.icon} onChange={edit.setIcon} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker
              value={edit.color}
              onChange={edit.setColor}
              secondaryLabel={secondaryInfo?.label}
              secondaryValue={secondaryInfo?.value}
              onSecondaryChange={secondaryInfo ? (c) => edit.setCardStyle(setSecondaryColor(edit.cardStyle, c)) : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label>Style</Label>
            <StylePicker value={edit.cardStyle} color={edit.color} onChange={edit.setCardStyle} photos={photos} />
          </div>
        </CardContent>
      </Card>

      {/* Visibility */}
      {canChangeVisibility && (
        <Card>
          <CardContent className="space-y-2 py-5">
            <Label>Visibility</Label>
            <VisibilityPicker value={edit.visibility} onChange={edit.setVisibility} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
