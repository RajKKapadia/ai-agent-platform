"use client";

import { cn } from "@/lib/utils";
import {
  createContext,
  useContext,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
} from "react";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("Tabs components must be used inside Tabs");
  }

  return context;
}

export interface TabsProps {
  children: ReactNode;
  className?: string;
  onValueChange: (value: string) => void;
  value: string;
}

export function Tabs({ children, className, onValueChange, value }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("min-w-0 space-y-5", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid w-full min-w-0 grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm sm:grid-cols-4",
        className,
      )}
      role="tablist"
      {...props}
    />
  );
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  children,
  className,
  value,
  ...props
}: TabsTriggerProps) {
  const context = useTabsContext();
  const isSelected = context.value === value;

  return (
    <button
      aria-selected={isSelected}
      className={cn(
        "group inline-flex h-10 w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md px-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 sm:gap-2 sm:px-3",
        isSelected &&
          "bg-zinc-950 text-white hover:bg-zinc-900 hover:text-white",
        className,
      )}
      onClick={() => context.onValueChange(value)}
      role="tab"
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends ComponentProps<"div"> {
  value: string;
}

export function TabsContent({
  children,
  className,
  value,
  ...props
}: TabsContentProps) {
  const context = useTabsContext();

  if (context.value !== value) {
    return null;
  }

  return (
    <div className={cn("outline-none", className)} role="tabpanel" {...props}>
      {children}
    </div>
  );
}
