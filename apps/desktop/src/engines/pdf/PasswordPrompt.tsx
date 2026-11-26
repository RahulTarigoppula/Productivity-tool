import { useEffect, useId, useRef } from "react";
import { useModalFocus } from "../../shell/modalFocus";

/** Asks for the password of a protected PDF. Tab stays inside; Cancel or Escape leaves the PDF closed.
 *  A wrong password keeps the field and what was typed (selected, ready to retype) and says so. */
export function PasswordPrompt({ name, retry, attempt, onSubmit, onCancel }: {
  name: string;
  /** The last password did not work. */
  retry: boolean;
  /** Counts the questions asked, so each wrong answer is announced again. */
  attempt: number;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const checking = useRef(false);
  const id = useId();
  useModalFocus(overlay, onCancel);
  // Every question from PDF.js ends the previous check.
  useEffect(() => {
    checking.current = false;
    if (retry) {
      input.current?.focus();
      input.current?.select();
    }
  }, [attempt, retry]);
  return (
    <div className="overlay" ref={overlay}>
      <form
        className="dialog pdf-pw"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onSubmit={(e) => {
          e.preventDefault();
          const value = input.current?.value ?? "";
          // An empty password can never be the answer (the PDF would have opened without asking).
          if (!value || checking.current) return void input.current?.focus();
          checking.current = true;
          onSubmit(value);
        }}
      >
        <h3 id={`${id}-title`}>This PDF is protected</h3>
        <p id={`${id}-desc`}>Enter the password to open “{name}”.</p>
        <input
          ref={input}
          name="pw"
          type="password"
          className="input"
          autoFocus
          autoComplete="off"
          aria-label="Password"
          aria-invalid={retry || undefined}
          aria-describedby={retry ? `${id}-err` : undefined}
        />
        {retry && (
          <p key={attempt} id={`${id}-err`} className="pdf-pw-error" role="alert">
            That password is not right. Check it and try again.
          </p>
        )}
        <div className="acts">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn primary">Open</button>
        </div>
      </form>
    </div>
  );
}
