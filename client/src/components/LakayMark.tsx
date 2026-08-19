import { cn } from "@/lib/utils";

export function LakayMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-violet-300 via-violet-500 to-fuchsia-600 shadow-[0_0_24px_rgba(139,92,246,0.34)]">
        <span className="font-mono text-sm font-bold tracking-[-0.18em] text-white">L</span>
      </div>
      {!compact && <span className="text-[15px] font-semibold tracking-[-0.04em] text-foreground">Lakay</span>}
    </div>
  );
}
