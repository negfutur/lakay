import { cn } from "@/lib/utils";

export function LakayMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-emerald-300 via-emerald-500 to-teal-700 shadow-[0_0_24px_rgba(16,185,129,0.3)]">
        <span className="font-mono text-sm font-bold tracking-[-0.18em] text-white">L</span>
      </div>
      {!compact && <span className="text-[15px] font-semibold tracking-[-0.04em] text-foreground">Lakay</span>}
    </div>
  );
}
