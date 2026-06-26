"use client";

import Link from "next/link";

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
  label: string;
  variant?: "light" | "dark";
  className?: string;
}

export default function BackButton({
  href,
  onClick,
  label,
  variant = "light",
  className = "",
}: BackButtonProps) {
  const classes =
    variant === "dark"
      ? `artifact-btn-secondary ${className}`
      : `artifact-btn-secondary ${className}`;

  const content = (
    <>
      <span aria-hidden="true">←</span>
      <span className="text-xs">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={classes}>
      {content}
    </button>
  );
}
