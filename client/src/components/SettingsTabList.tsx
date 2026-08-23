import React from "react";
import { Check } from "lucide-react";

export type SettingsTabOption = {
  id: string;
  label: string;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function SettingsTabList({ tabs, activeTab, onChange }: { tabs: SettingsTabOption[]; activeTab: string; onChange: (id: string) => void }) {
  const focusTab = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + direction + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    onChange(next.id);
    document.querySelector<HTMLButtonElement>(`[data-settings-tab="${next.id}"]`)?.focus();
  };

  return <div role="tablist" aria-label="Sections des paramètres" className="grid gap-1 sm:grid-cols-2 lg:block">{tabs.map((item, index) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return <button key={item.id} type="button" role="tab" aria-selected={active} aria-controls={`settings-panel-${item.id}`} data-settings-tab={item.id} onKeyDown={event => focusTab(event, index)} onClick={() => onChange(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-violet-400/[0.12] text-violet-100" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"}`}><Icon className="size-4 shrink-0" /><span className="min-w-0"><span className="block text-xs font-medium">{item.label}</span><span className="mt-0.5 block truncate text-[10px] text-zinc-600">{item.note}</span></span>{active && <Check className="ml-auto size-3.5 text-violet-300" />}</button>;
  })}</div>;
}
