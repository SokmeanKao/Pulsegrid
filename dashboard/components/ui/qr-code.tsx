"use client";

import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  size?: number;
  className?: string;
  label?: string;
};

export function QrCode({ value, size = 160, className, label = "QR code" }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center border border-[var(--t-border)] bg-white p-2",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
    </div>
  );
}
