import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ChevronDown, PackageCheck, Play, Smartphone, Upload } from "lucide-react";
import { useState } from "react";

type RunnerProfile = {
  mode: "static" | "full_stack_runner";
  status: string;
} | null | undefined;

type RunnerJob = {
  id: string;
  state: string;
};

type SourceVersion = {
  id: string;
  origin: string;
  createdAt: Date | string;
  summary?: string | null;
};

type MobilePublishDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  hasBuild: boolean;
  hasUnpackagedChanges: boolean;
  versions: SourceVersion[];
  runnerProfile: RunnerProfile;
  runnerJobs: RunnerJob[];
  busy: boolean;
  onRequestAndroidBuild: () => void;
  onEditSources: () => void;
};

export default function MobilePublishDialog({ open, onOpenChange, projectName, hasBuild, hasUnpackagedChanges, versions, runnerProfile, runnerJobs, busy, onRequestAndroidBuild, onEditSources }: MobilePublishDialogProps) {
  const [googlePlayOpen, setGooglePlayOpen] = useState(false);
  const activeJob = runnerJobs.find(job => ["queued", "runner_assigned", "installing", "building", "testing"].includes(job.state));
  const prepared = runnerProfile?.mode === "full_stack_runner";
  const sourceVersions = versions.slice(0, 3);
  const sourceVersionLabel = (index: number) => `1.0.${Math.max(1, sourceVersions.length - index)}`;

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[min(760px,calc(100svh-1.5rem))] max-w-[calc(100%-1rem)] gap-0 overflow-y-auto border-neutral-800 bg-[#101014] p-0 text-zinc-100 shadow-[0_28px_100px_rgba(0,0,0,0.6)] sm:max-w-2xl"><DialogHeader className="border-b border-neutral-800 px-5 py-4 pr-12 text-left sm:px-6"><DialogTitle className="flex items-center gap-2 text-base font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-emerald-400/10"><Smartphone className="size-4 text-emerald-300" /></span>Publish Mobile App</DialogTitle><DialogDescription className="mt-1 text-xs leading-5 text-zinc-500">Préparez une distribution mobile pour <span className="font-medium text-zinc-300">{projectName}</span>. Les artefacts restent produits uniquement par un runner mobile isolé.</DialogDescription></DialogHeader><Tabs defaultValue="android" className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6"><TabsList className="grid h-9 w-full grid-cols-2 rounded-lg border border-neutral-800 bg-[#15151a] p-1"><TabsTrigger value="android" className="rounded-md text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-950">Android</TabsTrigger><TabsTrigger value="ios" className="rounded-md text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-950">iOS</TabsTrigger></TabsList><TabsContent value="android" className="mt-4 space-y-4"><section className="rounded-xl border border-neutral-800 bg-[#15151a] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><PackageCheck className="size-4 text-emerald-300" />Personal Use &amp; Limited Distribution</p><p className="mt-1 text-xs leading-5 text-zinc-500">Installez un APK signé sur des appareils de test, sans mise en ligne publique.</p></div><Badge className={`border ${hasUnpackagedChanges ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"}`}>{hasUnpackagedChanges ? "You have unpackaged changes" : "Package up to date"}</Badge></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-black/20 p-3"><div><p className="text-xs font-medium text-zinc-200">Android package status</p><p className="mt-1 text-[11px] text-zinc-500">{activeJob ? `Runner job ${activeJob.state.replace(/_/g, " ")} · APK non livré` : prepared ? "Runner contract is prepared; an Android-capable runner is still required." : "No Android runner or APK artifact is connected."}</p></div><Button disabled={!hasBuild || busy} onClick={onRequestAndroidBuild} className="h-9 rounded-lg bg-emerald-300 px-3 text-xs font-semibold text-zinc-950 hover:bg-emerald-200 disabled:bg-zinc-800 disabled:text-zinc-500"><Upload className="mr-1.5 size-3.5" />Build APK</Button></div>{!hasBuild && <p className="mt-3 text-[11px] text-amber-200">Créez d’abord les fichiers de l’application avant de préparer un build mobile.</p>}</section><section className="rounded-xl border border-neutral-800 bg-[#15151a] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-zinc-100">Version history</p><p className="mt-1 text-xs text-zinc-500">Les versions source réelles sont modifiables. Les téléchargements APK apparaîtront seulement après un build isolé réussi.</p></div><Badge className="border border-neutral-800 bg-black/20 text-zinc-400">{sourceVersions.length} source version{sourceVersions.length === 1 ? "" : "s"}</Badge></div><div className="mt-3 space-y-2">{sourceVersions.length ? sourceVersions.map((version, index) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-black/20 px-3 py-2.5"><div><p className="text-xs font-medium text-zinc-200">Version {sourceVersionLabel(index)} <span className="ml-1 text-[10px] font-normal text-zinc-600">source</span></p><p className="mt-0.5 max-w-[27rem] truncate text-[10px] text-zinc-500">{version.summary || version.origin} · {new Date(version.createdAt).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={onEditSources} className="h-7 border-neutral-800 bg-transparent px-2 text-[10px] text-zinc-300 hover:bg-white/[0.05] hover:text-white">Modifier</Button><Button variant="outline" size="sm" disabled className="h-7 border-neutral-800 bg-transparent px-2 text-[10px] text-zinc-600">APK indisponible</Button></div></div>) : <div className="rounded-lg border border-dashed border-neutral-800 p-3 text-xs text-zinc-500">Aucune version source n’est disponible. Générez l’application pour commencer.</div>}</div></section><Collapsible open={googlePlayOpen} onOpenChange={setGooglePlayOpen} className="rounded-xl border border-neutral-800 bg-[#15151a]"><CollapsibleTrigger asChild><button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"><span><span className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Play className="size-4 text-emerald-300" />Publish to Google Play</span><span className="mt-1 block text-xs text-zinc-500">Configuration officielle, certificat et soumission Play Console.</span></span><ChevronDown className={`size-4 text-zinc-500 transition-transform ${googlePlayOpen ? "rotate-180" : ""}`} /></button></CollapsibleTrigger><CollapsibleContent className="border-t border-neutral-800 px-4 pb-4 pt-3"><div className="rounded-lg border border-neutral-800 bg-black/20 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium text-zinc-200">Android certificate SHA-1</p><p className="mt-1 font-mono text-[10px] text-zinc-600">Available after isolated Android signing</p></div><Button variant="outline" size="sm" disabled className="h-7 border-neutral-800 bg-transparent px-2 text-[10px] text-zinc-600">Copier le SHA-1</Button></div></div><p className="mt-3 text-xs leading-5 text-zinc-500">Les services backend, API et secrets associés doivent être configurés dans le runner isolé et dans les consoles du fournisseur. Ils ne sont ni exportés vers l’APK ni exposés dans Lakay.</p><div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-[11px] text-amber-100"><AlertTriangle className="size-3.5 shrink-0 text-amber-300" />La publication Play Console n’est pas encore connectée à ce projet.</div></CollapsibleContent></Collapsible></TabsContent><TabsContent value="ios" className="mt-4"><section className="rounded-xl border border-neutral-800 bg-[#15151a] p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-800"><Smartphone className="size-4 text-zinc-300" /></span><div><p className="text-sm font-semibold text-zinc-100">iOS &amp; TestFlight</p><p className="mt-1 text-xs leading-5 text-zinc-500">La génération IPA, la signature Apple et la diffusion TestFlight nécessitent un runner macOS isolé ainsi qu’un compte Apple Developer. Aucun certificat Apple n’est géré dans l’interface Lakay.</p><Badge className="mt-3 border border-neutral-800 bg-black/20 text-zinc-400">iOS runner not configured</Badge></div></div></section></TabsContent></Tabs></DialogContent></Dialog>;
}
