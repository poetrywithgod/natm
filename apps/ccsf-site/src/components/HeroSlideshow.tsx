import { useEffect, useState } from "react";

const IMAGES = [
  "https://images.unsplash.com/photo-1473649085228-583485e6e4d7?auto=format&fit=crop&w=1920&h=1080&q=80",
  "https://images.unsplash.com/photo-1567057419565-4349c49d8a04?auto=format&fit=crop&w=1920&h=1080&q=80",
  "https://images.unsplash.com/photo-1567057420215-0afa9aa9253a?auto=format&fit=crop&w=1920&h=1080&q=80",
];

export default function HeroSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
            decoding="async"
            fetchPriority={i === 0 ? "high" : "auto"}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-pine-900/80" />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={`Slide ${i + 1}`}
            className={`w-2 h-2 rounded-full transition-colors ${i === active ? "bg-gold-500" : "bg-cream-100/40"}`}
          />
        ))}
      </div>
    </div>
  );
}
