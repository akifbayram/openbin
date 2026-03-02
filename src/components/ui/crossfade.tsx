interface CrossfadeProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}

export function Crossfade({ isLoading, skeleton, children }: CrossfadeProps) {
  if (isLoading) {
    return <>{skeleton}</>;
  }

  return <div className="flex flex-col gap-4">{children}</div>;
}
