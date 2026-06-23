import { forwardRef } from "react";
import { cn } from "@/lib/format";

// Surface card primitive. `interactive` adds the subtle hover lift (1px rise +
// soft shadow + warmer border) for cards that are clickable/linked; leave it off
// for static content panels so they stay flat per the quiet-luxury baseline.

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border-hairline bg-surface",
        interactive &&
          "transition-all duration-150 hover:-translate-y-px hover:border-[#d8d5cc] hover:shadow-sm",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
