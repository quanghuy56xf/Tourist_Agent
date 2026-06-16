"use client";

import Link from "next/link";

import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { useGroupPath } from "@/lib/useGroupPath";

interface HomeButtonProps {
  className?: string;
}

export default function HomeButton({ className = "" }: HomeButtonProps) {
  const { t } = useVisitorLocale();
  const groupHomePath = useGroupPath();

  return (
    <Link
      href={groupHomePath}
      aria-label={t.common.home}
      title={t.common.home}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${className}`}
      style={{
        borderColor: "var(--border)",
        background: "var(--secondary)",
        color: "var(--primary)",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    </Link>
  );
}
