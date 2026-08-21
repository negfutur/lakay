import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowRight, FolderPlus, MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function Dashboard() {
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const [, navigate] = useLocation();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-4 sm:py-6">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-violet-300">Your workspace</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-white sm:text-4xl">Projects with direction.</h1><p className="mt-2 text-sm text-zinc-500">Shape ideas into deliberate product decisions.</p></div><Button onClick={() => navigate("/projects/new")} className="h-10 rounded-xl bg-violet-400 px-4 font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5 hover:bg-violet-300 active:scale-[0.97]"><FolderPlus className="mr-2 size-4" />New project</Button></section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"><Stat label="All projects" value={projects?.length ?? "—"} detail="Ideas in your workspace" /><Stat label="Ready to refine" value={projects?.filter(item => item.status === "ready").length ?? "—"} detail="Plans ready for next steps" /><Stat label="Latest activity" value={projects?.[0] ? formatDate(projects[0].updatedAt) : "—"} detail="Most recently updated" /></section>

        <section><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-zinc-200">Your projects</h2><span className="text-xs text-zinc-600">{projects?.length ?? 0} total</span></div>{isLoading ? <ProjectSkeleton /> : projects && projects.length > 0 ? <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">{projects.map(project => <ProjectRow key={project.id} project={project} />)}</div> : <EmptyProjects onCreate={() => navigate("/projects/new")} />}</section>
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <Card className="last:col-span-2 border-white/[0.08] bg-white/[0.025] shadow-none sm:last:col-span-1"><CardContent className="p-4 sm:p-5"><p className="text-[11px] text-zinc-500 sm:text-xs">{label}</p><p className="mt-2 text-xl font-semibold tracking-[-0.05em] text-white sm:mt-3 sm:text-2xl">{value}</p><p className="mt-1.5 text-[10px] text-zinc-600 sm:mt-2 sm:text-[11px]">{detail}</p></CardContent></Card>;
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

  return <><article className="group flex flex-col gap-4 border-b border-white/[0.07] p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-400" /><span className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">{project.status}</span></div><h3 className="mt-2 truncate text-[15px] font-semibold tracking-[-0.02em] text-white">{project.name}</h3><p className="mt-1 line-clamp-1 max-w-2xl text-sm text-zinc-500">{project.description}</p></div><div className="flex shrink-0 items-center gap-3"><div className="hidden text-right sm:block"><p className="text-xs text-zinc-400">{formatDate(project.createdAt)}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">Created</p></div><Link href={`/projects/${project.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-violet-300/30 hover:bg-violet-400/10 hover:text-violet-100">Open <ArrowRight className="size-3.5" /></Link><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-9 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-200" aria-label={`Actions for ${project.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40 border-white/10 bg-[#1a1a20] text-zinc-300"><DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)} className="cursor-pointer focus:bg-white/5">Open project</DropdownMenuItem><DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer focus:bg-white/5"><Pencil className="mr-2 size-3.5" />Rename</DropdownMenuItem><DropdownMenuSeparator className="bg-white/10" /><DropdownMenuItem onClick={() => setDeleteOpen(true)} className="cursor-pointer text-red-300 focus:bg-red-400/10 focus:text-red-200"><Trash2 className="mr-2 size-3.5" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></article><Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="border-white/10 bg-[#17171d] text-zinc-100"><DialogHeader><DialogTitle>Rename project</DialogTitle><DialogDescription className="text-zinc-500">Give this Lakay project a name that makes it easy to find.</DialogDescription></DialogHeader><Input value={name} onChange={event => setName(event.target.value)} className="border-white/10 bg-black/20 text-zinc-100" autoFocus /><DialogFooter><Button variant="ghost" onClick={() => setEditOpen(false)} className="text-zinc-400 hover:text-white">Cancel</Button><Button disabled={updateProject.isPending || name.trim().length < 2} onClick={() => updateProject.mutate({ projectId: project.id, name: name.trim() })} className="rounded-xl bg-violet-400 text-zinc-950 hover:bg-violet-300">Save name</Button></DialogFooter></DialogContent></Dialog><AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent className="border-white/10 bg-[#17171d] text-zinc-100"><AlertDialogHeader><AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle><AlertDialogDescription className="text-zinc-500">This removes the project brief and all saved conversation messages. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteProject.mutate({ projectId: project.id })} className="bg-red-500 text-white hover:bg-red-400">Delete project</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
