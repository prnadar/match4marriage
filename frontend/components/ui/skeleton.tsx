import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Subtle blush shimmer that matches the warm palette.
        "animate-pulse rounded-md bg-gradient-to-r from-secondary via-muted2 to-secondary bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
