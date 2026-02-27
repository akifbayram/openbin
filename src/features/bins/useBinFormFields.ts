import { useState } from 'react';
import type { BinVisibility } from '@/types';

export interface BinFormFields {
  name: string; setName: (v: string) => void;
  areaId: string | null; setAreaId: (v: string | null) => void;
  items: string[]; setItems: (v: string[]) => void;
  notes: string; setNotes: (v: string) => void;
  tags: string[]; setTags: (v: string[]) => void;
  icon: string; setIcon: (v: string) => void;
  color: string; setColor: (v: string) => void;
  cardStyle: string; setCardStyle: (v: string) => void;
  visibility: BinVisibility; setVisibility: (v: BinVisibility) => void;
}

interface UseBinFormFieldsOptions {
  initialName?: string;
}

export function useBinFormFields(options?: UseBinFormFieldsOptions): BinFormFields {
  const [name, setName] = useState(options?.initialName ?? '');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [cardStyle, setCardStyle] = useState('');
  const [visibility, setVisibility] = useState<BinVisibility>('location');

  return {
    name, setName,
    areaId, setAreaId,
    items, setItems,
    notes, setNotes,
    tags, setTags,
    icon, setIcon,
    color, setColor,
    cardStyle, setCardStyle,
    visibility, setVisibility,
  };
}
