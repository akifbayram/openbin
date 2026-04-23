import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { addBin } from '@/features/bins/useBins';
import { createLocation } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';
import { binItemsToPayload } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { getErrorMessage } from '@/lib/utils';
import type { BinItem } from '@/types';
import type { OnboardingActions } from './onboardingConstants';
import { markDemoTourDone } from './onboardingConstants';

export interface OnboardingState {
  t: ReturnType<typeof useTerminology>;
  navigate: ReturnType<typeof useNavigate>;
  // Step 0 state
  locationName: string;
  setLocationName: (v: string) => void;
  // Step 1 state
  binName: string;
  setBinName: (v: string) => void;
  binItems: BinItem[];
  setBinItems: (v: BinItem[]) => void;
  // Step 2 state (populated after bin creation)
  newBinId: string | null;
  // Loading
  loading: boolean;
  // Step transition
  displayedStep: number;
  transitioning: boolean;
  // Handlers
  handleCreateLocation: () => void;
  handleCreateBin: () => void;
  handleSkipSetup: () => void;
}

export function useOnboardingActions(props: OnboardingActions): OnboardingState {
  const { step, locationId, advanceWithLocation, advanceStep, complete, demoMode } = props;
  const t = useTerminology();
  const navigate = useNavigate();
  const { setActiveLocationId } = useAuth();
  const { showToast } = useToast();

  // Step 0 state
  const [locationName, setLocationName] = useState('');
  // Step 1 state
  const [binName, setBinName] = useState('');
  const [binItems, setBinItems] = useState<BinItem[]>([]);
  // Step 2 state — set once the bin is created so the completion step can deep-link to it
  const [newBinId, setNewBinId] = useState<string | null>(null);
  // Loading
  const [loading, setLoading] = useState(false);
  // Step transition
  const [displayedStep, setDisplayedStep] = useState(step);
  const transitioning = step !== displayedStep;

  useEffect(() => {
    if (step === displayedStep) return;
    const timer = setTimeout(() => setDisplayedStep(step), 200);
    return () => clearTimeout(timer);
  }, [step, displayedStep]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function handleCreateLocation() {
    if (!locationName.trim()) return;
    setLoading(true);
    try {
      const loc = await createLocation(locationName.trim());
      advanceWithLocation(loc.id);
      setActiveLocationId(loc.id);
    } catch (err) {
      showToast({ message: getErrorMessage(err, `Failed to create ${t.location}`), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBin() {
    if (!locationId || !binName.trim()) return;
    setLoading(true);
    try {
      const bin = await addBin({
        name: binName.trim(),
        locationId,
        items: binItems.length > 0 ? binItemsToPayload(binItems) : undefined,
      });
      setNewBinId(bin.id);
      advanceStep();
    } catch (err) {
      showToast({ message: getErrorMessage(err, `Failed to create ${t.bin}`), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipSetup() {
    setLoading(true);
    try {
      if (!locationId && !demoMode) {
        const loc = await createLocation(`My ${t.Location}`);
        setActiveLocationId(loc.id);
      }
      if (demoMode) markDemoTourDone();
      complete();
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to skip setup'), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return {
    t, navigate,
    locationName, setLocationName,
    binName, setBinName,
    binItems, setBinItems,
    newBinId,
    loading,
    displayedStep, transitioning,
    handleCreateLocation, handleCreateBin, handleSkipSetup,
  };
}
