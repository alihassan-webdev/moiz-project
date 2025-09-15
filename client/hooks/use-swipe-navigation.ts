import { useEffect } from "react";

export interface SwipeNavOptions {
  enabled?: boolean;
  edgeSize?: number; // px from the left edge to start a back gesture
  minDistance?: number; // px horizontal distance to trigger
  maxAngle?: number; // degrees: limit vertical deviation
  maxDurationMs?: number; // swipe must complete within
}

export function useSwipeNavigation(
  onBack: () => void,
  {
    enabled = true,
    edgeSize = 32,
    minDistance = 60,
    maxAngle = 35,
    maxDurationMs = 600,
  }: SwipeNavOptions = {},
) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only enable on small screens by default
    const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
    if (!enabled || !isSmallScreen) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;

    const isTextInput = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return false;
      const tag = el.tagName.toLowerCase();
      const editable = (el as HTMLElement).isContentEditable;
      return (
        editable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.closest("[role=button]")?.hasAttribute("aria-expanded") === true
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      // Only start if the touch begins near the left edge
      if (t.clientX > edgeSize) return;
      if (isTextInput(e.target)) return; // don't hijack typing

      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
      tracking = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      // Allow vertical scroll unless clearly horizontal; do not preventDefault here for smoothness
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const distance = Math.hypot(dx, dy);
      if (distance < 8) return;

      const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
      // If the swipe becomes too vertical, cancel tracking
      if (angle > maxAngle) {
        tracking = false;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;

      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startTime;

      const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
      const horizontal = angle <= maxAngle;
      const enoughDistance = dx > minDistance; // left->right only (back)
      const fastEnough = dt <= maxDurationMs;

      if (horizontal && enoughDistance && fastEnough) {
        // Prevent the synthetic click following touchend
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      window.removeEventListener("touchstart", onTouchStart as any);
      window.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("touchend", onTouchEnd as any);
    };
  }, [enabled, edgeSize, minDistance, maxAngle, maxDurationMs, onBack]);
}
