import type { InputHTMLAttributes } from "react";

type FormFieldProps = {
  label: string;
  id: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function FormField({
  label,
  id,
  className = "",
  ...props
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        className={`mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-foreground placeholder:text-neutral-600 outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}
        {...props}
      />
    </div>
  );
}
