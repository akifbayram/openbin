import { createContext, useContext } from 'react';
import { useTagColors } from './useTagColors';

interface TagColorsContextValue {
  tagColors: Map<string, string>;
  tagParents: Map<string, string>;
  isLoading: boolean;
}

const TagColorsContext = createContext<TagColorsContextValue>({
  tagColors: new Map(),
  tagParents: new Map(),
  isLoading: false,
});

export function TagColorsProvider({ children }: { children: React.ReactNode }) {
  const { tagColors, tagParents, isLoading } = useTagColors();

  return (
    <TagColorsContext.Provider value={{ tagColors, tagParents, isLoading }}>
      {children}
    </TagColorsContext.Provider>
  );
}

export function useTagColorsContext() {
  return useContext(TagColorsContext);
}
