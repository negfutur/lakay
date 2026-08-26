import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Apple, ArrowLeft, CheckCircle2, CircleDollarSign, Download, ExternalLink, ImagePlus, Info, Loader2, Rocket, ShieldCheck, Smartphone, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const isValidVersion = (value: string) => /^\d+\.\d+\.\d+$/.test(value.trim());
const isValidBundleId = (value: string) => /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$/.test(value.trim());
const appIdFromName = (value: string) => {
  const suffix = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").replace(/^\.+|\.+$/g, "").slice(0, 42) || "monapp";
  return `com.lakay.${suffix}`;
};

type MobileJob = {
  id: string;
  state: string;
  apk?: { downloadUrl: string; filename: string; expiresAt: string | Date } | null;
};

function buildPresentation(job: MobileJob | undefined) {
  if (!job) return { progress: 0, label: "Prête à être lancée", detail: "Vos informations seront vérifiées avant l’envoi.", tone: "idle" as const };
  if (job.apk?.downloadUrl && job.state === "finished") return { progress: 100, label: "Votre APK est prête", detail: "Téléchargez-la sur votre téléphone pour tester l’application comme une vraie app.", tone: "success" as const };
  if (job.state === "failed") return { progress: 100, label: "La génération a besoin d’une correction", detail: "Vos réglages sont conservés. Vous pouvez corriger puis relancer la génération.", tone: "error" as const };
  if (job.state === "assigned") return { progress: 38, label: "Préparation de l’environnement Android", detail: "La source sécurisée est en cours de prise en charge.", tone: "running" as const };
  if (["build", "building", "submitted"].includes(job.state)) return { progress: 72, label: "Création de votre fichier Android", detail: "EAS compile l’application. Vous recevrez le téléchargement dès que le fichier sera vérifié.", tone: "running" as const };
  return { progress: 16, label: "Génération placée dans la file", detail: "Votre APK sera compilée dès que l’environnement Android est disponible.", tone: "running" as const };
}

export default function MobilePublishPage() {
  const [, params] = useRoute("/projects/:projectId/publish");
  const projectId = params?.projectId ?? "";
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const { data: builder, isLoading: builderLoading } = trpc.builder.get.useQuery({ projectId }, { enabled: Boolean(projectId), refetchInterval: 5_000 });
  const { data: mobileAccess, isLoading: mobileAccessLoading } = trpc.builder.getMobileBuildAccess.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const authorizeTestBuild = trpc.builder.authorizeSimulatedMobileBuild.useMutation({
    onSuccess: async () => {
      await utils.builder.getMobileBuildAccess.invalidate({ projectId });
      toast.success("Accès de test activé. Aucun paiement réel n’a été effectué.");
    },
    onError: () => toast.error("Impossible d’activer l’accès de test pour le moment."),
  });
  const prepare = trpc.builder.prepareMobileBuild.useMutation({
    onSuccess: async () => {
      await utils.builder.get.invalidate({ projectId });
      toast.success("Configuration validée. Vous pouvez maintenant lancer l’APK ou l’AAB.");
    },
    onError: error => toast.error(error.message || "La préparation n’a pas pu démarrer."),
  });
  const dispatch = trpc.builder.dispatchMobileBuild.useMutation({
    onSuccess: async result => {
      await utils.builder.get.invalidate({ projectId });
      toast.success(result.buildProfile === "preview" ? "La génération de l’APK a démarré." : "La génération de l’AAB a démarré.");
    },
    onError: error => toast.error(error.message || "La génération Android n’a pas pu être lancée."),
  });

  const [appName, setAppName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [bundleId, setBundleId] = useState("");
  const [iconName, setIconName] = useState<string | null>(null);
  const [splashName, setSplashName] = useState<string | null>(null);
  const [buildProfile, setBuildProfile] = useState<"preview" | "production">("preview");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [showRequired, setShowRequired] = useState(false);

  const hasBuild = Boolean(builder?.files.length);
  const title = project?.name ?? "Application mobile";
  const displayName = appName.trim() || title;
  const suggestedBundleId = useMemo(() => appIdFromName(displayName), [displayName]);
  const effectiveBundleId = bundleId.trim() || suggestedBundleId;
  const versionError = version.length > 0 && !isValidVersion(version) ? "Utilisez le format 1.0.0 (trois nombres séparés par des points)." : "";
  const bundleIdError = bundleId.length > 0 && !isValidBundleId(bundleId) ? "Utilisez un identifiant inversé, par exemple com.votreentreprise.votreapp." : "";
  const appNameError = showRequired && !appName.trim() ? "Indiquez le nom que vos utilisateurs verront sur leur téléphone." : "";
  const versionRequired = showRequired && !version.trim() ? "Indiquez une version, par exemple 1.0.0." : "";
  const metadataValid = Boolean(appName.trim() && isValidVersion(version) && !bundleIdError);
  const mobilePackageReady = builder?.execution?.mode === "full_stack_runner" && Boolean(builder.execution?.manifest);
  const latestJob = (builder?.runnerJobs?.[0] as MobileJob | undefined);
  const build = buildPresentation(latestJob);
  const isBuilding = build.tone === "running";
  const canPrepare = !prepare.isPending && !mobileAccessLoading && Boolean(mobileAccess?.authorized) && hasBuild && metadataValid && !isBuilding;

  useEffect(() => {
    if (appName || !project?.name) return;
    setAppName(project.name);
  }, [appName, project?.name]);

  const launchPreparation = () => {
    setShowRequired(true);
    if (!hasBuild) return toast.info("Créez d’abord une version de votre application.");
    if (!metadataValid) return toast.error("Vérifiez les champs indiqués avant de continuer.");
    if (!mobileAccess?.authorized) return toast.info("Activez d’abord l’accès de génération pour ce projet.");
    prepare.mutate({ projectId, appName: displayName, version: version.trim(), bundleId: effectiveBundleId });
  };
  const confirmDispatch = () => {
    setConfirmationOpen(false);
    dispatch.mutate({ projectId, buildProfile });
  };
  const field = (invalid: boolean) => `mt-1.5 border bg-[#0d1015] ${invalid ? "border-rose-400/70 focus-visible:ring-rose-400/30" : "border-white/[0.1] focus-visible:ring-emerald-300/30"}`;

  if (projectLoading || builderLoading) return <DashboardLayout><div className="grid min-h-[70vh] place-items-center"><Loader2 className="size-6 animate-spin text-emerald-300" /></div></DashboardLayout>;

  return <DashboardLayout><main className="min-h-screen bg-[#0b0d10] px-4 py-6 text-zinc-100 sm:px-6 sm:py-8"><div className="mx-auto max-w-4xl"><button onClick={() => navigate(`/projects/${projectId}/build`)} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"><ArrowLeft className="size-4" />Retour au projet</button><header className="mt-7"><p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Publication mobile</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Préparez {title} pour mobile.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Configurez votre application, lancez la génération et téléchargez l’APK dès qu’elle est réellement prête.</p></header><Tabs defaultValue="android" className="mt-8"><TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl bg-white/[0.05] p-1"><TabsTrigger value="android" className="gap-2 rounded-lg"><Smartphone className="size-4" />Android</TabsTrigger><TabsTrigger value="ios" className="gap-2 rounded-lg"><Apple className="size-4" />iOS <span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-[10px] text-amber-100">Premium</span></TabsTrigger></TabsList><TabsContent value="android" className="mt-6 space-y-5"><section className="rounded-2xl border border-white/[0.08] bg-[#14171d] p-5 shadow-sm sm:p-6"><p className="text-base font-semibold">Informations générales</p><p className="mt-1 text-sm text-zinc-500">Les champs marqués sont vérifiés avant la génération.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">Nom de l’application <span className="text-emerald-200">*</span><Input aria-invalid={Boolean(appNameError)} value={appName} onChange={event => setAppName(event.target.value)} placeholder="Ex. PenséeFlash" className={field(Boolean(appNameError))} />{appNameError ? <span role="alert" className="mt-1 block text-xs text-rose-200">{appNameError}</span> : appName ? <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-200"><CheckCircle2 className="size-3" />Nom prêt</span> : null}</label><label className="text-sm">Version <span className="text-emerald-200">*</span><Input aria-invalid={Boolean(versionError || versionRequired)} value={version} onChange={event => setVersion(event.target.value)} className={field(Boolean(versionError || versionRequired))} />{versionError || versionRequired ? <span role="alert" className="mt-1 block text-xs text-rose-200">{versionError || versionRequired}</span> : <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-200"><CheckCircle2 className="size-3" />Format correct</span>}</label><label className="text-sm sm:col-span-2">Identifiant Android <span className="text-xs text-zinc-500">(optionnel pour un APK de test)</span><Input aria-invalid={Boolean(bundleIdError)} value={bundleId} onChange={event => setBundleId(event.target.value.toLowerCase())} placeholder={suggestedBundleId} className={field(Boolean(bundleIdError))} />{bundleIdError ? <span role="alert" className="mt-1 block text-xs text-rose-200">{bundleIdError}</span> : <span className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-zinc-500"><Info className="mt-0.5 size-3 shrink-0 text-sky-200" />Android a besoin d’un identifiant technique unique. Pour un APK de test, Lakay utilisera automatiquement <strong className="font-medium text-zinc-300">{effectiveBundleId}</strong>. Personnalisez-le avant le Play Store.</span>}</label></div></section><section className="rounded-2xl border border-white/[0.08] bg-[#14171d] p-5 shadow-sm sm:p-6"><p className="text-base font-semibold">Visuels</p><p className="mt-1 text-sm text-zinc-500">Facultatifs pour tester rapidement ; recommandés avant toute publication.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.14] bg-[#0d1015] text-center hover:border-emerald-300/45"><ImagePlus className="size-5 text-emerald-300" /><span className="mt-2 text-sm">{iconName || "Ajouter une icône"}</span><input type="file" accept="image/png" className="sr-only" onChange={event => setIconName(event.target.files?.[0]?.name || null)} /></label><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.14] bg-[#0d1015] text-center hover:border-emerald-300/45"><ImagePlus className="size-5 text-sky-200" /><span className="mt-2 text-sm">{splashName || "Ajouter un écran de démarrage"}</span><input type="file" accept="image/png" className="sr-only" onChange={event => setSplashName(event.target.files?.[0]?.name || null)} /></label></div></section>{mobileAccess?.isAdministrator ? <section className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-200" /><div><p className="text-base font-semibold">Accès test administrateur — génération incluse</p><p className="mt-1 text-sm leading-6 text-emerald-50/75">Votre compte peut générer et télécharger des versions Android sans limite de test.</p></div></div></section> : mobileAccess?.authorized ? <section className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] p-5 sm:p-6"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-200" /><div><p className="text-base font-semibold">Accès de test activé</p><p className="mt-1 text-sm leading-6 text-emerald-50/75">La génération mobile est autorisée pour ce projet. Aucun paiement réel n’a été effectué.</p></div></div></section> : <section className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-5 sm:p-6"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 size-5 shrink-0 text-amber-200" /><div><p className="text-base font-semibold">$7 USD — paiement test</p><p className="mt-1 max-w-xl text-sm leading-6 text-zinc-300">Autorisez cette génération Android pour ce projet. Il s’agit d’un test interne : aucun prélèvement réel et aucune transaction Stripe ne seront effectués.</p></div></div><Button onClick={() => authorizeTestBuild.mutate({ projectId })} disabled={mobileAccessLoading || authorizeTestBuild.isPending} className="h-10 bg-amber-200 px-4 font-semibold text-zinc-950 hover:bg-amber-100">{authorizeTestBuild.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CircleDollarSign className="mr-2 size-4" />}{authorizeTestBuild.isPending ? "Activation en cours..." : "Débloquer la génération (test)"}</Button></div></section>}<section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.05] p-5 sm:p-6"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-base font-semibold">Générez votre application Android</p><p className="mt-1 text-sm leading-6 text-zinc-400">{mobilePackageReady ? "Votre configuration est prête. Choisissez le format puis confirmez le lancement." : "Préparez votre package mobile après avoir validé les informations et l’accès au projet."}</p></div>{mobilePackageReady ? <div className="flex flex-wrap items-center gap-2"><button onClick={() => setBuildProfile("preview")} className={`rounded-lg px-3 py-2 text-xs font-medium ${buildProfile === "preview" ? "bg-white text-zinc-950" : "bg-white/[0.08] text-zinc-300"}`}>APK de test</button><button onClick={() => setBuildProfile("production")} className={`rounded-lg px-3 py-2 text-xs font-medium ${buildProfile === "production" ? "bg-white text-zinc-950" : "bg-white/[0.08] text-zinc-300"}`}>AAB Play Store</button><AlertDialog open={confirmationOpen} onOpenChange={setConfirmationOpen}><AlertDialogTrigger asChild><Button disabled={dispatch.isPending || isBuilding} className="h-10 bg-emerald-300 px-4 font-semibold text-zinc-950 hover:bg-emerald-200"><Rocket className="mr-2 size-4" />Lancer la génération</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmer la génération Android</AlertDialogTitle><AlertDialogDescription>Vous allez transmettre la source mobile de ce projet à EAS Build pour générer un {buildProfile === "preview" ? "APK de test" : "AAB pour le Play Store"}. Cette action utilise votre compte Expo et peut consommer sa capacité de build. Aucun paiement Lakay supplémentaire ne sera effectué.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={confirmDispatch}>{dispatch.isPending ? "Lancement..." : "Confirmer et lancer"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div> : <Button onClick={launchPreparation} disabled={!canPrepare} className="h-10 bg-emerald-300 px-4 font-semibold text-zinc-950 hover:bg-emerald-200">{prepare.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}{prepare.isPending ? "Préparation en cours..." : "Préparer la génération"}</Button>}</div>{!metadataValid && showRequired ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] p-3 text-xs leading-5 text-rose-100"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-300" />Complétez les champs encadrés en rouge avant de lancer la génération.</div> : null}<div className={`mt-5 rounded-xl border p-4 ${build.tone === "success" ? "border-emerald-300/30 bg-emerald-300/[0.08]" : build.tone === "error" ? "border-rose-400/30 bg-rose-400/[0.08]" : "border-white/[0.08] bg-black/15"}`}><div className="flex items-start gap-3"><div className={`grid size-9 shrink-0 place-items-center rounded-full ${build.tone === "success" ? "bg-emerald-300/15 text-emerald-200" : build.tone === "error" ? "bg-rose-300/15 text-rose-200" : "bg-violet-300/10 text-violet-200"}`}>{build.tone === "success" ? <CheckCircle2 className="size-5" /> : build.tone === "error" ? <TriangleAlert className="size-5" /> : isBuilding ? <Loader2 className="size-5 animate-spin" /> : <Rocket className="size-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{build.label}</p><span className="font-mono text-xs text-zinc-400">{build.progress}%</span></div><p className="mt-1 text-sm leading-6 text-zinc-400">{build.detail}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className={`h-full rounded-full transition-all duration-700 ${build.tone === "error" ? "bg-rose-300" : build.tone === "success" ? "bg-emerald-300" : "bg-gradient-to-r from-violet-400 to-emerald-300"}`} style={{ width: `${build.progress}%` }} /></div>{latestJob?.apk?.downloadUrl && latestJob.state === "finished" ? <a href={latestJob.apk.downloadUrl} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(110,231,183,0.18)] transition-transform hover:scale-[1.01] hover:bg-emerald-200"><Download className="size-4" />Télécharger l’APK <ExternalLink className="size-3.5" /></a> : null}</div></div></div><details className="mt-5 rounded-xl border border-white/[0.08] bg-black/10 p-4"><summary className="cursor-pointer text-sm font-medium">Options Play Store</summary><p className="mt-2 text-sm leading-6 text-zinc-500">Préparez votre publication officielle lorsque vous serez prêt à diffuser l’application.</p></details></section></TabsContent><TabsContent value="ios" className="mt-6"><div className="grid gap-5 md:grid-cols-2"><section className="rounded-2xl border border-white/[0.08] bg-[#14171d] p-6 shadow-sm"><span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[10px] font-semibold text-emerald-100">Xcode</span><h2 className="mt-4 text-xl font-semibold">Compiler sur votre Mac</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Téléchargez les sources et ouvrez-les dans Xcode pour signer et générer votre application iOS.</p><Button variant="outline" className="mt-5 border-white/[0.12]" onClick={() => window.dispatchEvent(new CustomEvent("lakay-download-source"))}><Download className="mr-2 size-4" />Télécharger les sources Xcode</Button></section><section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-6 shadow-sm"><span className="rounded-full bg-amber-300/15 px-2 py-1 text-[10px] font-semibold text-amber-100">Pro · TestFlight</span><h2 className="mt-4 text-xl font-semibold">App Store &amp; TestFlight</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Préparez votre publication Apple et rassemblez vos informations de compte pour la prochaine étape.</p><Button variant="outline" className="mt-5 border-amber-300/25" disabled><ShieldCheck className="mr-2 size-4" />Préparer la publication Apple</Button></section></div></TabsContent></Tabs></div></main></DashboardLayout>;
}
