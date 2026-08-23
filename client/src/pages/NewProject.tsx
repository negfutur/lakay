import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ChevronDown, Loader2, Mic, Paperclip, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const quickIdeas = ["SaaS Dashboard", "Application de location", "E-commerce"];

export default function NewProject() {
  const [, navigate] = useLocation();
  const [description, setDescription] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const createProject = trpc.projects.create.useMutation({
    onSuccess: project => {
      if (project) navigate(`/projects/${project.id}`);
    },
    onError: error => toast.error(error.message || "Lakay could not create the project."),
  });

  const create = () => {
    if (description.trim().length < 12) {
      toast.message("Add a little more detail so Lakay can make a useful plan.");
      return;
    }
    createProject.mutate({ description, requestId });
  };

  return <DashboardLayout><div className="lakay-density-aware relative isolate min-h-[calc(100svh-5rem)] overflow-hidden px-4 py-5 sm:px-8 sm:py-9">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"><div className="absolute left-1/2 top-8 size-[38rem] -translate-x-1/2 rounded-full bg-violet-500/[0.12] blur-[115px]" /><div className="absolute -right-40 top-1/3 size-[28rem] rounded-full bg-fuchsia-500/[0.075] blur-[100px]" /><div className="absolute -left-32 bottom-0 size-[24rem] rounded-full bg-sky-500/[0.055] blur-[100px]" /></div>
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <button onClick={() => navigate("/dashboard")} className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"><ArrowLeft className="size-3.5" />Retour aux projets</button>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center pb-12 pt-16 text-center sm:pb-20 sm:pt-24">
        <div className="mx-auto grid size-10 place-items-center rounded-2xl border border-violet-300/15 bg-violet-400/[0.11] shadow-[0_0_48px_rgba(139,92,246,0.18)]"><Sparkles className="size-4 text-violet-200" /></div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-violet-300">Nouveau projet</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-balance text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.065em] text-white sm:text-5xl lg:text-6xl">Quelle est votre vision aujourd’hui&nbsp;?</h1>
        <form onSubmit={event => { event.preventDefault(); create(); }} className="lakay-density-prompt mt-9 w-full text-left sm:mt-11">
          <div className="group relative min-h-[68px] rounded-[22px] border border-white/[0.12] bg-zinc-950/65 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors focus-within:border-violet-300/50 focus-within:shadow-[0_24px_80px_rgba(76,29,149,0.2)] sm:min-h-[76px] sm:rounded-[24px] sm:p-2.5">
            <button type="button" onClick={() => toast.message("Les pièces jointes seront disponibles dans une prochaine étape.")} aria-label="Ajouter une pièce jointe" className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-violet-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"><Plus className="size-4" /><Paperclip className="sr-only" /></button>
            <Textarea value={description} onChange={event => { setDescription(event.target.value); setRequestId(crypto.randomUUID()); }} disabled={createProject.isPending} rows={1} aria-label="Décrivez l’application que vous voulez créer" placeholder="Décrivez l’application que vous voulez créer…" className="h-12 min-h-12 w-full min-w-0 resize-none overflow-hidden whitespace-nowrap border-0 bg-transparent px-11 pr-36 py-2 text-[15px] leading-6 text-zinc-100 shadow-none placeholder:text-zinc-600 focus-visible:ring-0 sm:text-base" />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1"><Button type="submit" disabled={createProject.isPending} className="h-10 rounded-xl bg-violet-400 px-3 text-xs font-semibold text-zinc-950 shadow-[0_8px_28px_rgba(139,92,246,0.3)] hover:bg-violet-300 active:scale-[0.97] sm:px-4 sm:text-sm">{createProject.isPending ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Création</> : <>Build <ChevronDown className="ml-1.5 size-3.5" /></>}</Button><button type="button" onClick={() => toast.message("La saisie vocale n’est pas encore activée.")} aria-label="Utiliser la saisie vocale" className="grid size-10 place-items-center rounded-xl text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-violet-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"><Mic className="size-4" /></button></div>
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-zinc-600"><span>{description.length} / 6000</span><span className="hidden sm:inline">Entrée pour une nouvelle ligne · Build pour lancer</span></div>
        </form>
        <div className="mt-7 sm:mt-8"><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-600">Commencer avec une idée</p><div className="mt-3 flex flex-wrap justify-center gap-2">{quickIdeas.map(idea => <button key={idea} disabled={createProject.isPending} onClick={() => { setDescription(idea); setRequestId(crypto.randomUUID()); }} className="rounded-full border border-white/[0.09] bg-white/[0.035] px-3.5 py-2 text-xs text-zinc-400 transition-[transform,background-color,border-color,color] duration-150 hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-violet-400/[0.09] hover:text-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:cursor-not-allowed disabled:opacity-60">{idea}</button>)}</div></div>
      </section>
    </div>
  </div></DashboardLayout>;
}
