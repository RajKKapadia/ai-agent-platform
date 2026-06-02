import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link, { type LinkProps } from "next/link";
import type * as React from "react";

export interface ButtonLinkProps
  extends
    LinkProps,
    Pick<ButtonProps, "variant" | "size">,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> {}

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
