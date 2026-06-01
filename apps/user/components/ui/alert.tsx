import { cn } from "@/lib/utils";
import type * as React from "react";

export function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
        className,
      )}
      role="alert"
      {...props}
    />
  );
}
