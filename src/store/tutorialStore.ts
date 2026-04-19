import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TutorialState {
  hasSeenTutorial: boolean;
  isActive: boolean;
  currentStep: number;
  startTutorial: () => void;
  skipTutorial: () => void;
  nextStep: () => void;
  endTutorial: () => void;
  resetTutorial: () => void;
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      hasSeenTutorial: false,
      isActive: false,
      currentStep: 0,
      startTutorial: () => set({ hasSeenTutorial: true, isActive: true, currentStep: 0 }),
      skipTutorial: () => set({ hasSeenTutorial: true, isActive: false }),
      nextStep: () =>
        set((s) => {
          const next = s.currentStep + 1;
          return { currentStep: next, isActive: true };
        }),
      endTutorial: () => set({ isActive: false }),
      resetTutorial: () => set({ hasSeenTutorial: false, isActive: false, currentStep: 0 }),
    }),
    {
      name: 'rechnungs-manager-tutorial',
      partialize: (state) => ({ hasSeenTutorial: state.hasSeenTutorial }),
    }
  )
);

