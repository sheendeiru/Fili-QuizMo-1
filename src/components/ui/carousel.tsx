"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type CarouselItem = {
  src: string;
  alt: string;
  caption: string;
};

type CarouselProps = {
  items: CarouselItem[];
};

export function Carousel({ items }: CarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback(
    (nextIndex: number) => {
      setIndex(((nextIndex % items.length) + items.length) % items.length);
    },
    [items.length]
  );

  const next = useCallback(() => {
    setIndex((prevIndex) => (prevIndex + 1) % items.length);
  }, [items.length]);
  const prev = useCallback(() => {
    setIndex((prevIndex) => (prevIndex - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (paused) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [paused, items.length]);

  return (
    <div
      className="mx-auto w-full max-w-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* bordered carousel box */}
      <div className="relative overflow-hidden border-2 border-ink bg-surface shadow-[3px_3px_0_var(--color-ink)]">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {items.map((slide) => (
            <div key={slide.src} className="w-full shrink-0 bg-surface">
              <div className="relative h-56 w-full overflow-hidden bg-sky-bottom sm:h-64">
                <Image
                  src={slide.src}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 768px) 100vw, 896px"
                  className="scale-110 object-cover opacity-25 blur-2xl"
                />
                <div className="relative flex h-full items-center justify-center px-4 py-4">
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 896px"
                    className="object-contain"
                  />
                </div>
              </div>
              <div className="px-4 pb-4 pt-3 text-ink">
                <h3 className="text-base font-bold sm:text-lg">{slide.caption}</h3>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={prev}
          aria-label="Previous slide"
          className="absolute left-2 top-1/2 -translate-y-1/2 border-2 border-ink bg-surface p-2 text-ink shadow-[2px_2px_0_var(--color-ink)]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="absolute right-2 top-1/2 -translate-y-1/2 border-2 border-ink bg-surface p-2 text-ink shadow-[2px_2px_0_var(--color-ink)]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* dots below the box */}
      <div className="mt-4 flex justify-center gap-2">
        {items.map((slide, slideIndex) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => goTo(slideIndex)}
            aria-label={`Go to slide ${slideIndex + 1}`}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              slideIndex === index ? "bg-ink" : "bg-ink/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}