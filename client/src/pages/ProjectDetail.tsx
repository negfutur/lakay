import DashboardLayout from "@/components/DashboardLayout";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { ProjectPlan } from "@shared/project";
import { ArrowLeft, Box, CheckCircle2, Layers3, Loader2, MessageSquareText, Pencil, Trash2, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:projectId");
  const projectId = params?.projectId ?? "";
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: project, isLoading, error } = trpc.projects.get.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatRequestId, setChatRequestId] = useState(() => crypto.randomUUID());
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!project || isStreaming) return;
    setMessages(project.messages.map(message => ({ role: message.role, content: message.content })));
    setName(project.name);
    setDescription(project.description);
  }, [project, isStreaming]);

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: async () => {
      await utils.projects.get.invalidate({ projectId });
      await utils.projects.list.invalidate();
      setEditOpen(false);
      toast.success("Project details saved.");
    },
    onError: issue => toast.error(issue.message),
  });
  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: async () => { await utils.projects.list.invalidate(); navigate("/dashboard"); toast.success("Project deleted."); },
    onError: issue => toast.error(issue.message),
  });

  const streamReply = async (content: string) => {
    if (!projectId || isStreaming) return;
    const userMessage: Message = { role: "user", content };
    setMessages(current => [...current, userMessage]);
    setIsStreaming(true);
    try {
      const token = sessionStorage.getItem("manus-cookie");
      const response = await fetch(`/api/projects/${projectId}/chat/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content, requestId: chatRequestId }),
      });
      if (!response.ok || !response.body) throw new Error("Lakay could not start the response.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantStarted = false;
      const processEvent = (block: string) => {
        const event = block.split("\n").find(line => line.startsWith("event:"))?.slice(6).trim();
        const raw = block.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
        if (!raw) return;
        const data = JSON.parse(raw) as { content?: string; message?: string };
        if (event === "delta" && data.content) {
          setMessages(current => {
            if (!assistantStarted) { assistantStarted = true; return [...current, { role: "assistant", content: data.content ?? "" }]; }
            const latest = current[current.length - 1];
            return latest?.role === "assistant" ? [...current.slice(0, -1), { ...latest, content: latest.content + data.content }] : current;
          });
        }
        if (event === "error") toast.error(data.message || "Lakay could not complete that response.");
        if (event === "complete") setChatRequestId(crypto.randomUUID());
      };
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) { processEvent(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); boundary = buffer.indexOf("\n\n"); }
      }
      await utils.projects.get.invalidate({ projectId });
    } catch (issue) {
      setMessages(current => current.filter((message, index) => !(index === current.length - 1 && message.role === "user" && message.content === content)));
      toast.error(issue instanceof Error ? issue.message : "Lakay could not complete that response.");
    } finally { setIsStreaming(false); }
  };

  if (isLoading) return <DashboardLayout><div className="grid min-h-[50vh] place-items-center"><Loader2 className="size-5 animate-spin text-violet-300" /></div></DashboardLayout>;
  if (error || !project) return <DashboardLayout><div className="mx-auto max-w-md py-28 text-center"><h1 className="text-xl font-semibold text-white">This project isn’t available.</h1><p className="mt-2 text-sm text-zinc-500">It may have been deleted or you may not have access to it.</p><Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-xl">Return to dashboard</Button></div></DashboardLayout>;

  const plan = project.generatedPlan as ProjectPlan | null;
  return <DashboardLayout><div className="mx-auto max-w-7xl px-1 py-3 sm:px-4 sm:py-7"><div className="mb-7 flex flex-col gap-5 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between"><div><button onClick={() => navigate("/dashboard")} className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-200"><ArrowLeft className="size-3.5" />All projects</button><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-[-0.055em] text-white">{project.name}</h1><Badge className="border-0 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/10">Ready</Badge></div><p className="mt-2 max-w-2xl text-sm text-zinc-500">Updated {formatDate(project.updatedAt)} · {project.messages.length} messages in this workspace</p></div><div className="flex items-center gap-2"><Button variant="outline" onClick={() => setEditOpen(true)} className="rounded-xl border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"><Pencil className="mr-2 size-3.5" />Edit brief</Button><Button variant="ghost" onClick={() => { if (window.confirm("Delete this project and its conversation? This cannot be undone.")) deleteProject.mutate({ projectId }); }} disabled={deleteProject.isPending} className="rounded-xl text-zinc-500 hover:bg-red-400/10 hover:text-red-300"><Trash2 className="size-4" /></Button></div></div><div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]"><div className="space-y-5"><section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.025]"><div className="border-b border-white/[0.07] px-5 py-4"><div className="flex items-center gap-2"><MessageSquareText className="size-4 text-violet-300" /><h2 className="text-sm font-semibold text-white">Refine with Lakay</h2></div><p className="mt-1 text-xs text-zinc-500">Ask about priorities, edge cases, user flows, or implementation choices.</p></div><AIChatBox messages={messages} onSendMessage={streamReply} isLoading={isStreaming} showLoadingIndicator={!messages.some(message => message.role === "assistant" && message.content.length > 0) && isStreaming} height="min(640px, calc(100vh - 230px))" placeholder="Ask Lakay to sharpen the plan…" emptyStateMessage="Your project is ready for its first refinement." suggestedPrompts={["What should the first release include?", "What are the biggest product risks?", "Sketch the ideal onboarding flow."]} className="rounded-none border-0 bg-transparent shadow-none" /></section></div><div className="space-y-5"><section className="rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.055] to-white/[0.018] p-5"><div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-violet-300" /><h2 className="text-sm font-semibold text-white">Product brief</h2></div><p className="mt-4 text-[15px] font-medium leading-6 text-zinc-200">{plan?.tagline || "A focused product concept, ready to refine."}</p><p className="mt-3 text-sm leading-6 text-zinc-500">{plan?.summary || project.description}</p><div className="mt-6 border-t border-white/[0.07] pt-5"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-600">Core goals</p><ul className="mt-3 space-y-2">{(plan?.goals || []).map(goal => <li key={goal} className="flex gap-2 text-sm leading-5 text-zinc-400"><span className="mt-2 size-1 shrink-0 rounded-full bg-violet-300" />{goal}</li>)}</ul></div></section><section className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5"><div className="flex items-center gap-2"><Wrench className="size-4 text-violet-300" /><h2 className="text-sm font-semibold text-white">Suggested stack</h2></div><div className="mt-5 space-y-4">{(plan?.techStack || []).map(tool => <div key={`${tool.category}-${tool.name}`}><div className="flex items-baseline justify-between gap-3"><p className="text-sm font-medium text-zinc-200">{tool.name}</p><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600">{tool.category}</span></div><p className="mt-1 text-xs leading-5 text-zinc-500">{tool.reason}</p></div>)}</div></section><section className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5"><div className="flex items-center gap-2"><Layers3 className="size-4 text-violet-300" /><h2 className="text-sm font-semibold text-white">Component map</h2></div><div className="mt-5 grid gap-2">{(plan?.components || []).map(component => <div key={component.name} className="rounded-xl border border-white/[0.07] bg-black/10 px-3.5 py-3"><p className="text-sm font-medium text-zinc-200">{component.name}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{component.purpose}</p></div>)}</div></section><section className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5"><div className="flex items-center gap-2"><Box className="size-4 text-violet-300" /><h2 className="text-sm font-semibold text-white">First milestones</h2></div><ol className="mt-4 space-y-3">{(plan?.milestones || []).map((milestone, index) => <li key={milestone} className="flex gap-3 text-sm leading-5 text-zinc-400"><span className="grid size-5 shrink-0 place-items-center rounded-full border border-violet-300/20 font-mono text-[10px] text-violet-200">{index + 1}</span>{milestone}</li>)}</ol></section></div></div></div><Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="border-white/10 bg-[#17171d] text-zinc-100"><DialogHeader><DialogTitle>Edit project brief</DialogTitle><DialogDescription className="text-zinc-500">Keep the project’s starting context current.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><Input value={name} onChange={event => setName(event.target.value)} className="border-white/10 bg-black/20 text-zinc-100" placeholder="Project name" /><Textarea value={description} onChange={event => setDescription(event.target.value)} className="min-h-32 border-white/10 bg-black/20 text-zinc-100" placeholder="Project description" /></div><DialogFooter><Button variant="ghost" onClick={() => setEditOpen(false)} className="text-zinc-400 hover:text-white">Cancel</Button><Button disabled={updateProject.isPending || name.trim().length < 2 || description.trim().length < 12} onClick={() => updateProject.mutate({ projectId, name, description })} className="rounded-xl bg-violet-400 text-zinc-950 hover:bg-violet-300">{updateProject.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Save changes</Button></DialogFooter></DialogContent></Dialog></DashboardLayout>;
}
