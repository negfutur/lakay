import { AIChatBox, type Message } from "@/components/AIChatBox";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { makePreviewDocument } from "@/lib/staticPreview";
import { parseWorkspacePreferences, postBuildDestination, WORKSPACE_PREFERENCES_KEY } from "@/lib/workspacePreferences";
import type { BuilderFile } from "@shared/builder";
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, ChevronRight, Code2, Download, Eye, FileCode2, FileText, Fullscreen, Github, History, Laptop, Loader2, Monitor, MoreHorizontal, Play, RefreshCw, RotateCcw, Save, ShieldCheck, Smartphone, TerminalSquare, WandSparkles, XCircle } from "lucide-react";
import JSZip from "jszip";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type WorkspaceTab = "files" | "code" | "preview" | "runner" | "logs" | "changes";
type BuildLog = { id: string; tone: "info" | "success" | "warning" | "error"; text: string; createdAt: number };
type RunnerProfile = { mode: "static" | "full_stack_runner"; status: "static_preview_ready" | "runner_required" | "runner_connected" | "build_queued" | "build_failed"; diagnostics: string[] | null; events?: Array<{ state: string; message: string; occurredAt: string }> | null; manifest?: { scaffold?: { files?: Array<{ path: string }> } } | null } | null | undefined;
type RunnerJob = { id: string; state: string; expiresAt: Date | string; createdAt: Date | string };
type RunnerJobLog = { id: string; jobId: string; level: "info" | "warning" | "error" | "success"; message: string; createdAt: Date | string };
const WORKSPACE_TABS: WorkspaceTab[] = ["files", "code", "preview", "runner", "logs", "changes"];

function initialWorkspaceTab(): WorkspaceTab {
  const requested = new URLSearchParams(window.location.search).get("tab") as WorkspaceTab | null;
  return requested && WORKSPACE_TABS.includes(requested) ? requested : "preview";
}

function fileGlyph(path: string) {
  if (path.endsWith(".html")) return "<>";
  if (path.endsWith(".css")) return "#";
  return "JS";
}

function tabIcon(tab: WorkspaceTab) {
  const className = "size-3.5";
  if (tab === "files") return <FileText className={className} />;
  if (tab === "code") return <Code2 className={className} />;
  if (tab === "preview") return <Eye className={className} />;
  if (tab === "runner") return <ShieldCheck className={className} />;
  if (tab === "logs") return <TerminalSquare className={className} />;
  return <History className={className} />;
}

function RunnerWorkspace({ profile, jobs, logs, busy, onPrepare, onQueue }: { profile: RunnerProfile; jobs: RunnerJob[]; logs: RunnerJobLog[]; busy: boolean; onPrepare: () => void; onQueue: () => void }) {
  const prepared = profile?.status === "runner_required" || profile?.status === "runner_connected";
  const diagnostics = profile?.diagnostics || ["Static front-end preview is ready in Lakay’s browser sandbox.", "Prepare the full-stack contract before connecting an isolated runner."];
  const stateLabel = profile?.status ? profile.status.replace(/_/g, " ") : "static preview ready";
  const events = profile?.events || [];
  const latestJob = jobs[0];
  return <div className="mx-auto max-w-4xl p-5 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-300">Execution environment</p><div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Full-stack runner</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Lakay’s static preview remains live here. Backend, API, database, install, build, and server execution require a short-lived isolated runner outside the main application process.</p></div><Badge className={`border-0 ${prepared ? "bg-amber-400/10 text-amber-200" : "bg-violet-400/10 text-violet-200"}`}>{prepared ? "Runner required" : "Static preview ready"}</Badge></div><div className="mt-5 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-zinc-400"><span className={`size-2 rounded-full ${prepared ? "bg-amber-300" : "bg-emerald-400"}`} />Runner state: <span className="font-medium capitalize text-zinc-200">{stateLabel}</span><span className="ml-auto text-[10px] text-zinc-600">No untrusted code is running here</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><RunnerCapability label="Browser preview" detail="Available now" tone="ready" /><RunnerCapability label="Backend & API" detail="Isolated runner required" tone="pending" /><RunnerCapability label="Database migration" detail="Namespaced runner only" tone="pending" /></div><div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-zinc-200">Safe runner contract</p><p className="mt-1 text-xs leading-5 text-zinc-500">The contract uses scoped secrets, deny-by-default networking, ephemeral jobs, sanitized diagnostics, and project-owner authorization.</p></div><div className="flex gap-2"><Button disabled={busy || prepared} onClick={onPrepare} className="h-9 rounded-lg bg-violet-400 px-3 text-xs font-semibold text-zinc-950 hover:bg-violet-300 disabled:opacity-60"><ShieldCheck className="mr-1.5 size-3.5" />{prepared ? "Contract prepared" : "Prepare contract"}</Button>{prepared && <Button disabled={busy || latestJob?.state === "queued"} onClick={onQueue} variant="outline" className="h-9 rounded-lg border-white/[0.1] bg-transparent px-3 text-xs text-zinc-200 hover:bg-white/[0.05]"><Play className="mr-1.5 size-3.5" />Queue job</Button>}</div></div></div>{prepared && <div className="mt-4 rounded-xl border border-violet-300/15 bg-violet-400/[0.05] p-4"><p className="text-sm font-medium text-violet-100">Runner-ready scaffold</p><p className="mt-1 text-xs text-zinc-500">{profile?.manifest?.scaffold?.files?.length || 0} unexecuted project files are prepared for the isolated runner. They are not exposed to Lakay platform secrets.</p><div className="mt-3 flex flex-wrap gap-2">{profile?.manifest?.scaffold?.files?.slice(0, 6).map(file => <span key={file.path} className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] text-zinc-400">{file.path}</span>)}</div></div>}{latestJob && <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-amber-100">Runner job: {latestJob.state.replace(/_/g, " ")}</p><p className="mt-1 text-xs text-zinc-500">Scoped handoff expires {new Date(latestJob.expiresAt).toLocaleString()}. It cannot run until an isolated runner claims it.</p></div><Badge className="border-0 bg-amber-300/10 text-amber-200">Queued safely</Badge></div></div>}<div className="mt-4 space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Runner activity</p>{events.length ? events.map(event => <div key={`${event.occurredAt}-${event.message}`} className="flex items-start gap-3 rounded-lg border border-violet-300/15 bg-violet-400/[0.05] p-3 text-xs leading-5 text-zinc-300"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-violet-300" /><div className="flex-1"><p>{event.message}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-600">{event.state.replace(/_/g, " ")} · {new Date(event.occurredAt).toLocaleString()}</p></div></div>) : <div className="rounded-lg border border-dashed border-white/[0.1] p-3 text-xs text-zinc-600">No runner events yet.</div>}<p className="pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Sanitized runner logs</p>{logs.length ? logs.slice(0, 6).map(log => <div key={log.id} className="flex gap-3 rounded-lg border border-white/[0.07] bg-black/20 p-3 text-xs text-zinc-400"><TerminalSquare className="mt-0.5 size-3.5 shrink-0 text-violet-300" /><div className="flex-1"><p>{log.message}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-600">{log.level} · {new Date(log.createdAt).toLocaleString()}</p></div></div>) : <div className="rounded-lg border border-dashed border-white/[0.1] p-3 text-xs text-zinc-600">No runner logs yet.</div>}<p className="pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Runner diagnostics</p>{diagnostics.map(diagnostic => <div key={diagnostic} className="flex gap-3 rounded-lg border border-white/[0.07] bg-black/20 p-3 text-xs leading-5 text-zinc-400"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" />{diagnostic}</div>)}</div></div>;
}

function RunnerCapability({ label, detail, tone }: { label: string; detail: string; tone: "ready" | "pending" }) {
  return <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><span className={`inline-flex size-2 rounded-full ${tone === "ready" ? "bg-emerald-400" : "bg-amber-300"}`} /><p className="mt-3 text-sm font-medium text-zinc-200">{label}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p></div>;
}

function FileDiffPreview({ previous, current }: { previous: BuilderFile[]; current: BuilderFile[] }) {
  const previousByPath = new Map(previous.map(file => [file.path, file]));
  const currentByPath = new Map(current.map(file => [file.path, file]));
  const paths = Array.from(new Set([...Array.from(previousByPath.keys()), ...Array.from(currentByPath.keys())])).filter(path => previousByPath.get(path)?.content !== currentByPath.get(path)?.content);
  if (!paths.length) return <p className="mt-3 text-[11px] text-zinc-600">This version matches the current generated files.</p>;
  return <div className="mt-3 space-y-2">{paths.slice(0, 4).map(path => {
    const before = previousByPath.get(path)?.content || "";
    const after = currentByPath.get(path)?.content || "";
    return <div key={path} className="overflow-hidden rounded-lg border border-white/[0.07] bg-black/20"><div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2"><span className="font-mono text-[10px] text-violet-200">{path}</span><span className="text-[10px] text-zinc-600">{before ? after ? "modified" : "removed" : "added"}</span></div><div className="grid grid-cols-1 divide-y divide-white/[0.06] text-[10px] leading-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0"><pre className="max-h-28 overflow-auto whitespace-pre-wrap p-2.5 text-rose-200/75">{before ? `− ${before.split("\n").slice(0, 5).join("\n− ")}` : "− no prior file"}</pre><pre className="max-h-28 overflow-auto whitespace-pre-wrap p-2.5 text-emerald-200/75">{after ? `+ ${after.split("\n").slice(0, 5).join("\n+ ")}` : "+ file removed"}</pre></div></div>;
  })}</div>;
}

function PreviewQuickActions({ onRefresh, onOpen, onFullscreen, isFullscreen }: { onRefresh: () => void; onOpen: () => void; onFullscreen: () => void; isFullscreen: boolean }) {
  return <div className="flex items-center justify-end gap-1 border-b border-white/[0.07] bg-black/10 px-3 py-1.5"><Button variant="ghost" size="sm" onClick={onRefresh} className="h-7 gap-1.5 px-2 text-[11px] text-zinc-400 hover:bg-white/[0.06] hover:text-white"><RefreshCw className="size-3" />Actualiser</Button><Button variant="ghost" size="sm" onClick={onOpen} className="h-7 gap-1.5 px-2 text-[11px] text-zinc-400 hover:bg-white/[0.06] hover:text-white"><Play className="size-3" />Ouvrir</Button><Button variant="ghost" size="sm" onClick={onFullscreen} className="h-7 gap-1.5 px-2 text-[11px] text-zinc-400 hover:bg-white/[0.06] hover:text-white"><Fullscreen className="size-3" />{isFullscreen ? "Réduire" : "Plein écran"}</Button></div>;
}

export default function AppBuilder() {
  const [, buildParams] = useRoute("/projects/:projectId/build");
  const [, projectParams] = useRoute("/projects/:projectId");
  const projectId = buildParams?.projectId ?? projectParams?.projectId ?? "";
  const [, navigate] = useLocation();
  const [createdHandoff, setCreatedHandoff] = useState(() => new URLSearchParams(window.location.search).get("handoff") === "created");
  const utils = trpc.useUtils();
  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const { data: builder, isLoading: builderLoading } = trpc.builder.get.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>(initialWorkspaceTab);
  const [selectedPath, setSelectedPath] = useState("index.html");
  const [editorContent, setEditorContent] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [runtimeIssues, setRuntimeIssues] = useState<string[]>([]);
  const [providerQuotaError, setProviderQuotaError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [isPreviewTransitioning, setIsPreviewTransitioning] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [lastTelemetryAt, setLastTelemetryAt] = useState<number | null>(null);
  const [mobilePane, setMobilePane] = useState<"chat" | "preview">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const previewShellRef = useRef<HTMLDivElement>(null);

  const selectedFile = builder?.files.find(file => file.path === selectedPath);
  const previewDocument = useMemo(() => makePreviewDocument(builder?.files || []), [builder?.files]);
  const hasBuild = Boolean(builder?.files.length);
  const runnerProfile = builder?.execution as RunnerProfile;
  const runnerJobs = (builder?.runnerJobs || []) as RunnerJob[];
  const runnerLogs = (builder?.runnerLogs || []) as RunnerJobLog[];
  const telemetryLive = runnerJobs.some(job => ["queued", "runner_assigned", "installing", "building", "testing"].includes(job.state));
  const preflightIssues = hasBuild ? builder?.validation.issues || [] : [];
  const issues = [...preflightIssues, ...runtimeIssues.filter(issue => !preflightIssues.includes(issue))];
  const isGenerating = pendingPrompt !== null;
  const previewBusy = isGenerating || isPreviewTransitioning;
  const isSaving = false;

  const shouldOpenPreviewAfterBuild = () => {
    return postBuildDestination(parseWorkspacePreferences(localStorage.getItem(WORKSPACE_PREFERENCES_KEY))) === "preview";
  };

  const appendLog = (tone: BuildLog["tone"], text: string) => setBuildLogs(current => [{ id: crypto.randomUUID(), tone, text, createdAt: Date.now() }, ...current].slice(0, 30));
  const refreshBuilder = async (message = "Preview refreshed from the latest generated files.") => {
    await utils.builder.get.invalidate({ projectId });
    await utils.projects.get.invalidate({ projectId });
    setRuntimeIssues([]);
    setPreviewKey(current => current + 1);
    appendLog("info", message);
  };

  useEffect(() => {
    if (!project || chatMessages.length) return;
    const existing = project.messages.map(message => ({ role: message.role, content: message.content })) as Message[];
    const originalIdea = project.description.replace(/^Application (web|mobile)\s*:\s*/i, "");
    setChatMessages(existing.length ? existing : [{ role: "assistant", content: `Votre projet **${project.name}** est prêt. J’ai compris votre idée : _${originalIdea}_. Envoyez votre première consigne et je construirai une version que vous pourrez prévisualiser ici.` }]);
    if (createdHandoff) {
      setMobilePane("chat");
      setCreatedHandoff(false);
      const params = new URLSearchParams(window.location.search);
      params.delete("handoff");
      window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}${window.location.hash}`);
    }
  }, [project, chatMessages.length, createdHandoff]);

  useEffect(() => {
    if (selectedFile) setEditorContent(selectedFile.content);
    if (!selectedFile && builder?.files[0]) setSelectedPath(builder.files[0].path);
  }, [selectedFile?.content, selectedFile?.path, builder?.files]);

  useEffect(() => {
    if (!telemetryLive) return;
    setLastTelemetryAt(Date.now());
    const timer = window.setInterval(() => {
      void utils.builder.get.invalidate({ projectId });
      setLastTelemetryAt(Date.now());
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [projectId, telemetryLive, utils.builder.get]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== previewFrameRef.current?.contentWindow) return;
      const data = event.data as { source?: string; type?: string; message?: string; line?: number } | null;
      if (data?.source !== "lakay-preview" || data.type !== "runtime-error" || !data.message) return;
      const issue = data.line ? `${data.message} (line ${data.line})` : data.message;
      setRuntimeIssues(current => current.includes(issue) ? current : [...current, issue].slice(-8));
      appendLog("error", `Runtime preview issue: ${issue}`);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const generate = trpc.builder.generate.useMutation({
    onSuccess: async () => {
      const prompt = pendingPrompt;
      setPendingPrompt(null);
      setWorkspaceTab(shouldOpenPreviewAfterBuild() ? "preview" : "files");
      setMobilePane("preview");
      setIsPreviewTransitioning(true);
      try {
        await refreshBuilder("Build completed. Live preview updated from generated project files.");
        setProviderQuotaError(null);
        setChatMessages(current => [...current, { role: "assistant", content: prompt ? `La mise à jour est prête pour : **${prompt}**. L’aperçu en direct contient maintenant les nouveaux fichiers.` : "L’application et son aperçu ont été actualisés." }]);
        setRequestId(crypto.randomUUID());
        toast.success("Build complete — preview updated.");
      } finally {
        setIsPreviewTransitioning(false);
      }
    },
    onError: error => {
      appendLog("error", `Build failed: ${error.message}`);
      if (/external built-in llm account|usage exhausted/i.test(error.message)) setProviderQuotaError(error.message);
      setChatMessages(current => [...current, { role: "assistant", content: "La génération n’a pas abouti, mais votre aperçu actuel est conservé. Réessayez avec une consigne plus précise ou modifiez votre dernière demande." }]);
      setPendingPrompt(null);
      toast.error(error.message || "Lakay could not generate this build.");
    },
  });
  const mockGenerate = trpc.builder.generateMock.useMutation({
    onSuccess: async () => {
      const prompt = pendingPrompt;
      setPendingPrompt(null);
      setWorkspaceTab(shouldOpenPreviewAfterBuild() ? "preview" : "files");
      setMobilePane("preview");
      setIsPreviewTransitioning(true);
      try {
        await refreshBuilder("Test-mode build completed. Live preview reloaded from generated fixture files.");
        setProviderQuotaError(null);
        setChatMessages(current => [...current, { role: "assistant", content: `Le test de génération est prêt${prompt ? ` pour : **${prompt}**` : ""}. Les fichiers de démonstration sont enregistrés et l’aperçu est actualisé.` }]);
        toast.success("Test-mode build complete — preview updated.");
      } finally {
        setIsPreviewTransitioning(false);
      }
    },
    onError: error => { appendLog("error", `Test-mode build failed: ${error.message}`); setPendingPrompt(null); toast.error(error.message || "Lakay could not create the test build."); },
  });
  const prepareFullStack = trpc.builder.prepareFullStack.useMutation({
    onSuccess: async () => { await refreshBuilder("Prepared full-stack runner contract and refreshed execution diagnostics."); appendLog("info", "Full-stack contract prepared. An isolated runner must be connected before code execution."); toast.success("Full-stack runner contract prepared."); },
    onError: error => { appendLog("error", `Runner preparation failed: ${error.message}`); toast.error(error.message || "Lakay could not prepare the runner contract."); },
  });
  const queueRunner = trpc.builder.queueRunnerJob.useMutation({
    onSuccess: async () => { await refreshBuilder("Queued a scoped runner job and refreshed sanitized runner diagnostics."); appendLog("info", "Runner job queued. Waiting for a separate isolated runner to claim the handoff."); toast.success("Runner job queued safely."); },
    onError: error => { appendLog("error", `Runner queue failed: ${error.message}`); toast.error(error.message || "Lakay could not queue the runner job."); },
  });
  const saveFile = trpc.builder.updateFile.useMutation({
    onSuccess: async () => { await refreshBuilder("Saved file and reloaded the live preview."); appendLog("success", `Saved ${selectedPath} as a restorable project version.`); toast.success("File saved — preview updated."); },
    onError: error => { appendLog("error", `Save failed: ${error.message}`); toast.error(error.message); },
  });
  const restore = trpc.builder.restoreVersion.useMutation({
    onSuccess: async () => { await refreshBuilder("Restored version and reloaded the live preview."); appendLog("success", "Restored a previous generated build version."); toast.success("Version restored — preview updated."); },
    onError: error => toast.error(error.message),
  });
  const autoFix = trpc.builder.autoFix.useMutation({
    onSuccess: async () => { await refreshBuilder("Auto-fix completed and preview reloaded."); setProviderQuotaError(null); appendLog("success", "Applied a supported static preview repair."); toast.success("Preview repair applied."); },
    onError: error => { appendLog("error", `Auto-fix failed: ${error.message}`); if (/external built-in llm account|usage exhausted/i.test(error.message)) setProviderQuotaError(error.message); toast.error(error.message || "Lakay could not repair this preview."); },
  });

  const busy = previewBusy || mockGenerate.isPending || prepareFullStack.isPending || queueRunner.isPending || saveFile.isPending || restore.isPending || autoFix.isPending;
  const buildFromPrompt = (prompt: string) => {
    if (!prompt.trim() || busy) return;
    setChatMessages(current => [...current, { role: "user", content: prompt }]);
    setPendingPrompt(prompt);
    appendLog("info", `Lakay is generating files for: ${prompt}`);
    setWorkspaceTab("preview");
    setMobilePane("chat");
    generate.mutate({ projectId, instruction: prompt, requestId });
  };
  const buildMock = (prompt?: string) => {
    if (busy) return;
    const instruction = prompt?.trim() || `Create a polished landing page for ${project?.name ?? "this project"}`;
    setChatMessages(current => [...current, { role: "user", content: `[Test mode] ${instruction}` }]);
    setPendingPrompt(instruction);
    appendLog("warning", `Test mode is creating local fixture files for: ${instruction}`);
    setWorkspaceTab("preview");
    mockGenerate.mutate({ projectId, instruction });
  };
  const saveCurrentFile = () => {
    if (!selectedFile || editorContent === selectedFile.content) return;
    saveFile.mutate({ projectId, path: selectedPath, content: editorContent });
  };
  const openPreview = () => {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return toast.error("Allow pop-ups to open the isolated preview.");
    popup.document.write("<!doctype html><title>Lakay isolated preview</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#111}</style><iframe sandbox='allow-scripts' title='Lakay isolated application preview'></iframe>");
    const frame = popup.document.querySelector("iframe");
    if (frame) frame.srcdoc = previewDocument;
    popup.document.close();
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await previewShellRef.current?.requestFullscreen();
    } catch {
      toast.error("Fullscreen preview is not available in this browser.");
    }
  };
  const exportProject = async () => {
    if (!builder?.files.length) return toast.error("Create project files before exporting.");
    setExporting(true);
    try {
      const archive = new JSZip();
      builder.files.forEach(file => archive.file(file.path, file.content));
      archive.file("README.md", `# ${project?.name ?? "Lakay project"}\n\nGenerated with Lakay AI.\n`);
      const blob = await archive.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      const filename = (project?.name ?? "lakay-project").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "lakay-project";
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.zip`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
      toast.success("Project ZIP download started.");
    } catch {
      toast.error("Lakay could not export this project.");
    } finally {
      setExporting(false);
    }
  };

  if (projectLoading || builderLoading) return <DashboardLayout><div className="grid min-h-[70vh] place-items-center"><Loader2 className="size-5 animate-spin text-violet-300" /></div></DashboardLayout>;
  if (!project) return <DashboardLayout><div className="mx-auto max-w-md py-28 text-center"><h1 className="text-xl font-semibold text-white">This project is not available.</h1><Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-xl">Return to projects</Button></div></DashboardLayout>;

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: "files", label: "Files" }, { id: "code", label: "Code" }, { id: "preview", label: "Preview" }, { id: "runner", label: telemetryLive ? "Runner live" : "Runner" }, { id: "logs", label: "Logs" }, { id: "changes", label: "Changes" },
  ];

  return <DashboardLayout><div className="lakay-density-aware min-h-screen bg-[#0a0a0f] text-zinc-100">
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-2 border-b border-white/[0.07] bg-[#0d0d13]/95 px-2 backdrop-blur-xl sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5"><button onClick={() => navigate(`/projects/${projectId}/brief`)} className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-white" aria-label="Retour au projet"><ArrowLeft className="size-4" /></button><p className="max-w-16 truncate text-xs font-semibold text-zinc-100 sm:max-w-xs sm:text-sm">{project.name}</p></div>
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center rounded-full bg-white/[0.055] p-0.5"><button onClick={() => { setMobilePane("preview"); setWorkspaceTab("preview"); }} className={`h-7 rounded-full px-2.5 text-[11px] font-medium transition-colors ${mobilePane === "preview" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Aperçu</button><button onClick={() => setMobilePane("chat")} className={`h-7 rounded-full px-2.5 text-[11px] font-medium transition-colors ${mobilePane === "chat" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Chat</button></div>
      <div className="flex shrink-0 items-center gap-1"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-zinc-400 hover:bg-white/[0.06] hover:text-white"><Download className="size-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Exporter</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52 border-white/[0.1] bg-zinc-950 text-zinc-100"><DropdownMenuLabel>Exporter le projet</DropdownMenuLabel><DropdownMenuSeparator className="bg-white/[0.08]" /><DropdownMenuItem disabled={exporting || !hasBuild} onClick={exportProject}><Download className="mr-2 size-3.5" />{exporting ? "Préparation…" : "Télécharger le .zip"}</DropdownMenuItem><DropdownMenuItem disabled><Github className="mr-2 size-3.5" />GitHub <span className="ml-auto text-[10px] text-zinc-500">À connecter</span></DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button size="sm" disabled={busy} onClick={() => buildFromPrompt(hasBuild ? "Améliore l’application actuelle avec la prochaine fonctionnalité utile." : "Crée une première version soignée de cette application.")} className="h-8 rounded-lg bg-violet-400 px-2 text-zinc-950 hover:bg-violet-300 sm:px-3"><WandSparkles className="size-3.5 sm:mr-1.5" /><span className="hidden sm:inline">{busy ? "Création" : "Créer"}</span></Button></div>
    </header>
    <div className="grid h-[calc(100svh-6rem)] min-h-0 grid-cols-1 xl:h-[calc(100svh-3rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className={`${mobilePane === "chat" ? "flex" : "hidden"} h-full min-h-0 flex-col bg-[#0c0c12]/70 xl:order-2 xl:flex xl:border-l xl:border-white/[0.06]`}>
        <div className="flex h-10 items-center gap-2 px-4"><div className="grid size-6 place-items-center rounded-md bg-violet-400/12"><Bot className="size-3.5 text-violet-200" /></div><p className="text-xs font-medium text-zinc-300">Lakay AI</p>{isGenerating && <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-violet-200"><span className="size-1.5 animate-pulse rounded-full bg-violet-300" />Création en cours</span>}</div>
        <AIChatBox messages={chatMessages} onSendMessage={buildFromPrompt} isLoading={isGenerating} showLoadingIndicator placeholder={hasBuild ? "Décrivez le changement à appliquer…" : "Décrivez l’application à créer…"} suggestedPrompts={hasBuild ? ["Modifier la couleur principale", "Ajouter une section", "Adapter pour mobile"] : ["Créer une landing page", "Créer une liste d’attente", "Créer une expérience de réservation"]} emptyStateMessage="Décrivez ce que vous voulez créer." height="auto" className="min-h-0 flex-1 !rounded-none !border-0 !shadow-none" />
      </aside>

      <main ref={previewShellRef} className={`${mobilePane === "preview" ? "block" : "hidden"} min-w-0 bg-[#101016] xl:order-1 xl:block`}>
        {workspaceTab === "preview" && <PreviewQuickActions onRefresh={() => refreshBuilder()} onOpen={openPreview} onFullscreen={() => void toggleFullscreen()} isFullscreen={isFullscreen} />}
        <div className="flex h-11 items-center gap-1 overflow-x-auto border-b border-white/[0.08] px-2 sm:h-12 sm:px-5">{tabs.map(tab => <button key={tab.id} onClick={() => setWorkspaceTab(tab.id)} aria-label={tab.label} className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 sm:px-2.5 text-xs transition-colors ${workspaceTab === tab.id ? "bg-violet-400/[0.14] text-violet-100" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"}`}>{tabIcon(tab.id)}<span className="hidden sm:inline">{tab.label}</span>{tab.id === "logs" && issues.length > 0 && <span className="ml-0.5 grid size-4 place-items-center rounded-full bg-amber-400/15 text-[9px] text-amber-200">{issues.length}</span>}</button>)}<div className="ml-auto hidden shrink-0 items-center gap-1.5 text-[10px] text-zinc-600 sm:flex"><span className={`size-1.5 rounded-full ${busy ? "animate-pulse bg-violet-300" : issues.length ? "bg-amber-300" : "bg-emerald-400"}`} />{busy ? "Building" : issues.length ? "Needs attention" : hasBuild ? "Preview live" : "Ready to build"}</div></div>

        {workspaceTab === "preview" && <div className="min-h-[calc(100svh-6rem)]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2.5 sm:px-5"><div className="flex items-center gap-2 text-xs text-zinc-400"><Eye className="size-3.5 text-violet-300" />Live application preview <span className="hidden text-zinc-600 sm:inline">· actual generated project in an isolated sandbox</span></div><div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.025] p-0.5"><button onClick={() => setDevice("desktop")} className={`grid size-7 place-items-center rounded ${device === "desktop" ? "bg-white/10 text-white" : "text-zinc-600"}`}><Monitor className="size-3.5" /></button><button onClick={() => setDevice("mobile")} className={`grid size-7 place-items-center rounded ${device === "mobile" ? "bg-white/10 text-white" : "text-zinc-600"}`}><Smartphone className="size-3.5" /></button></div></div>{providerQuotaError && <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rose-400/25 bg-rose-400/[0.08] px-3 py-3 text-xs text-rose-100 sm:px-4"><div className="flex max-w-3xl gap-2"><XCircle className="mt-0.5 size-4 shrink-0 text-rose-300" /><div><p className="font-semibold">External LLM usage is exhausted</p><p className="mt-1 leading-5 text-rose-100/75">Your existing files and live preview are preserved. Lakay credits are separate; restore usage on the project’s built-in LLM provider account, then retry this build.</p></div></div><button onClick={() => setProviderQuotaError(null)} className="text-[11px] text-rose-200/75 hover:text-rose-100">Dismiss</button></div>}{issues.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-100 sm:px-4"><div className="flex items-center gap-2"><AlertTriangle className="size-3.5 text-amber-300" />{issues.length} supported preview issue{issues.length === 1 ? "" : "s"} detected</div><Button size="sm" disabled={busy} onClick={() => autoFix.mutate({ projectId, issues, requestId })} className="h-7 rounded-md bg-amber-300 px-2.5 text-[10px] font-semibold text-zinc-950 hover:bg-amber-200">{autoFix.isPending ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : <WandSparkles className="mr-1.5 size-3" />}Auto-fix</Button></div>}<div className="relative flex min-h-[475px] items-start justify-center overflow-auto bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.08),transparent_44%),linear-gradient(45deg,rgba(255,255,255,0.018)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.018)_75%),linear-gradient(45deg,rgba(255,255,255,0.018)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.018)_75%)] bg-[length:auto,16px_16px,16px_16px] bg-[position:0_0,0_0,8px_8px] p-3 sm:min-h-[640px] sm:p-8"><div className={`relative overflow-hidden rounded-xl border border-white/[0.12] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-[width] duration-200 ${device === "mobile" ? "w-[390px] max-w-full" : "w-full max-w-5xl"}`}><div className="flex h-8 items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-3"><span className="size-1.5 rounded-full bg-zinc-300" /><span className="size-1.5 rounded-full bg-zinc-300" /><span className="size-1.5 rounded-full bg-zinc-300" /><span className="ml-2 truncate text-[9px] text-zinc-400">lakay · live preview</span><span className="ml-auto text-[9px] text-emerald-500">sandboxed</span></div>{hasBuild ? <iframe key={previewKey} ref={previewFrameRef} title="Generated Lakay application preview" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={previewDocument} className={`h-[440px] w-full bg-white transition-opacity duration-200 sm:h-[590px] ${previewBusy ? "opacity-60" : "opacity-100"}`} /> : <div className="grid h-[440px] place-items-center bg-[#fafaff] p-6 text-center sm:h-[590px] sm:p-8"><div><div className="mx-auto grid size-11 place-items-center rounded-xl bg-violet-100"><Play className="size-5 text-violet-600" /></div><h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-zinc-900">Your live preview is ready.</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">Tell Lakay what to build in the chat. It will generate real files and load the resulting application here.</p></div></div>}{previewBusy && <div aria-live="polite" className="absolute inset-x-0 bottom-0 top-8 grid place-items-center bg-white/35 p-6 text-center backdrop-blur-[1px]"><div className="rounded-2xl border border-violet-200/80 bg-white/95 px-5 py-4 shadow-[0_18px_50px_rgba(76,29,149,0.14)]"><Loader2 className="mx-auto size-5 animate-spin text-violet-500" /><p className="mt-2 text-sm font-semibold text-zinc-900">{isGenerating ? "Lakay construit votre application" : "Aperçu final en préparation"}</p><p className="mt-1 text-xs text-zinc-500">{hasBuild ? "Votre version actuelle reste visible pendant la mise à jour." : "Les fichiers apparaîtront ici dès qu’ils seront prêts."}</p></div></div>}</div></div></div>}

        {workspaceTab === "files" && <div className="mx-auto max-w-4xl p-5 sm:p-8"><div className="flex items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-300">Project files</p><h2 className="mt-2 text-xl font-semibold">Generated application structure</h2></div><span className="text-xs text-zinc-500">{builder?.files.length || 0} files</span></div><div className="mt-6 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">{builder?.files.length ? builder.files.map(file => <button key={file.path} onClick={() => { setSelectedPath(file.path); setWorkspaceTab("code"); }} className="flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left last:border-0 hover:bg-white/[0.04]"><span className="grid size-7 place-items-center rounded-md bg-white/[0.06] font-mono text-[9px] text-violet-200">{fileGlyph(file.path)}</span><span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{file.path}</span><span className="text-[11px] text-zinc-600">{file.content.length.toLocaleString()} chars</span><ChevronRight className="size-4 text-zinc-700" /></button>) : <div className="p-10 text-center text-sm text-zinc-600">Use the AI chat to create the first generated application.</div>}</div></div>}

        {workspaceTab === "code" && <div className="grid min-h-[calc(100vh-6.75rem)] grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)]"><aside className="border-b border-white/[0.08] bg-[#0d0d13] p-3 xl:border-b-0 xl:border-r"><p className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-600">Files</p>{builder?.files.map(file => <button key={file.path} onClick={() => setSelectedPath(file.path)} className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs ${selectedPath === file.path ? "bg-violet-400/[0.14] text-violet-100" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"}`}><span className="font-mono text-[9px]">{fileGlyph(file.path)}</span>{file.path}</button>)}</aside><section className="min-w-0"><div className="flex h-11 items-center justify-between border-b border-white/[0.08] px-4"><div className="flex items-center gap-2 text-xs text-zinc-400"><Code2 className="size-3.5 text-violet-300" />{selectedPath}</div><Button size="sm" variant="outline" disabled={!selectedFile || editorContent === selectedFile.content || busy} onClick={saveCurrentFile} className="h-7 rounded-md border-white/[0.1] bg-transparent text-xs text-zinc-300"><Save className="mr-1.5 size-3" />Save & refresh</Button></div>{selectedFile ? <Textarea spellCheck={false} value={editorContent} onChange={event => setEditorContent(event.target.value)} className="min-h-[calc(100vh-10rem)] w-full resize-none rounded-none border-0 bg-[#101016] p-5 font-mono text-xs leading-6 text-zinc-300 focus-visible:ring-0" /> : <div className="grid h-72 place-items-center text-sm text-zinc-600">No generated file selected.</div>}</section></div>}

        {workspaceTab === "runner" && <><div className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-[11px] ${telemetryLive ? "border-violet-300/20 bg-violet-300/[0.06] text-violet-100" : "border-white/[0.07] bg-white/[0.015] text-zinc-500"}`}><span className="inline-flex items-center gap-2"><span className={`size-1.5 rounded-full ${telemetryLive ? "animate-pulse bg-violet-300" : "bg-zinc-600"}`} />{telemetryLive ? "Runner status and sanitized logs update every 3 seconds" : "Runner monitoring starts automatically when a job is queued"}</span>{lastTelemetryAt && <span className="font-mono text-[10px] text-zinc-500">Last update {new Date(lastTelemetryAt).toLocaleTimeString()}</span>}</div><RunnerWorkspace profile={runnerProfile} jobs={runnerJobs} logs={runnerLogs} busy={busy} onPrepare={() => prepareFullStack.mutate({ projectId })} onQueue={() => queueRunner.mutate({ projectId })} /></>}

        {workspaceTab === "logs" && <div className="mx-auto max-w-4xl p-5 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-300">Build activity</p><h2 className="mt-2 text-xl font-semibold">Logs and diagnostics</h2><div className="mt-6 space-y-2">{issues.map(issue => <div key={issue} className="flex items-start gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-amber-100"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" />{issue}</div>)}{buildLogs.length ? buildLogs.map(log => <div key={log.id} className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-xs text-zinc-400"><span className={`mt-1 size-1.5 rounded-full ${log.tone === "error" ? "bg-red-400" : log.tone === "success" ? "bg-emerald-400" : log.tone === "warning" ? "bg-amber-300" : "bg-violet-300"}`} /> <div className="flex-1">{log.text}</div><time className="text-[10px] text-zinc-700">{new Date(log.createdAt).toLocaleTimeString()}</time></div>) : <div className="rounded-xl border border-dashed border-white/[0.1] p-8 text-center text-sm text-zinc-600">Build events and supported preview errors will appear here.</div>}</div></div>}

        {workspaceTab === "changes" && <div className="mx-auto max-w-4xl p-5 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-300">Project history</p><h2 className="mt-2 text-xl font-semibold">Changes and restorable versions</h2><p className="mt-2 text-sm text-zinc-500">Compare each saved version with the files currently running in the live preview.</p><div className="mt-6 space-y-3">{builder?.versions.length ? builder.versions.map(version => <div key={version.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-zinc-300">{version.summary || version.instruction || "Generated project version"}</p><p className="mt-1 text-[11px] text-zinc-600">{new Date(version.createdAt).toLocaleString()} · {version.origin}</p></div><Button size="sm" variant="outline" disabled={busy} onClick={() => restore.mutate({ projectId, versionId: version.id })} className="h-8 rounded-md border-white/[0.1] bg-transparent text-xs text-zinc-300"><RotateCcw className="mr-1.5 size-3" />Restore</Button></div><FileDiffPreview previous={version.files} current={builder.files} /></div>) : <div className="rounded-xl border border-dashed border-white/[0.1] p-8 text-center text-sm text-zinc-600">Your generated builds and file edits will appear here as restorable changes.</div>}</div></div>}
      </main>
    </div>
  </div></DashboardLayout>;
}
