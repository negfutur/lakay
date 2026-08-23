import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ChevronDown, House, LayoutDashboard, Loader2, Mic, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const templates = [
  { title: "SaaS Dashboard", subtitle: "Statistiques, abonnements, analytics", prompt: "Un SaaS dashboard pour suivre les statistiques, les abonnements et les analytics de mon entreprise.", icon: LayoutDashboard },
  { title: "Location", subtitle: "Gestion de biens, réservations, paiements", prompt: "Une application de location avec gestion de biens, réservations et paiements sécurisés.", icon: House },
  { title: "E-commerce", subtitle: "Catalogue, panier, checkout sécurisé", prompt: "Un site e-commerce avec catalogue, panier et checkout sécurisé.", icon: ShoppingBag },
];

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
  const canGenerate = description.trim().length > 0;

  return <DashboardLayout><div className="lakay-density-aware relative isolate min-h-[calc(100svh-5rem)] overflow-hidden px-4 py-5 sm:px-8 sm:py-9">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"><div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(52,211,153,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.06)_1px,transparent_1px)] [background-size:32px_32px]" /><div className="absolute left-1/2 top-8 size-[38rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.11] blur-[115px]" /><div className="absolute -right-40 top-1/3 size-[28rem] rounded-full bg-teal-500/[0.075] blur-[100px]" /><div className="absolute -left-32 bottom-0 size-[24rem] rounded-full bg-emerald-950/30 blur-[100px]" /></div>
    <div className="mx-auto flex w-full max-w-5xl flex-col">
      <button onClick={() => navigate("/dashboard")} className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"><ArrowLeft className="size-3.5" />Retour aux projets</button>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center pb-12 pt-16 text-center sm:pb-20 sm:pt-24">
        <div className="mx-auto grid size-10 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.11] shadow-[0_0_48px_rgba(16,185,129,0.18)]"><Sparkles className="size-4 text-emerald-200" /></div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Nouveau projet</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-balance text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.065em] text-white sm:text-5xl lg:text-6xl">Quelle est votre vision aujourd’hui&nbsp;?</h1>
        <form onSubmit={event => { event.preventDefault(); create(); }} className="lakay-density-prompt mt-9 w-full text-left sm:mt-11">
          <div className="group relative flex min-h-[68px] items-center justify-between rounded-[22px] border border-emerald-100/[0.14] bg-zinc-950/70 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors focus-within:border-emerald-300/50 focus-within:shadow-[0_24px_80px_rgba(6,78,59,0.28)] sm:min-h-[76px] sm:rounded-[24px] sm:p-2.5">
            <button type="button" onClick={() => toast.message("Les pièces jointes seront disponibles dans une prochaine étape.")} aria-label="Ajouter une pièce jointe" className="grid size-10 shrink-0 place-items-center rounded-xl text-zinc-500 transition-colors hover:bg-emerald-400/[0.09] hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"><Plus className="size-4" /></button>
            <Input value={description} onChange={event => { setDescription(event.target.value); setRequestId(crypto.randomUUID()); }} disabled={createProject.isPending} aria-label="Décrivez l’application que vous voulez créer" placeholder="Ex: App de location de vélos entre particuliers..." className="h-12 flex-1 min-w-0 border-0 bg-transparent px-2 pr-[120px] text-[15px] text-zinc-100 shadow-none placeholder:text-zinc-600 focus-visible:ring-0 sm:text-base" />
            <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => toast.message("Mode Build sélectionné.")} className="inline-flex h-10 items-center rounded-xl bg-emerald-400 px-3 text-xs font-semibold text-emerald-950 shadow-[0_8px_28px_rgba(16,185,129,0.25)] transition-colors hover:bg-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 sm:px-4 sm:text-sm">Build <ChevronDown className="ml-1.5 size-3.5" /></button><button type="button" onClick={() => toast.message("La saisie vocale n’est pas encore activée.")} aria-label="Utiliser la saisie vocale" className="grid size-10 place-items-center rounded-xl text-zinc-500 transition-colors hover:bg-emerald-400/[0.09] hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"><Mic className="size-4" /></button></div>
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-zinc-600"><span>{description.length} / 6000</span><span className="hidden sm:inline">Entrée pour une nouvelle ligne · Build pour lancer</span></div>
          <div className="mt-8 sm:mt-10"><p className="text-center text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300/80">Modèles de départ</p><div className="mt-3 grid gap-2 text-left sm:grid-cols-3">{templates.map(template => <button key={template.title} type="button" disabled={createProject.isPending} onClick={() => { setDescription(template.prompt); setRequestId(crypto.randomUUID()); }} className="group rounded-2xl border border-white/[0.08] bg-black/20 p-3.5 text-left transition-[transform,background-color,border-color] duration-150 hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-emerald-400/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-60"><template.icon className="size-4 text-emerald-300 transition-transform duration-150 group-hover:scale-110" /><p className="mt-4 text-sm font-semibold text-zinc-200">{template.title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{template.subtitle}</p></button>)}</div></div>
          <div className="mt-7 flex flex-col items-center gap-3 sm:mt-8"><Button type="submit" disabled={createProject.isPending || !canGenerate} className="h-11 min-w-[222px] rounded-xl bg-emerald-400 px-5 text-xs font-bold uppercase tracking-[0.08em] text-emerald-950 shadow-[0_10px_34px_rgba(16,185,129,0.25)] hover:bg-emerald-300 active:scale-[0.97] disabled:bg-emerald-950/45 disabled:text-emerald-100/35 disabled:shadow-none">{createProject.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />Création en cours</> : "Générer l’application"}</Button><p className="text-[11px] text-zinc-600">Lakay prépare le brief, l’architecture et les premières étapes.</p></div>
        </form>
      </section>
    </div>
  </div></DashboardLayout>;
}
