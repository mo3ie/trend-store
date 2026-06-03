"use client";

import { useState, useEffect } from "react";

const slides = [
  { src: "/images/hero1.png", alt: "متجر ترند للإلكترونيات" },
  { src: "/images/hero2.png", alt: "أفضل العروض التقنية" },
  { src: "/images/hero3.png", alt: "تسوق أحدث المنتجات" },
];

export default function HeroSlider() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hero-slider" style={{ position: "relative" }}>
      {slides.map((slide, i) => (
        <img
          key={i}
          src={slide.src}
          alt={slide.alt}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: i === current ? 1 : 0,
            transition: "opacity 0.8s ease",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "8px",
          zIndex: 10,
        }}
      >
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              background: i === current ? "#a855f7" : "#aaa",
              opacity: i === current ? 1 : 0.5,
            }}
          />
        ))}
      </div>
    </div>
  );
}
