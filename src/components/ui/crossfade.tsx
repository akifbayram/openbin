import { useEffect, useRef, useState } from 'react';

interface CrossfadeProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}

export function Crossfade({ isLoading, skeleton, children }: CrossfadeProps) {
  const wasLoading = useRef(true);
  const [showContent, setShowContent] = useState(!isLoading);

  useEffect(() => {
    if (wasLoading.current && !isLoading) {
      const id = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(id);
    }
    if (isLoading) {
      setShowContent(false);
    }
    wasLoading.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    wasLoading.current = isLoading;
  });

  if (isLoading) {
    return <>{skeleton}</>;
  }

  return (
    <div className={`flex flex-col gap-4 ${showContent ? 'animate-fade-in-up' : 'opacity-0'}`}>
      {children}
    </div>
  );
}
