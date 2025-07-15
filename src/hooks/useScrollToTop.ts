// hooks/useScrollToTop.ts
import { useState, useEffect } from "react";

interface UseScrollToTopOptions {
  behavior?: "smooth" | "instant";
  top?: number;
}

export const useScrollToTop = (options: UseScrollToTopOptions = {}) => {
  const { behavior = "smooth", top = 0 } = options;
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    if (shouldScroll) {
      window.scrollTo({
        top,
        behavior,
      });
      setShouldScroll(false);
    }
  }, [shouldScroll, top, behavior]);

  const scrollToTop = () => {
    setShouldScroll(true);
  };

  return scrollToTop;
};
