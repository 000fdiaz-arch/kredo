import { InputHTMLAttributes, ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: ReactNode;
};

export function Field({ label, helper, className = "", ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-kredo-ink">{label}</span>
      <input
        className={`mt-2 min-h-12 w-full rounded-md border border-kredo-line bg-white px-3 text-base outline-none focus:border-kredo-primary ${className}`}
        {...props}
      />
      {helper ? <span className="mt-1 block text-xs text-kredo-muted">{helper}</span> : null}
    </label>
  );
}
