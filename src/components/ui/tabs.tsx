"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Longer name for screen readers and the tooltip, e.g. "Euro" for "EUR". */
  description?: string;
  disabled?: boolean;
}

interface TabsProps<T extends string> {
  /** Accessible name of the group, e.g. "Currency". */
  label: string;
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Segmented tabs with a sliding indicator.
 *
 * These pick a view setting (a filter or currency) rather than switching
 * between panels, so they are a radio group underneath: one tab stop, arrow
 * keys move the selection, and the checked state is announced natively.
 * The indicator animates between options via a shared layout id; motion
 * respects `prefers-reduced-motion` through the app's MotionConfig.
 */
export function Tabs<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: TabsProps<T>) {
  const groupId = useId();

  return (
    <fieldset
      className={`inline-flex rounded-lg border border-border bg-surface p-0.5 ${className}`}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            title={option.description}
            className={`relative cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors select-none has-focus-visible:outline-2 has-focus-visible:outline-focus has-disabled:cursor-not-allowed has-disabled:opacity-40 ${
              selected ? "font-medium text-fg" : "text-muted hover:text-fg"
            }`}
          >
            <input
              type="radio"
              name={groupId}
              value={option.value}
              checked={selected}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {selected && (
              <motion.span
                layoutId={`${groupId}-indicator`}
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-surface-muted shadow-sm ring-1 ring-border"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <span className="relative">
              {option.label}
              {option.description && <span className="sr-only">: {option.description}</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
