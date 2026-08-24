import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, PackageCheck, Play, Smartphone, Upload } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

type RunnerProfile = { mode: "static" | "full_stack_runner"; status: string } | null | undefined;
type ApkArtifact = { downloadUrl: string; filename: string; expiresAt: Date | string };
type RunnerJob = { id: string; state: string; apk?: ApkArtifact | null };
type SourceVersion = { id: string; origin: string; createdAt: Date | string; summary?: string | null };

export type MobileBuildConfiguration = { appName: string; bundleId: string; version: string };
type AndroidBuildProgress = "idle" | "validating" | "contract" | "awaiting_runner" | "queued" | "error";

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
  onRequestAndroidBuild: (configuration: MobileBuildConfiguration) => Promise<void>;
  onEditSources: () => void;
};

const progressDetails: Record<Exclude<AndroidBuildProgress, "idle">, { progress: number; title: string; detail: string; tone: "emerald" | "amber" | "rose" }> = {
  validating: { progress: 18, title: "Vérification de la configuration", detail: "Le nom, le Bundle ID et la version sont contrôlés avant toute préparation.", tone: "emerald" },
  contract: { progress: 44, title: "Préparation du contrat isolé", detail: "La demande est préparée sans exécuter de code sur le serveur Lakay.", tone: "emerald" },
  awaiting_runner: { progress: 64, title: "En attente d’un runner Android", detail: "Le contrat est prêt. Un runner isolé doit être relié pour installer, signer et compiler.", tone: "amber" },
  queued: { progress: 78, title: "Runner Android en attente", detail: "Une demande isolée attend sa prise en charge. L’APK restera indisponible jusqu’à la fin réelle du build.", tone: "amber" },
  error: { progress: 0, title: "Préparation interrompue", detail: "Le contrat n’a pas pu être préparé. Aucun APK ni secret n’a été créé ou exposé.", tone: "rose" },
};

function defaultBundleId(projectName: string) {
  const slug = projectName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^\d+|\d+$/g, "") || "app";
  return `ai.lakay.${slug}`;
}

function getConfigurationErrors(configuration: MobileBuildConfiguration) {
  const errors: Partial<Record<keyof MobileBuildConfiguration, string>> = {};
  if (configuration.appName.trim().length < 2 || configuration.appName.trim().length > 60) errors.appName = "Le nom doit contenir entre 2 et 60 caractères.";
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$/.test(configuration.bundleId)) errors.bundleId = "Utilisez un identifiant inversé : com.votreentreprise.votreapp.";
  if (!/^\d+\.\d+\.\d+$/.test(configuration.version)) errors.version = "Utilisez un numéro au format 1.0.0.";
  return errors;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-zinc-300"><span>{label}</span>{children}{hint && <span className="mt-1 block text-[10px] text-amber-200">{hint}</span>}</label>;
}

function AndroidBuildProgressPanel({ state }: { state: AndroidBuildProgress }) {
  if (state === "idle") return null;
  const detail = progressDetails[state];
  const tone = detail.tone === "rose" ? "rose" : detail.tone === "amber" ? "amber" : "emerald";
  const colors = { emerald: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200 bg-emerald-300", amber: "border-amber-300/20 bg-amber-300/[0.06] text-amber-200 bg-amber-300", rose: "border-rose-300/20 bg-rose-300/[0.06] text-rose-200 bg-rose-300" }[tone].split(" ");
  return <div aria-live="polite" className={`mt-3 rounded-lg border p-3 ${colors[0]} ${colors[1]}`}><div className="flex items-start gap-2.5"><span className={`mt-0.5 ${colors[2]}`}>{tone === "rose" ? <AlertTriangle className="size-4" /> : tone === "amber" ? <PackageCheck className="size-4" /> : <Loader2 className="size-4 animate-spin" />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-zinc-100">{detail.title}</p><span className="font-mono text-[10px] text-zinc-400">{detail.progress}%</span></div><p className="mt-1 text-[11px] leading-5 text-zinc-400">{detail.detail}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30"><div className={`h-full rounded-full transition-[width] duration-500 ease-out ${colors[3]}`} style={{ width: `${detail.progress}%` }} /></div>{state === "queued" && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-100"><CheckCircle2 className="size-3" />Le suivi du runner est disponible dans l’onglet Runner.</p>}</div></div></div>;
}

function ApkReadyCard({ apk }: { apk: ApkArtifact }) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(apk.downloadUrl, { width: 196, margin: 1, color: { dark: "#101014", light: "#ffffff" } }).then(dataUrl => { if (!cancelled) setQrCodeDataUrl(dataUrl); }).catch(() => { if (!cancelled) setQrCodeDataUrl(null); });
    return () => { cancelled = true; };
  }, [apk.downloadUrl]);
  return <section className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.07] p-4"><div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-lg bg-emerald-300/15"><CheckCircle2 className="size-4 text-emerald-200" /></span><div><p className="text-sm font-semibold text-emerald-50">APK ready for download</p><p className="mt-1 text-xs leading-5 text-emerald-100/75">Le runner isolé a livré un APK réel. Scannez le QR code sur votre appareil Android ou téléchargez le fichier.</p></div></div><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid size-[132px] place-items-center rounded-xl bg-white p-2">{qrCodeDataUrl ? <img src={qrCodeDataUrl} alt={`QR code pour télécharger ${apk.filename}`} className="size-full" /> : <Loader2 className="size-5 animate-spin text-zinc-700" />}</div><div className="min-w-0"><p className="truncate font-mono text-[11px] text-emerald-100">{apk.filename}</p><p className="mt-1 text-[10px] text-emerald-100/60">Lien sécurisé disponible jusqu’au {new Date(apk.expiresAt).toLocaleString()}.</p><a href={apk.downloadUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-8 items-center rounded-lg bg-emerald-300 px-3 text-xs font-semibold text-zinc-950 hover:bg-emerald-200"><Upload className="mr-1.5 size-3.5" />Télécharger l’APK</a></div></div></section>;
}

export default function MobilePublishDialog({ open, onOpenChange, projectName, hasBuild, hasUnpackagedChanges, versions, runnerProfile, runnerJobs, busy, onRequestAndroidBuild, onEditSources }: MobilePublishDialogProps) {
  const [googlePlayOpen, setGooglePlayOpen] = useState(false);
  const [attemptedBuild, setAttemptedBuild] = useState(false);
  const [buildProgress, setBuildProgress] = useState<AndroidBuildProgress>("idle");
  const [configuration, setConfiguration] = useState<MobileBuildConfiguration>({ appName: projectName, bundleId: defaultBundleId(projectName), version: "1.0.0" });
  const errors = useMemo(() => getConfigurationErrors(configuration), [configuration]);
  const bundleIdError = errors.bundleId;
  const isBundleIdValid = !bundleIdError;
  const activeJob = runnerJobs.find(job => ["queued", "runner_assigned", "installing", "building", "testing"].includes(job.state));
  const deliveredApk = runnerJobs.find(job => job.state === "preview_ready" && job.apk)?.apk || null;
  const prepared = runnerProfile?.mode === "full_stack_runner";
  const isPreparingBuild = buildProgress === "validating" || buildProgress === "contract";
  const disabledBuild = !hasBuild || busy || isPreparingBuild || !isBundleIdValid;

  useEffect(() => { if (buildProgress !== "idle" && buildProgress !== "error") { if (activeJob) setBuildProgress("queued"); else if (prepared) setBuildProgress("awaiting_runner"); } }, [activeJob?.state, buildProgress, prepared]);

  const update = <K extends keyof MobileBuildConfiguration>(key: K, value: MobileBuildConfiguration[K]) => setConfiguration(current => ({ ...current, [key]: value }));
  const submitAndroidBuild = async () => {
    setAttemptedBuild(true);
    const hasConfigurationErrors = Object.keys(errors).length > 0;
    if (hasConfigurationErrors || !hasBuild || busy || isPreparingBuild) return;
    setBuildProgress(prepared ? "awaiting_runner" : "validating");
    const timer = window.setTimeout(() => setBuildProgress(current => current === "validating" ? "contract" : current), 420);
    try { await onRequestAndroidBuild({ appName: configuration.appName.trim(), bundleId: configuration.bundleId.trim(), version: configuration.version.trim() }); window.clearTimeout(timer); } catch { window.clearTimeout(timer); setBuildProgress("error"); }
  };
  const inputClass = "mt-1.5 h-9 w-full rounded-lg bg-[#101014] px-3 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-700 focus:ring-2 disabled:opacity-50";

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[min(800px,calc(100svh-1.5rem))] max-w-[calc(100%-1rem)] gap-0 overflow-y-auto border-neutral-800 bg-[#101014] p-0 text-zinc-100 shadow-[0_28px_100px_rgba(0,0,0,0.6)] sm:max-w-2xl"><DialogHeader className="border-b border-neutral-800 px-5 py-4 pr-12 text-left sm:px-6"><DialogTitle className="flex items-center gap-2 text-base font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-emerald-400/10"><Smartphone className="size-4 text-emerald-300" /></span>Publish Mobile App</DialogTitle><DialogDescription className="mt-1 text-xs leading-5 text-zinc-500">Préparez une distribution mobile pour <span className="font-medium text-zinc-300">{projectName}</span>. Les artefacts restent produits uniquement par un runner mobile isolé.</DialogDescription></DialogHeader><Tabs defaultValue="android" className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6"><TabsList className="grid h-9 w-full grid-cols-2 rounded-lg border border-neutral-800 bg-[#15151a] p-1"><TabsTrigger value="android" className="rounded-md text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-950">Android</TabsTrigger><TabsTrigger value="ios" className="rounded-md text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-950">iOS</TabsTrigger></TabsList><TabsContent value="android" className="mt-4 space-y-4"><section className="rounded-xl border border-neutral-800 bg-[#15151a] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><PackageCheck className="size-4 text-emerald-300" />Personal Use &amp; Limited Distribution</p><p className="mt-1 text-xs leading-5 text-zinc-500">Installez un APK signé sur des appareils de test, sans mise en ligne publique.</p></div><Badge className={`border ${hasUnpackagedChanges ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"}`}>{hasUnpackagedChanges ? "You have unpackaged changes" : "Package up to date"}</Badge></div><div className="mt-4 rounded-lg border border-neutral-800 bg-black/20 p-3"><p className="text-xs font-medium text-zinc-200">Configuration avant compilation</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Nom de l’application" hint={attemptedBuild ? errors.appName : undefined}><input aria-label="Nom de l’application" disabled={isPreparingBuild} value={configuration.appName} onChange={event => update("appName", event.target.value)} maxLength={60} className={`${inputClass} border border-neutral-800 focus:border-emerald-300/60 focus:ring-emerald-300/10`} /></Field><Field label="Version" hint={attemptedBuild ? errors.version : undefined}><input aria-label="Version" disabled={isPreparingBuild} value={configuration.version} onChange={event => update("version", event.target.value)} inputMode="decimal" placeholder="1.0.0" className={`${inputClass} border border-neutral-800 font-mono focus:border-emerald-300/60 focus:ring-emerald-300/10`} /></Field><div className="sm:col-span-2"><Field label="Bundle ID"><input aria-label="Bundle ID" aria-invalid={!isBundleIdValid} disabled={isPreparingBuild} value={configuration.bundleId} onChange={event => update("bundleId", event.target.value.toLowerCase())} spellCheck={false} placeholder="com.votreentreprise.votreapp" className={`${inputClass} border font-mono ${isBundleIdValid ? "border-emerald-300/45 focus:border-emerald-300 focus:ring-emerald-300/10" : "border-amber-300/60 focus:border-amber-300 focus:ring-amber-300/10"}`} /></Field><p aria-live="polite" className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${isBundleIdValid ? "text-emerald-200" : "text-amber-200"}`}>{isBundleIdValid ? <><CheckCircle2 className="size-3" />Bundle ID valide — format standard prêt pour Android.</> : <><AlertTriangle className="size-3" />{bundleIdError} La préparation APK est bloquée.</>}</p></div></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-black/20 p-3"><div><p className="text-xs font-medium text-zinc-200">Android package status</p><p className="mt-1 text-[11px] text-zinc-500">{deliveredApk ? "APK livré par le runner isolé." : activeJob ? `Runner job ${activeJob.state.replace(/_/g, " ")} · APK non livré` : prepared ? "Runner contract is prepared; an Android-capable runner is still required." : "No Android runner or APK artifact is connected."}</p><AndroidBuildProgressPanel state={buildProgress} /></div><Button disabled={disabledBuild} onClick={() => void submitAndroidBuild()} className="h-9 rounded-lg bg-emerald-300 px-3 text-xs font-semibold text-zinc-950 hover:bg-emerald-200 disabled:bg-zinc-800 disabled:text-zinc-500">{isPreparingBuild ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />}{isPreparingBuild ? "Préparation…" : "Build APK"}</Button></div>{deliveredApk ? <ApkReadyCard apk={deliveredApk} /> : <p className="mt-3 text-[11px] text-zinc-500">APK indisponible tant qu’un runner Android isolé n’a pas livré un artefact vérifié.</p>}{!isBundleIdValid && <p className="mt-3 text-[11px] text-amber-200">Corrigez le Bundle ID pour autoriser la préparation de l’APK.</p>}{!hasBuild && <p className="mt-3 text-[11px] text-amber-200">Créez d’abord les fichiers de l’application avant de préparer un build mobile.</p>}</section><section className="rounded-xl border border-neutral-800 bg-[#15151a] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-zinc-100">Version history</p><p className="mt-1 text-xs text-zinc-500">Les versions source réelles sont modifiables. Les téléchargements APK apparaîtront seulement après un build isolé réussi.</p></div><Badge className="border border-neutral-800 bg-black/20 text-zinc-400">{versions.length} source version{versions.length === 1 ? "" : "s"}</Badge></div><div className="mt-3 space-y-2">{versions.slice(0, 3).map((version, index) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-black/20 px-3 py-2.5"><div><p className="text-xs font-medium text-zinc-200">Version 1.0.{Math.max(1, versions.length - index)} <span className="ml-1 text-[10px] font-normal text-zinc-600">source</span></p><p className="mt-0.5 text-[10px] text-zinc-500">{version.summary || version.origin} · {new Date(version.createdAt).toLocaleDateString()}</p></div><Button variant="outline" size="sm" onClick={onEditSources} className="h-7 border-neutral-800 bg-transparent px-2 text-[10px] text-zinc-300 hover:bg-white/[0.05] hover:text-white">Modifier</Button></div>)}{!versions.length && <div className="rounded-lg border border-dashed border-neutral-800 p-3 text-xs text-zinc-500">Aucune version source n’est disponible. Générez l’application pour commencer.</div>}</div></section><Collapsible open={googlePlayOpen} onOpenChange={setGooglePlayOpen} className="rounded-xl border border-neutral-800 bg-[#15151a]"><CollapsibleTrigger asChild><button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"><span><span className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Play className="size-4 text-emerald-300" />Publish to Google Play</span><span className="mt-1 block text-xs text-zinc-500">Configuration officielle, certificat et soumission Play Console.</span></span><ChevronDown className={`size-4 text-zinc-500 transition-transform ${googlePlayOpen ? "rotate-180" : ""}`} /></button></CollapsibleTrigger><CollapsibleContent className="border-t border-neutral-800 px-4 pb-4 pt-3"><p className="text-xs font-medium text-zinc-200">Android certificate SHA-1</p><p className="mt-1 font-mono text-[10px] text-zinc-600">Available after isolated Android signing</p><p className="mt-3 text-xs leading-5 text-zinc-500">Les services backend, API et secrets associés doivent être configurés dans le runner isolé et dans les consoles du fournisseur. Ils ne sont ni exportés vers l’APK ni exposés dans Lakay.</p><div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-[11px] text-amber-100"><AlertTriangle className="size-3.5 shrink-0 text-amber-300" />La publication Play Console n’est pas encore connectée à ce projet.</div></CollapsibleContent></Collapsible></TabsContent><TabsContent value="ios" className="mt-4"><section className="rounded-xl border border-neutral-800 bg-[#15151a] p-4"><p className="text-sm font-semibold text-zinc-100">iOS &amp; TestFlight</p><p className="mt-1 text-xs leading-5 text-zinc-500">La génération IPA, la signature Apple et la diffusion TestFlight nécessitent un runner macOS isolé ainsi qu’un compte Apple Developer. Aucun certificat Apple n’est géré dans l’interface Lakay.</p><Badge className="mt-3 border border-neutral-800 bg-black/20 text-zinc-400">iOS runner not configured</Badge></section></TabsContent></Tabs></DialogContent></Dialog>;
}
