import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowUp, Globe2, Loader2, Mic, Plus, Sparkles, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type BuildTarget = "web" | "mobile";

export default function NewProject() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<BuildTarget>("web");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const { data: creditBalance } = trpc.billing.balance.useQuery(undefined, { enabled: Boolean(user) });
  const createProject = trpc.projects.create.useMutation({
    onSuccess: project => {
      if (project) navigate(`/projects/${project.id}?handoff=created`);
    },
    onError: error => toast.error(error.message || "Lakay ne peut pas créer ce projet pour le moment."),
  });

  const firstName = useMemo(() => user?.name?.trim().split(/\s+/)[0] || "", [user?.name]);
  const canGenerate = description.trim().length >= 12;
  const createDescription = `${target === "mobile" ? "Application mobile" : "Application web"} : ${description.trim()}`;

  const create = () => {
    if (!canGenerate) {
      toast.message("Ajoutez quelques détails pour que Lakay puisse construire une base utile.");
      return;
    }
    createProject.mutate({ description: createDescription, requestId });
  };

  return <DashboardLayout><div className="lakay-density-aware relative isolate min-h-[calc(100svh-3rem)] overflow-hidden bg-[#080d0d] px-4 py-5 text-white sm:min-h-screen sm:px-8 sm:py-9">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"><div className="absolute inset-0 opacity-[0.2] [background-image:linear-gradient(rgba(45,212,191,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,0.055)_1px,transparent_1px)] [background-size:32px_32px]" /><div className="absolute left-1/2 top-[-13rem] size-[42rem] -translate-x-1/2 rounded-full bg-sky-500/20 blur-[130px]" /><div className="absolute -left-44 top-1/3 size-[28rem] rounded-full bg-emerald-500/[0.13] blur-[120px]" /><div className="absolute -right-44 bottom-[-7rem] size-[34rem] rounded-full bg-teal-500/[0.10] blur-[130px]" /><div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#080d0d] via-[#080d0d]/80 to-transparent" /></div>
    <div className="relative mx-auto flex w-full max-w-6xl flex-col">
      <header className="flex items-center justify-between gap-3"><button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-zinc-500 transition-colors hover:text-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"><ArrowLeft className="size-3.5" />Retour aux projets</button><div className="inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[0.07] px-3 py-1.5 text-xs font-semibold tabular-nums text-amber-200"><Sparkles className="size-3.5 fill-amber-200/30 text-amber-200" />{creditBalance?.balance ?? 0}<span className="hidden text-amber-100/60 sm:inline">crédits</span></div></header>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center pb-10 pt-16 sm:pb-20 sm:pt-24">
        <div className="mx-auto grid size-11 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-400/[0.10] shadow-[0_0_50px_rgba(16,185,129,0.18)]"><Sparkles className="size-4 text-emerald-100" /></div>
        <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Première création</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-balance text-center text-[2.2rem] font-semibold leading-[1.04] tracking-[-0.065em] text-white sm:text-5xl">Que souhaitez-vous créer en premier{firstName ? `, ${firstName}` : ""}&nbsp;?</h1>
        <div className="mt-9 flex justify-center gap-2 sm:mt-11" role="group" aria-label="Type d’application"><button type="button" aria-pressed={target === "web"} onClick={() => setTarget("web")} className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${target === "web" ? "border-emerald-200/30 bg-white/[0.12] text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]" : "border-white/[0.08] bg-black/20 text-zinc-500 hover:text-zinc-300"}`}><Globe2 className="size-4" />Web App</button><button type="button" aria-pressed={target === "mobile"} onClick={() => setTarget("mobile")} className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${target === "mobile" ? "border-emerald-200/30 bg-white/[0.12] text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]" : "border-white/[0.08] bg-black/20 text-zinc-500 hover:text-zinc-300"}`}><Smartphone className="size-4" />Mobile App</button></div>
        <form onSubmit={event => { event.preventDefault(); create(); }} className="lakay-density-prompt mt-4 w-full sm:mt-5"><div className={`relative overflow-hidden rounded-[28px] border border-white/[0.13] bg-[#161c1c]/90 shadow-[0_28px_90px_rgba(0,0,0,0.36)] backdrop-blur-xl transition-[border-color,box-shadow,opacity] duration-200 focus-within:border-emerald-300/50 focus-within:shadow-[0_28px_90px_rgba(6,78,59,0.32)] ${createProject.isPending ? "opacity-80" : ""}`}><Textarea value={description} onChange={event => { setDescription(event.target.value); setRequestId(crypto.randomUUID()); }} disabled={createProject.isPending} aria-label="Décrivez l’idée de votre application" placeholder="Décrivez votre idée, Lakay lui donnera vie…" className="min-h-[190px] w-full resize-none border-0 bg-transparent px-6 pb-20 pt-6 text-lg leading-8 text-zinc-100 shadow-none placeholder:text-zinc-500 focus-visible:ring-0 sm:min-h-[220px] sm:px-7 sm:pt-7" /><div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 sm:inset-x-5 sm:bottom-5"><button type="button" onClick={() => toast.message("Les pièces jointes seront disponibles dans une prochaine étape.")} aria-label="Ajouter une pièce jointe" disabled={createProject.isPending} className="grid size-11 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:opacity-40"><Plus className="size-6" /></button><div className="flex items-center gap-2"><button type="button" onClick={() => toast.message("La saisie vocale n’est pas encore activée.")} aria-label="Utiliser la saisie vocale" disabled={createProject.isPending} className="grid size-11 place-items-center rounded-full bg-white/[0.09] text-white transition-colors hover:bg-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:opacity-40"><Mic className="size-5" /></button><button type="submit" disabled={createProject.isPending || !canGenerate} aria-label="Générer l’application" className="grid size-11 place-items-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_10px_32px_rgba(16,185,129,0.30)] transition-colors hover:bg-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 disabled:bg-white/[0.10] disabled:text-zinc-600 disabled:shadow-none"><Loader2 className={`size-5 ${createProject.isPending ? "animate-spin" : "hidden"}`} /><ArrowUp className={`size-6 ${createProject.isPending ? "hidden" : ""}`} /></button></div></div></div><div aria-live="polite" className="mt-3 flex items-center justify-between px-1 text-[11px] text-zinc-500"><span>{createProject.isPending ? "Lakay prépare votre espace de création…" : `${description.length} / 6000`}</span><span>{target === "mobile" ? "Format mobile sélectionné" : "Format web sélectionné"}</span></div></form>
      </section>
    </div>
  </div></DashboardLayout>;
}
