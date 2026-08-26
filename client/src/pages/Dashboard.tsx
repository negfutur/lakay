import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowRight, FolderPlus, MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function Dashboard() {
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const [, navigate] = useLocation();
  useEffect(() => {
    const postLoginPath = sessionStorage.getItem("lakay-post-manus-login");
    if (postLoginPath === "/settings/password") {
      sessionStorage.removeItem("lakay-post-manus-login");
      navigate(postLoginPath);
    }
  }, [navigate]);

  return (
    <DashboardLayout>
      <div className="lakay-density-aware mx-auto max-w-4xl space-y-7 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-10">
        <section className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Lakay workspace</p><h1 className="mt-2 text-2xl font-semibold tracking-[-0.055em] text-white sm:text-4xl">Continuez à créer.</h1><p className="mt-2 text-sm text-zinc-500">Reprenez là où vous en étiez.</p></div><Button onClick={() => navigate("/projects/new")} className="h-10 shrink-0 rounded-xl bg-emerald-400 px-3.5 font-semibold text-emerald-950 shadow-[0_12px_28px_rgba(16,185,129,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-emerald-300 active:scale-[0.97]"><FolderPlus className="mr-1.5 size-4" />Créer</Button></section>

        <section><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold text-zinc-100">Continuer à créer</h2><span className="text-xs text-zinc-600">{projects?.length ?? 0} projet{(projects?.length ?? 0) > 1 ? "s" : ""}</span></div>{isLoading ? <ProjectSkeleton /> : projects && projects.length > 0 ? <div className="divide-y divide-white/[0.07] rounded-2xl border border-white/[0.08] bg-white/[0.018] px-4 sm:px-5">{projects.map(project => <ProjectRow key={project.id} project={project} />)}</div> : <EmptyProjects onCreate={() => navigate("/projects/new")} />}</section>
      </div>
    </DashboardLayout>
  );
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.018] px-6 py-14 text-center"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.12),transparent_45%)]" /><div className="relative mx-auto max-w-sm"><div className="mx-auto grid size-11 place-items-center rounded-xl border border-violet-300/15 bg-violet-400/[0.1]"><Sparkles className="size-5 text-violet-200" /></div><h3 className="mt-5 font-semibold text-white">Your next project starts here.</h3><p className="mt-2 text-sm leading-6 text-zinc-500">Describe the idea in your own words. Lakay will give it a plan you can build on.</p><Button onClick={onCreate} className="mt-6 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100"><FolderPlus className="mr-2 size-4" />Create a project</Button></div></div>;
}

function ProjectSkeleton() { return <div className="space-y-2 rounded-2xl border border-white/[0.08] p-5">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>; }

type ProjectRowData = {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: Date | string;
};

function ProjectRow({ project }: { project: ProjectRowData }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: async () => {
      await utils.projects.list.invalidate();
      setEditOpen(false);
      toast.success("Project name saved.");
    },
    onError: error => toast.error(error.message),
  });
  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: async () => {
      await utils.projects.list.invalidate();
      setDeleteOpen(false);
      toast.success("Project deleted.");
    },
    onError: error => toast.error(error.message),
  });

  return <><article className="group flex items-center gap-3 py-4 sm:gap-4"><button onClick={() => navigate(`/projects/${project.id}`)} className="grid size-16 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-[radial-gradient(circle_at_30%_25%,rgba(52,211,153,0.25),transparent_30%),linear-gradient(145deg,#1a2227,#11161a)] shadow-inner transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70" aria-label={`Ouvrir ${project.name}`}><span className="grid size-8 place-items-center rounded-lg border border-emerald-200/10 bg-emerald-400/[0.08] text-lg font-semibold text-emerald-200">{project.name.charAt(0).toUpperCase()}</span></button><div className="min-w-0 flex-1"><button onClick={() => navigate(`/projects/${project.id}`)} className="block max-w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"><h3 className="truncate text-[15px] font-semibold tracking-[-0.025em] text-white">{project.name}</h3><p className="mt-1 truncate text-xs text-zinc-500">{project.description}</p><p className="mt-2 text-[10px] text-zinc-600">Créé le {formatDate(project.createdAt)} · {project.status}</p></button></div><div className="flex shrink-0 items-center gap-1"><Link href={`/projects/${project.id}`} className="hidden h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-400/[0.1] sm:inline-flex">Ouvrir <ArrowRight className="size-3.5" /></Link><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-200" aria-label={`Actions pour ${project.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40 border-white/10 bg-[#1a1a20] text-zinc-300"><DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)} className="cursor-pointer focus:bg-white/5">Ouvrir le projet</DropdownMenuItem><DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer focus:bg-white/5"><Pencil className="mr-2 size-3.5" />Renommer</DropdownMenuItem><DropdownMenuSeparator className="bg-white/10" /><DropdownMenuItem onClick={() => setDeleteOpen(true)} className="cursor-pointer text-red-300 focus:bg-red-400/10 focus:text-red-200"><Trash2 className="mr-2 size-3.5" />Supprimer</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></article><Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="border-white/10 bg-[#17171d] text-zinc-100"><DialogHeader><DialogTitle>Renommer le projet</DialogTitle><DialogDescription className="text-zinc-500">Choisissez un nom facile à retrouver dans Lakay.</DialogDescription></DialogHeader><Input value={name} onChange={event => setName(event.target.value)} className="border-white/10 bg-black/20 text-zinc-100" autoFocus /><DialogFooter><Button variant="ghost" onClick={() => setEditOpen(false)} className="text-zinc-400 hover:text-white">Annuler</Button><Button disabled={updateProject.isPending || name.trim().length < 2} onClick={() => updateProject.mutate({ projectId: project.id, name: name.trim() })} className="rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300">Enregistrer</Button></DialogFooter></DialogContent></Dialog><AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent className="border-white/10 bg-[#17171d] text-zinc-100"><AlertDialogHeader><AlertDialogTitle>Supprimer « {project.name} » ?</AlertDialogTitle><AlertDialogDescription className="text-zinc-500">Cette action retire le brief et toutes les conversations sauvegardées. Elle ne peut pas être annulée.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white">Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteProject.mutate({ projectId: project.id })} className="bg-red-500 text-white hover:bg-red-400">Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
