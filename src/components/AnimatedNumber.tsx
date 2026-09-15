"use client";

import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Renders the tweened value. Receives the in-flight number, not the target. */
  format: (value: number) => string;
  /** Seconds. Long enough to read as motion, short enough to feel fast. */
  duration?: number;
  className?: string;
}

/**
 * A number that counts to its value rather than snapping.
 *
 * Financial figures changing instantly read as a glitch; easing to them reads
 * as a calculation. Pair with the `.numeric` class so tabular figures hold
 * their width while digits change.
 *
 * Honours prefers-reduced-motion by rendering the value directly.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 0.6,
  className,
}: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  // Skip the intro tween on mount so a freshly loaded page shows real
  // figures immediately rather than animating up from zero.
  const mounted = useRef(false);

  useEffect(() => {
    if (reduceMotion || !mounted.current) {
      mounted.current = true;
      motionValue.set(value);
      setDisplay(value);
      return;
    }

    const controls = animate(motionValue, value, {
      duration,
      ease: [0.22, 1, 0.36, 1], // gentle deceleration
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [value, duration, reduceMotion, motionValue]);

  return <span className={className}>{format(display)}</span>;
}
