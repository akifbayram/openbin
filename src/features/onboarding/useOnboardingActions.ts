import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { createArea } from '@/features/areas/useAreas';
import { addBin } from '@/features/bins/useBins';
import { createLocation } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';
import { binItemsToPayload } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { getErrorMessage } from '@/lib/utils';
import type { Bin, BinItem } from '@/types';
import type { OnboardingActions } from './onboardingConstants';

export interface OnboardingState {
  t: ReturnType<typeof useTerminology>;
  navigate: ReturnType<typeof useNavigate>;
  // Step 0 state
  locationName: string;
  setLocationName: (v: string) => void;
  areaNames: string[];
  areaInput: string;
  setAreaInput: (v: string) => void;
  showAreaInput: boolean;
  setShowAreaInput: (v: boolean) => void;
  // Step 1 state
  binName: string;
  setBinName: (v: string) => void;
  binItems: BinItem[];
  setBinItems: (v: BinItem[]) => void;
  binAreaId: string | null;
  setBinAreaId: (v: string | null) => void;
  // Loading & created bin
  loading: boolean;
  createdBin: Bin | null;
  // Step transition
  displayedStep: number;
  transitioning: boolean;
  // Handlers
  handleAddArea: () => void;
  handleRemoveArea: (name: string) => void;
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
  const [areaNames, setAreaNames] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState('');
  const [showAreaInput, setShowAreaInput] = useState(false);
  // Step 1 state
  const [binName, setBinName] = useState('');
  const [binItems, setBinItems] = useState<BinItem[]>([]);
  const [binAreaId, setBinAreaId] = useState<string | null>(null);
  // Loading
  const [loading, setLoading] = useState(false);
  // Created bin for QR preview
  const [createdBin, setCreatedBin] = useState<Bin | null>(null);
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

  // If we reach QR step without a created bin (e.g. page refresh), auto-advance
  useEffect(() => {
    if (step === 2 && !createdBin && !demoMode) {
      advanceStep();
    }
  }, [step, createdBin, advanceStep, demoMode]);

  function handleAddArea() {
    const name = areaInput.trim();
    if (!name || areaNames.includes(name)) return;
    setAreaNames((prev) => [...prev, name]);
    setAreaInput('');
  }

  function handleRemoveArea(name: string) {
    setAreaNames((prev) => prev.filter((a) => a !== name));
  }

  async function handleCreateLocation() {
    if (!locationName.trim()) return;
    setLoading(true);
    try {
      const loc = await createLocation(locationName.trim());
      advanceWithLocation(loc.id);
      setActiveLocationId(loc.id);
      for (const name of areaNames) {
        try {
          await createArea(loc.id, name);
        } catch {
          // Skip failures
        }
      }
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
        areaId: binAreaId,
      });
      setCreatedBin(bin);
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
    areaNames, areaInput, setAreaInput,
    showAreaInput, setShowAreaInput,
    binName, setBinName,
    binItems, setBinItems,
    binAreaId, setBinAreaId,
    loading, createdBin,
    displayedStep, transitioning,
    handleAddArea, handleRemoveArea,
    handleCreateLocation, handleCreateBin, handleSkipSetup,
  };
}
