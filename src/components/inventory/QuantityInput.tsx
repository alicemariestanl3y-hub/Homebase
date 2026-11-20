"use client";

import { useId, useState } from "react";

type QuantityInputProps = {
  name: string;
  label?: string;
  /** Initial numeric value; omit or null for an empty field (fixes 0500). */
  initialValue?: number | null;
  min?: number;
  max?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: number | null) => void;
};

/**
 * String-backed quantity field so mobile typing never prefixes a sticky 0.
 * Empty start → type 500 → "500", not "0500".
 */
export function QuantityInput({
  name,
  label,
  initialValue = null,
  min = 0.01,
  max,
  required = true,
  disabled,
  className,
  onValueChange,
}: QuantityInputProps) {
  const id = useId();
  const [text, setText] = useState(() =>
    initialValue == null || Number.isNaN(initialValue)
      ? ""
      : formatInitial(initialValue),
  );

  function commit(next: string) {
    setText(next);
    if (!next.trim()) {
      onValueChange?.(null);
      return;
    }
    const parsed = Number(next);
    onValueChange?.(Number.isFinite(parsed) ? parsed : null);
  }

  return (
    <label className={className ?? "auth-field"} htmlFor={id}>
      {label ? <span>{label}</span> : null}
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        required={required}
        disabled={disabled}
        value={text}
        placeholder=""
        pattern="[0-9]*[.,]?[0-9]*"
        onChange={(event) => {
          const raw = event.target.value.replace(",", ".");
          if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
            commit(raw);
          }
        }}
        onBlur={() => {
          if (!text.trim()) return;
          const parsed = Number(text);
          if (!Number.isFinite(parsed)) {
            commit("");
            return;
          }
          if (min != null && parsed < min) {
            commit(formatInitial(min));
            return;
          }
          if (max != null && parsed > max) {
            commit(formatInitial(max));
          }
        }}
      />
    </label>
  );
}

function formatInitial(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}
