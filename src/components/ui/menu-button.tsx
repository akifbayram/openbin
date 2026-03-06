import { Box } from '@chakra-ui/react';
import { useDrawer } from '@/features/layout/DrawerContext';

export function MenuButton({ className }: { className?: string }) {
  const { openDrawer, isOnboarding } = useDrawer();

  if (isOnboarding) return null;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label="Open navigation"
      className={`lg:hidden print-hide flex flex-col justify-center items-center gap-[5px] w-10 h-10 rounded-[var(--radius-sm)] transition-colors hover:bg-gray-500/8 dark:hover:bg-gray-500/18 shrink-0${className ? ` ${className}` : ''}`}
    >
      <Box as="span" display="block" w="18px" h="2px" borderRadius="full" bg="var(--text-primary)" />
      <Box as="span" display="block" w="18px" h="2px" borderRadius="full" bg="var(--text-primary)" />
    </button>
  );
}
