"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";

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

  const item = items[index];

  return (
    <div
      className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-primary shadow-lg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {items.map((slide) => (
          <div
            key={slide.src}
            className="relative h-[30rem] w-full shrink-0 overflow-hidden bg-primary md:h-[34rem]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.src}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
            />
            <div className="relative flex h-full items-center justify-center px-6 pb-28 pt-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.src}
                alt={slide.alt}
                className="max-h-full w-auto max-w-full rounded-xl object-contain shadow-2xl ring-1 ring-white/20"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary via-primary/90 to-transparent px-6 pb-12 pt-16 text-white md:px-8">
              <BrandLogo className="h-10 w-40" />
              <h3 className="mt-2 text-2xl font-bold md:text-3xl">
                {slide.caption}
              </h3>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 text-primary shadow-md transition hover:bg-white"
      >
        <svg
          className="h-6 w-6"
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
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 text-primary shadow-md transition hover:bg-white"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {items.map((slide, slideIndex) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => goTo(slideIndex)}
            aria-label={`Go to slide ${slideIndex + 1}`}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              slideIndex === index ? "bg-white" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
