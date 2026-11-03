import type { InputHTMLAttributes } from "react";
import { PixelInput } from "@/components/pixel/primitives";

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
      <PixelInput
        id={id}
        className={`mt-1 h-10 px-3 text-sm ${className}`}
        {...props}
      />
    </div>
  );
}
