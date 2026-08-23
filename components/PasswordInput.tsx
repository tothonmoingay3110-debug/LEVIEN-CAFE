"use client";

import { ComponentPropsWithoutRef, useId, useState } from "react";

type PasswordInputProps = Omit<ComponentPropsWithoutRef<"input">, "type">;

export default function PasswordInput({ id, className, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  return <div className={`passwordField${className ? ` ${className}` : ""}`}>
    <input {...props} id={inputId} type={visible ? "text" : "password"} />
    <button
      type="button"
      className="passwordVisibility"
      aria-label={visible ? "Hide password" : "Show password"}
      aria-controls={inputId}
      aria-pressed={visible}
      title={visible ? "Hide password" : "Show password"}
      onClick={() => setVisible((current) => !current)}
    >
      {visible
        ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 9 4.8 9 7a8.4 8.4 0 0 1-2.3 3.5M6.2 6.2C4.2 7.5 3 10.3 3 12c0 2.2 3.8 7 9 7 1.2 0 2.4-.3 3.4-.8" /></svg>
        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12c0-2.2 3.8-7 9-7s9 4.8 9 7-3.8 7-9 7-9-4.8-9-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>}
    </button>
  </div>;
}
