interface FieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}

export function Field({ label, htmlFor, children, hint }: FieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="block text-xs uppercase tracking-wide text-paper-dim mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-paper-dim mt-1">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "w-full bg-ink border border-rule rounded-sm px-3 py-2 text-paper text-sm outline-none focus:border-amber transition-colors";
