import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type AlertType = "success" | "error" | "warning";

export function AdminPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`admin-page ${className}`.trim()}>{children}</div>;
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="admin-page-header">
        {eyebrow && <p className="admin-eyebrow mb-2">{eyebrow}</p>}
        <h1 className="admin-title">{title}</h1>
        {description && <p className="admin-subtitle mt-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function AdminCard({
  children,
  className = "",
  title,
  description,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section className={`admin-card-padded space-y-4 ${className}`.trim()}>
      {(title || description) && (
        <div>
          {title && <h2 className="admin-card-title">{title}</h2>}
          {description && <p className="admin-subtitle mt-1">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`.trim()}>
      <span className="admin-label">{label}</span>
      {children}
    </label>
  );
}

export function AdminInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`admin-input ${props.className ?? ""}`.trim()} />;
}

export function AdminTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`admin-textarea ${props.className ?? ""}`.trim()} />;
}

export function AdminSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`admin-select ${props.className ?? ""}`.trim()} />;
}

export function AdminButton({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variantClass =
    variant === "secondary"
      ? "admin-btn-secondary"
      : variant === "danger"
        ? "admin-btn-danger"
        : variant === "ghost"
          ? "admin-btn-ghost"
          : "admin-btn-primary";
  return (
    <button {...props} className={`${variantClass} ${className}`.trim()} />
  );
}

export function AdminLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`admin-link ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function AdminAlert({
  type,
  children,
}: {
  type: AlertType;
  children: ReactNode;
}) {
  const typeClass =
    type === "success"
      ? "admin-alert-success"
      : type === "warning"
        ? "admin-alert-warning"
        : "admin-alert-error";
  return <div className={`admin-alert ${typeClass}`}>{children}</div>;
}

export function alertClass(type: AlertType): string {
  return `admin-alert ${
    type === "success"
      ? "admin-alert-success"
      : type === "warning"
        ? "admin-alert-warning"
        : "admin-alert-error"
  }`;
}
