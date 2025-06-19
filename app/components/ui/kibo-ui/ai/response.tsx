"use client";
import { memo } from "react";
import type { HTMLAttributes } from "react";
import { MarkedReact } from "~/components/shared/marked";

import { cn } from "~/lib/utils";

export type AIResponseProps = HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export const AIResponse = memo(
  ({ className, children, ...props }: AIResponseProps) => (
    <div className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)} {...props}>
      <MarkedReact value={children?.toString() || ""} />
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
