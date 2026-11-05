"use client";

import Image from "next/image";
import { useState } from "react";
import { PixelAvatar, PixelCard } from "@/components/pixel";

type TeamCardProps = {
  image?: string | null;
  name: string;
  role: string;
};

export function TeamCard({ image, name, role }: TeamCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <PixelCard
      as="article"
      className="group flex h-full flex-col overflow-hidden p-0 transition-transform duration-100 ease-[steps(2,end)] hover:-translate-y-1"
    >
      <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-px-night">
        {image && !imageFailed ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImageFailed(true)}
            className="pixel-sprite object-cover"
          />
        ) : (
          <PixelAvatar name={name} className="w-2/3" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="flex-1 text-center text-sm font-semibold leading-tight text-px-text-dark sm:text-base">
          {name}
        </h3>
        <p className="pixel-border mt-3 flex min-h-11 w-full items-center justify-center border border-px-gold-dk bg-px-gold px-2.5 py-1 text-center text-sm font-semibold leading-5 text-px-text-dark sm:px-3">
          {role}
        </p>
      </div>

    </PixelCard>
  );
}
