"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PixelButton, PixelCard } from "@/components/ui/pixel-primitives";
import { parseAchievements, type Achievement } from "@/lib/dashboard/achievements";
import {
  createSessionRequestController,
  releaseSessionRequestController,
} from "@/lib/auth/session-state";

/** Loads only when opened, using the mobile app's saved awards and artwork. */
export function BadgesSection() {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = createSessionRequestController();
    async function load() {
      try {
        const response = await fetch("/api/student-achievements", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Achievements could not sync.");
        const data = parseAchievements(await response.json());
        if (!controller.signal.aborted) setAchievements(data);
      } catch {
        if (!controller.signal.aborted) {
          setError("Achievements could not sync. Your quiz results are saved.");
        }
      } finally {
        releaseSessionRequestController(controller);
      }
    }
    void load();
    return () => {
      controller.abort();
      releaseSessionRequestController(controller);
    };
  }, [retry]);

  const earned = achievements?.filter((item) => item.unlockedAt !== null).length ?? 0;

  return (
    <section aria-labelledby="achievements-heading" className="space-y-4">
      <header className="text-center">
        <h2 id="achievements-heading" className="text-xl font-bold text-foreground">Achievements</h2>
        {achievements ? <p className="mt-1 text-sm text-px-muted">{earned} of {achievements.length} unlocked</p> : null}
      </header>
      {error ? (
        <PixelCard className="text-center">
          <p role="alert" className="text-sm">{error}</p>
          <PixelButton className="mt-3" onClick={() => { setError(""); setRetry((value) => value + 1); }}>Retry</PixelButton>
        </PixelCard>
      ) : achievements === null ? (
        <p role="status" className="py-8 text-center text-sm text-px-muted">Loading achievements...</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {achievements.map((item) => {
            const unlocked = item.unlockedAt !== null;
            return (
              <li key={item.id}>
                <PixelCard as="article" className="flex h-full flex-col gap-3">
                  <Image
                    src={`/assets/achievements/${item.id}_${unlocked ? "unlocked" : "locked"}.png`}
                    alt={`${item.name}: ${unlocked ? "unlocked" : "locked"}`}
                    width={132}
                    height={132}
                    className="mx-auto h-[132px] w-full object-contain"
                  />
                  <h3 className="text-center text-base font-bold">{item.name}</h3>
                  <p className="text-sm text-px-muted">{item.requirement}</p>
                  <p className={`mt-auto border-t-2 border-ink/15 pt-3 text-sm font-semibold ${unlocked ? "text-foreground" : "text-px-muted"}`}>
                    {item.unlockedAt ? <>Unlocked &bull; <time dateTime={item.unlockedAt}>{new Date(item.unlockedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time></> : <>Locked &bull; {item.progress}</>}
                  </p>
                </PixelCard>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
