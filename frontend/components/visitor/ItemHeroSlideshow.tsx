"use client";

import { useEffect, useState } from "react";

interface ItemHeroSlideshowProps {
  images: string[];
  active: boolean;
  alt: string;
  fallbackLabel?: string;
}

const SLIDE_MS = 4000;

export default function ItemHeroSlideshow({
  images,
  active,
  alt,
  fallbackLabel = "No image",
}: ItemHeroSlideshowProps) {
  const slides = images.length > 0 ? images : [];
  const slidesKey = slides.join("|");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slidesKey]);

  useEffect(() => {
    if (!active || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [active, slides.length]);

  if (slides.length === 0) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
      >
        {fallbackLabel}
      </div>
    );
  }

  return (
    <>
      {slides.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={alt}
          className={`item-slideshow-image absolute inset-0 h-full w-full object-cover ${
            i === index ? "item-slideshow-image--active" : "item-slideshow-image--inactive"
          }`}
        />
      ))}
    </>
  );
}
