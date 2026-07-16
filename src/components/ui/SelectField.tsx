import { SelectHTMLAttributes } from "react";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
};

export function SelectField({ label, children, className = "", ...props }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-kredo-ink">{label}</span>
      <select
        className={`mt-2 min-h-12 w-full rounded-md border border-kredo-line bg-white px-3 text-base outline-none focus:border-kredo-primary ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
