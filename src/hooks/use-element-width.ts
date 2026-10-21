"use client";

import { useCallback, useState } from "react";

/** Width of an element, tracked with ResizeObserver. Null until measured (and on the server). */
export function useElementWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState<number | null>(null);

  const ref = useCallback((node: T | null) => {
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
