import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { applyWorkspacePreferences, DEFAULT_WORKSPACE_PREFERENCES, parseWorkspacePreferences, WORKSPACE_PREFERENCES_KEY, type WorkspacePreferences } from "@/lib/workspacePreferences";
import { Check, Keyboard, Monitor, Palette, PanelTop, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function WorkspaceSettings() {
  const [preferences, setPreferences] = useState<WorkspacePreferences>(() => parseWorkspacePreferences(localStorage.getItem(WORKSPACE_PREFERENCES_KEY)));

  useEffect(() => {
    localStorage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(preferences));
    applyWorkspacePreferences(document.documentElement, preferences);
  }, [preferences]);

  const setPreference = <Key extends keyof WorkspacePreferences>(key: Key, value: WorkspacePreferences[Key]) => {
    setPreferences(current => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setPreferences(DEFAULT_WORKSPACE_PREFERENCES);
    toast.success("Workspace preferences reset.");
  };

  return <DashboardLayout><div className="lakay-density-aware mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
    <section className="flex flex-col gap-5 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-8">
      <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-400/[0.07] px-3 py-1 text-[11px] font-medium text-violet-200"><Settings2 className="size-3.5" /> Workspace preferences</div><h1 className="text-3xl font-semibold tracking-[-0.055em] text-white sm:text-4xl">Make Lakay feel like yours.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">Control the clarity, motion, and preview behavior of your personal builder workspace.</p></div>
      <Button variant="outline" onClick={reset} className="w-full rounded-xl border-white/10 bg-white/[0.025] text-zinc-300 hover:bg-white/[0.06] sm:w-auto"><RotateCcw className="mr-2 size-4" />Reset preferences</Button>
    </section>

    <div className="mt-6 grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
      <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3"><p className="px-2 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">Workspace settings</p><div className="space-y-1">{[[Sparkles, "Experience", "Motion and layout"], [PanelTop, "Builder", "Preview behavior"], [Keyboard, "Shortcuts", "Navigation help"]].map(([Icon, label, note], index) => <div key={String(label)} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${index === 0 ? "bg-violet-400/[0.1] text-violet-100" : "text-zinc-500"}`}><Icon className="size-4" /><div><p className="text-xs font-medium">{String(label)}</p><p className="mt-0.5 text-[10px] text-zinc-600">{String(note)}</p></div>{index === 0 && <Check className="ml-auto size-3.5 text-violet-300" />}</div>)}</div></aside>
      <div className="space-y-4">
        <SettingCard icon={Palette} title="Experience" description="Keep the interface clear and comfortable across desktop and mobile screens.">
          <PreferenceRow label="Reduced motion" detail="Limit non-essential movement and transitions." checked={preferences.reduceMotion} onChange={value => setPreference("reduceMotion", value)} />
          <PreferenceRow label="Compact workspace" detail="Tighten spacing in builder surfaces on larger screens." checked={preferences.compactWorkspace} onChange={value => setPreference("compactWorkspace", value)} />
        </SettingCard>
        <SettingCard icon={Monitor} title="Builder & preview" description="Choose how Lakay behaves while you are shaping an application.">
          <PreferenceRow label="Open preview after a build" detail="Choose whether Lakay returns to the live preview or the saved files when a build completes." checked={preferences.autoPreview} onChange={value => setPreference("autoPreview", value)} />
          <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-zinc-200">Safe execution boundary</p><p className="mt-1 text-xs leading-5 text-zinc-500">Static previews run in Lakay’s isolated browser sandbox. Backend execution remains intentionally separate.</p></div><Badge className="w-fit border-0 bg-emerald-400/[0.1] text-emerald-300">Protected</Badge></div>
        </SettingCard>
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-r from-violet-400/[0.09] to-fuchsia-400/[0.04] p-5"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-200">Navigation tip</p><p className="mt-2 text-sm leading-6 text-zinc-300">Use the project list to orient yourself, then open an app to build. On small screens, the menu keeps every destination within reach.</p></div>
      </div>
    </div>
  </div></DashboardLayout>;
}

function SettingCard({ icon: Icon, title, description, children }: { icon: typeof Palette; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6"><div className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-400/[0.1]"><Icon className="size-4 text-violet-200" /></div><div><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-sm leading-5 text-zinc-500">{description}</p></div></div><div className="mt-5 space-y-4">{children}</div></section>;
}

function PreferenceRow({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-zinc-200">{label}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div><Switch checked={checked} onCheckedChange={onChange} aria-label={label} /> </div>;
}
