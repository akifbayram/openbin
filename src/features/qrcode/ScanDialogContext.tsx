import { createContext, useContext } from 'react';

interface ScanDialogContextValue {
  openScanDialog: () => void;
}

export const ScanDialogContext = createContext<ScanDialogContextValue>({
  openScanDialog: () => {},
});

export function useScanDialog() {
  return useContext(ScanDialogContext);
}
