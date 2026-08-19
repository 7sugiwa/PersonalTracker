import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { cx } from "./cx";

const FIELD_BASE =
  "w-full rounded-lg border border-line bg-surface-inset px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-ring focus:outline-none";

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx("mb-1 block text-xs font-medium text-ink-secondary", className)}
      {...rest}
    />
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD_BASE, className)} {...rest} />;
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="date" {...props} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(FIELD_BASE, className)} {...rest}>
      {children}
    </select>
  );
}

/** Styled multi-select checkbox with zero JS: a visually-hidden checkbox
 * plus a peer-styled label pill. Used for the transaction type filter. */
export function CheckChip({
  name,
  value,
  defaultChecked,
  children,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="inline-flex items-center rounded-full border border-line bg-surface-inset px-3 py-1 text-xs font-medium text-ink-secondary transition-colors peer-checked:border-ring peer-checked:bg-ring/10 peer-checked:text-ring peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
        {children}
      </span>
    </label>
  );
}
