import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const examples = ["A collaborative home-renovation planner for couples.", "A focused tool that helps small teams prepare for customer calls.", "A local discovery app for independent bookstores and their events."];

export default function NewProject() {
  const [, navigate] = useLocation();
  const [description, setDescription] = useState("");
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
    createProject.mutate({ description });
  };

  return <DashboardLayout><div className="mx-auto max-w-3xl px-1 py-3 sm:px-4 sm:py-8"><button onClick={() => navigate("/dashboard")} className="mb-9 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-200"><ArrowLeft className="size-3.5" />Back to projects</button><div className="rounded-[24px] border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.018] p-5 sm:p-8"><div className="grid size-10 place-items-center rounded-xl bg-violet-400/[0.12]"><Sparkles className="size-5 text-violet-200" /></div><p className="mt-7 font-mono text-[11px] uppercase tracking-[0.18em] text-violet-300">New project</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-white sm:text-4xl">What are you hoping to build?</h1><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">Describe the people, the problem, and the feeling you want the product to create. Rough is absolutely fine.</p><div className="mt-8"><Textarea value={description} onChange={event => setDescription(event.target.value)} disabled={createProject.isPending} placeholder="For example: A service that helps neighborhood bakers take pre-orders without losing the personal touch..." className="min-h-44 rounded-2xl border-white/[0.1] bg-black/20 px-4 py-4 text-[15px] leading-6 text-zinc-200 placeholder:text-zinc-600 focus-visible:border-violet-400/60 focus-visible:ring-violet-400/20" /><div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-zinc-600">{description.length} / 6000</span><span className="hidden text-[11px] text-zinc-600] sm:block">Be specific, not formal.</span></div></div><div className="mt-7 flex flex-col gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2 text-xs leading-5 text-zinc-500"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-violet-300" />Lakay will create your initial product brief, suggested stack, components, and milestones.</div><Button disabled={createProject.isPending} onClick={create} className="h-10 shrink-0 rounded-xl bg-violet-400 px-4 font-semibold text-zinc-950 hover:bg-violet-300 active:scale-[0.97]">{createProject.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />Shaping your plan</> : <>Create project <ArrowRight className="ml-2 size-4" /></>}</Button></div></div><div className="mt-6"><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">Need a starting point?</p><div className="mt-3 flex flex-wrap gap-2">{examples.map(example => <button key={example} disabled={createProject.isPending} onClick={() => setDescription(example)} className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:border-violet-300/20 hover:bg-violet-400/[0.06] hover:text-zinc-200">{example}</button>)}</div></div></div></DashboardLayout>;
}
