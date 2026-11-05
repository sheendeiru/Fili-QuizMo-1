"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { PixelLoader } from "./pixel-loader";

type NavigationContextValue = {
  navigate: (action: () => void) => void;
  beginActivity: () => () => void;
  isLinkPending: (id: string) => boolean;
  setLinkPending: (id: string, pending: boolean) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [transitionPending, startTransition] = useTransition();
  const [pendingLinks, setPendingLinks] = useState<Set<string>>(() => new Set());
  const [showProgress, setShowProgress] = useState(false);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const activityId = useRef(0);

  const setLinkPending = useCallback((id: string, pending: boolean) => {
    setPendingLinks((current) => {
      if (current.has(id) === pending) return current;
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const navigate = useCallback((action: () => void) => {
    startTransition(action);
  }, [startTransition]);
  const beginActivity = useCallback(() => {
    const id = `activity-${++activityId.current}`;
    setLinkPending(id, true);
    let active = true;

    return () => {
      if (!active) return;
      active = false;
      setLinkPending(id, false);
    };
  }, [setLinkPending]);
  const isLinkPending = useCallback(
    (id: string) => pendingLinks.has(id),
    [pendingLinks],
  );
  const value = useMemo(
    () => ({ navigate, beginActivity, isLinkPending, setLinkPending }),
    [beginActivity, isLinkPending, navigate, setLinkPending],
  );
  const pending = transitionPending || pendingLinks.size > 0;

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (pending && !showProgress) {
      timer.current = window.setTimeout(() => {
        startedAt.current = Date.now();
        setShowProgress(true);
      }, 150);
    } else if (!pending && showProgress) {
      timer.current = window.setTimeout(() => {
        setShowProgress(false);
      }, Math.max(0, 300 - (Date.now() - startedAt.current)));
    }
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [pending, showProgress]);

  return (
    <NavigationContext.Provider value={value}>
      <div aria-busy={pending || undefined}>
        {showProgress ? (
          <div
            role="progressbar"
            aria-label="Loading page"
            aria-valuemin={0}
            aria-valuemax={12}
            aria-valuenow={4}
            aria-valuetext="Loading"
            className="fixed inset-x-0 top-0 z-[60] flex h-[6px] gap-1 bg-px-indigo-lt"
          >
            {Array.from({ length: 12 }, (_, index) => (
              <span
                key={index}
                className={`h-full min-w-0 flex-1 ${
                  index < 12
                    ? "pixel-progress-segment bg-px-gold"
                    : "bg-px-indigo-lt"
                }`}
              />
            ))}
          </div>
        ) : null}
        {showProgress && transitionPending ? (
          <div className="pointer-events-none fixed inset-0 z-[90] bg-px-ink/70">
            <PixelLoader
              label="Loading next page..."
              variant="screen"
              delayMs={0}
            />
          </div>
        ) : null}
        {children}
      </div>
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("useNavigation requires NavigationProvider.");
  return context;
}

export function useOptionalNavigation() {
  return useContext(NavigationContext);
}
