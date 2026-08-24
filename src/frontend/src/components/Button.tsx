import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "primary"
  | "confirm"
  | "danger"
  | "danger-outline"
  | "outline"
  | "cancel"
  | "ghost"
  | "link"
  | "icon"
  | "icon-danger";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "",
  confirm: "btn-confirm",
  danger: "btn-danger",
  "danger-outline": "btn-danger-outline",
  outline: "btn-outline",
  cancel: "btn-cancel",
  ghost: "btn-ghost",
  link: "btn-link",
  icon: "btn-icon",
  "icon-danger": "btn-icon btn-icon-danger",
};

// The one place every action button's color/border comes from — see the
// .btn-* rules in styles.css. "primary" needs no class: a bare <button>
// already renders solid-primary via the global button{} default. Layout
// (gap, padding, min-width) stays the caller's job, same as before this
// component existed — pass it via className, or rely on a parent selector
// like .ticket-actions button / .notif-action-btn already does.
export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const classes = [VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  return <button type={type} className={classes || undefined} {...props} />;
}
