import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Laptop, Loader2, MonitorCog, ShieldCheck } from "lucide-react";
import { useLocation, useRoute } from "wouter";

export default function DesktopPublishPage() {
  const [, params] = useRoute("/projects/:projectId/publish/desktop");
  const projectId = params?.projectId ?? "";
  const [, navigate] = useLocation();
  const { data: project, isLoading } = trpc.projects.get.useQuery({ projectId }, { enabled: Boolean(projectId) });

  if (isLoading) return <DashboardLayout><div className="grid min-h-[70vh] place-items-center"><Loader2 className="size-6 animate-spin text-sky-200" /></div></DashboardLayout>;
  if (!project) return <DashboardLayout><div className="mx-auto max-w-md py-28 text-center"><h1 className="text-xl font-semibold text-white">Ce projet n’est pas disponible.</h1></div></DashboardLayout>;

  return <DashboardLayout><main className="min-h-screen bg-[#0b0d12] px-4 py-6 text-zinc-100 sm:px-6 sm:py-10"><div className="mx-auto max-w-4xl"><button onClick={() => navigate(`/projects/${projectId}/publish`)} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft className="size-4" />Centre de publication</button><header className="mt-7 rounded-[28px] border border-sky-300/20 bg-[radial-gradient(circle_at_90%_10%,rgba(56,189,248,0.2),transparent_30%),linear-gradient(135deg,#101d2c,#0a0e15)] p-6 sm:p-10"><Laptop className="size-7 text-sky-200" /><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">Publication ordinateur</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Préparez {project.name} pour un ordinateur.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">Le packaging installable Windows, macOS et Linux nécessite encore un environnement de compilation dédié. Lakay ne prétend pas qu’un fichier desktop existe avant cette étape.</p></header><section className="mt-6 grid gap-4 md:grid-cols-3"><Platform label="Windows" detail="Préparation des sources et signature à réaliser dans l’environnement Windows." /><Platform label="macOS" detail="Préparation des sources et signature Apple à réaliser sur macOS." /><Platform label="Linux" detail="Préparation des sources et package à réaliser dans l’environnement Linux." /></section><section className="mt-6 rounded-3xl border border-sky-300/15 bg-sky-300/[0.05] p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-base font-semibold text-sky-100"><MonitorCog className="size-4" />Prochaine étape</div><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Téléchargez les sources depuis le menu du Builder, puis utilisez Electron, Tauri ou votre chaîne de compilation préférée. Le futur runner desktop sera relié ici quand il sera réellement disponible.</p></div><Button variant="outline" onClick={() => navigate(`/projects/${projectId}/build`)} className="h-10 shrink-0 border-sky-200/25 bg-white/[0.04]"> <Download className="mr-2 size-4" />Voir les sources</Button></div></section></div></main></DashboardLayout>;
}

function Platform({ label, detail }: { label: string; detail: string }) { return <article className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5"><ShieldCheck className="size-5 text-sky-200" /><h2 className="mt-5 text-lg font-semibold">{label}</h2><p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p><span className="mt-5 inline-flex rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-zinc-300">À préparer</span></article>; }
