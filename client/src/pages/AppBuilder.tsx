import DashboardLayout from "@/components/DashboardLayout";
import { LakayMark } from "@/components/LakayMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { BuilderFile, BuilderFilePath } from "@shared/builder";
import { ArrowLeft, Check, ChevronDown, Code2, Eye, FileCode2, History, Laptop, Loader2, Monitor, Play, RotateCcw, Save, Smartphone, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

function makePreviewDocument(files: BuilderFile[]) {
  const html = files.find(file => file.path === "index.html")?.content || "<main><h1>Waiting for your first build</h1></main>";
  const css = files.find(file => file.path === "styles.css")?.content || "";
  const js = files.find(file => file.path === "app.js")?.content || "";
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  const security = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:\">";
  let document = html.replace(/<head([^>]*)>/i, `<head$1>${security}<style>${safeCss}</style>`);
  if (document === html) document = `${security}<style>${safeCss}</style>${html}`;
  const inlineScript = `<script>${safeJs}<\/script>`;
  document = document.replace(/<script[^>]*src=["'][^"']*app\.js[^"']*["'][^>]*><\/script>/i, inlineScript);
  if (!document.includes(inlineScript)) document = document.replace(/<\/body>/i, `${inlineScript}</body>`);
  return document;
}

function fileIcon(path: BuilderFilePath) {
  if (path === "styles.css") return "#";
  if (path === "app.js") return "JS";
  return "<>";
}

export default function AppBuilder() {
  const [, params] = useRoute("/projects/:projectId/build");
  const projectId = params?.projectId ?? "";
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const { data: builder, isLoading: builderLoading } = trpc.builder.get.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const [selectedPath, setSelectedPath] = useState<BuilderFilePath>("index.html");
  const [editorContent, setEditorContent] = useState("");
  const [direction, setDirection] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [historyOpen, setHistoryOpen] = useState(false);

  const selectedFile = builder?.files.find(file => file.path === selectedPath);
  const previewDocument = useMemo(() => makePreviewDocument(builder?.files || []), [builder?.files]);

  useEffect(() => {
    if (selectedFile) setEditorContent(selectedFile.content);
  }, [selectedFile?.content, selectedFile?.path]);

  const generate = trpc.builder.generate.useMutation({
    onSuccess: async () => {
      await utils.builder.get.invalidate({ projectId });
      setDirection("");
      toast.success("Your new build is ready to refine.");
    },
    onError: error => toast.error(error.message || "Lakay could not create this build."),
  });
  const saveFile = trpc.builder.updateFile.useMutation({
    onSuccess: async () => {
      await utils.builder.get.invalidate({ projectId });
      toast.success("File saved.");
    },
    onError: error => toast.error(error.message),
  });
  const restore = trpc.builder.restoreVersion.useMutation({
    onSuccess: async () => {
      await utils.builder.get.invalidate({ projectId });
      setHistoryOpen(false);
      toast.success("Build version restored.");
    },
    onError: error => toast.error(error.message),
  });

  const isBusy = generate.isPending || saveFile.isPending || restore.isPending;
  const hasBuild = Boolean(builder?.files.length);

  if (projectLoading || builderLoading) return <DashboardLayout><div className="grid min-h-[70vh] place-items-center"><Loader2 className="size-5 animate-spin text-violet-300" /></div></DashboardLayout>;
  if (!project) return <DashboardLayout><div className="mx-auto max-w-md py-28 text-center"><h1 className="text-xl font-semibold text-white">This project is not available.</h1><Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-xl">Return to projects</Button></div></DashboardLayout>;

  return <DashboardLayout><div className="min-h-screen bg-[#0b0b10]"><header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0d0d12]/95 px-4 backdrop-blur sm:px-6"><div className="flex min-w-0 items-center gap-3"><button onClick={() => navigate(`/projects/${projectId}`)} className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100" aria-label="Return to project"><ArrowLeft className="size-4" /></button><div className="hidden h-5 w-px bg-white/10 sm:block" /><div className="min-w-0"><p className="truncate text-sm font-semibold tracking-[-0.025em] text-zinc-100">{project.name}</p><p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-violet-300">Lakay build</p></div><Badge className="hidden border-0 bg-emerald-400/10 text-emerald-300 sm:inline-flex">Static web app</Badge></div><div className="flex shrink-0 items-center gap-2"><div className="hidden rounded-lg border border-white/[0.08] bg-white/[0.025] p-0.5 md:flex"><button onClick={() => setDevice("desktop")} className={`grid size-7 place-items-center rounded-md ${device === "desktop" ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-300"}`} aria-label="Desktop preview"><Monitor className="size-3.5" /></button><button onClick={() => setDevice("mobile")} className={`grid size-7 place-items-center rounded-md ${device === "mobile" ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-300"}`} aria-label="Mobile preview"><Smartphone className="size-3.5" /></button></div><Button variant="outline" onClick={() => setHistoryOpen(value => !value)} className="hidden rounded-xl border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white sm:inline-flex"><History className="mr-2 size-3.5" />Versions</Button><Button disabled={isBusy} onClick={() => generate.mutate({ projectId, instruction: direction || undefined })} className="rounded-xl bg-violet-400 text-zinc-950 hover:bg-violet-300"><WandSparkles className="mr-2 size-3.5" />{hasBuild ? "Regenerate" : "Build site"}</Button></div></header>

    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 xl:grid-cols-[285px_minmax(0,1fr)_360px]"><aside className="border-b border-white/[0.07] bg-[#0c0c11] p-4 xl:border-b-0 xl:border-r"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><LakayMark compact /><span className="text-xs font-medium text-zinc-400">Files</span></div><span className="font-mono text-[10px] text-zinc-600">{builder?.files.length || 0}/3</span></div><div className="mt-6"><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Generated project</p><div className="space-y-1">{(["index.html", "styles.css", "app.js"] as BuilderFilePath[]).map(path => <button key={path} disabled={!builder?.files.some(file => file.path === path)} onClick={() => setSelectedPath(path)} className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs transition-colors ${selectedPath === path ? "bg-violet-400/[0.12] text-violet-100" : "text-zinc-500 hover:bg-white/[0.045] hover:text-zinc-300"} disabled:cursor-not-allowed disabled:opacity-40`}><span className="grid size-5 place-items-center rounded bg-white/[0.06] font-mono text-[8px] text-zinc-400">{fileIcon(path)}</span>{path}</button>)}</div></div><div className="mt-7 rounded-xl border border-violet-300/[0.12] bg-violet-400/[0.055] p-3.5"><div className="flex items-center gap-2 text-violet-200"><Sparkles className="size-3.5" /><p className="text-xs font-medium">How Lakay builds</p></div><p className="mt-2 text-[11px] leading-5 text-zinc-500">Every build is a self-contained front-end app, ready to preview and shape in the browser.</p></div></aside>

      <main className="min-w-0 border-b border-white/[0.07] bg-[#101015] xl:border-b-0 xl:border-r"><div className="flex h-11 items-center justify-between border-b border-white/[0.07] px-4"><div className="flex items-center gap-2 text-xs text-zinc-400"><Eye className="size-3.5 text-violet-300" />Live preview</div><div className="flex items-center gap-1 md:hidden"><button onClick={() => setDevice("desktop")} className={`grid size-7 place-items-center rounded ${device === "desktop" ? "text-violet-200" : "text-zinc-600"}`}><Laptop className="size-3.5" /></button><button onClick={() => setDevice("mobile")} className={`grid size-7 place-items-center rounded ${device === "mobile" ? "text-violet-200" : "text-zinc-600"}`}><Smartphone className="size-3.5" /></button></div><span className="font-mono text-[10px] text-zinc-600">{device === "mobile" ? "390 px" : "responsive"}</span></div><div className="relative flex min-h-[550px] items-start justify-center overflow-auto bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.07),transparent_42%),linear-gradient(45deg,rgba(255,255,255,0.018)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.018)_75%),linear-gradient(45deg,rgba(255,255,255,0.018)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.018)_75%)] bg-[length:auto,16px_16px,16px_16px] bg-[position:0_0,0_0,8px_8px] p-5 sm:p-8"><div className={`overflow-hidden rounded-xl border border-white/[0.12] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-[width] duration-200 ${device === "mobile" ? "w-[390px] max-w-full" : "w-full max-w-5xl"}`}><div className="flex h-8 items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-3"><span className="size-1.5 rounded-full bg-zinc-300" /><span className="size-1.5 rounded-full bg-zinc-300" /><span className="size-1.5 rounded-full bg-zinc-300" /><span className="ml-2 truncate text-[9px] text-zinc-400">lakay preview</span></div>{hasBuild ? <iframe title="Generated Lakay website preview" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={previewDocument} className="h-[560px] w-full bg-white" /> : <div className="grid h-[560px] place-items-center bg-[#fcfcfe] p-8 text-center"><div><div className="mx-auto grid size-11 place-items-center rounded-xl bg-violet-100"><Play className="size-5 text-violet-600" /></div><h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-zinc-900">Ready when you are.</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-500">Give Lakay a direction and it will turn this project into a working website or front-end app.</p></div></div>}</div></div></main>

      <aside className="min-w-0 bg-[#0c0c11]"><div className="flex h-11 items-center justify-between border-b border-white/[0.07] px-4"><div className="flex items-center gap-2 text-xs text-zinc-400"><Code2 className="size-3.5 text-violet-300" />{selectedPath}</div>{hasBuild && <Button variant="ghost" size="sm" disabled={isBusy || editorContent === selectedFile?.content} onClick={() => saveFile.mutate({ projectId, path: selectedPath, content: editorContent })} className="h-7 rounded-md px-2 text-[11px] text-zinc-400 hover:bg-white/5 hover:text-white"><Save className="mr-1.5 size-3" />Save</Button>}</div><div className="p-4"><label className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Build direction</label><Textarea value={direction} onChange={event => setDirection(event.target.value)} placeholder={hasBuild ? "For example: Turn this into a richer dashboard with an activity feed." : "For example: Build a high-end booking site for a modern barbershop."} className="mt-2 min-h-28 resize-none rounded-xl border-white/[0.1] bg-white/[0.025] text-xs leading-5 text-zinc-300 placeholder:text-zinc-700 focus-visible:border-violet-400/50 focus-visible:ring-violet-400/20" /><Button disabled={isBusy} onClick={() => generate.mutate({ projectId, instruction: direction || undefined })} className="mt-3 h-9 w-full rounded-xl bg-white text-xs font-semibold text-zinc-950 hover:bg-zinc-100">{generate.isPending ? <><Loader2 className="mr-2 size-3.5 animate-spin" />Building your site</> : <><Sparkles className="mr-2 size-3.5" />{hasBuild ? "Apply with AI" : "Create first build"}</>}</Button></div><div className="border-t border-white/[0.07] px-4 py-3"><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Editor</p>{hasBuild ? <Textarea spellCheck={false} value={editorContent} onChange={event => setEditorContent(event.target.value)} className="h-[370px] resize-none rounded-xl border-white/[0.08] bg-black/25 font-mono text-[11px] leading-5 text-zinc-400 placeholder:text-zinc-700 focus-visible:border-violet-400/50 focus-visible:ring-violet-400/20" /> : <div className="grid h-40 place-items-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.018] p-5 text-center"><FileCode2 className="size-4 text-zinc-700" /><p className="mt-2 text-xs text-zinc-600">Generated files will appear here.</p></div>}</div>{historyOpen && <div className="border-t border-white/[0.07] p-4"><div className="mb-3 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Build versions</p><button onClick={() => setHistoryOpen(false)} className="text-[10px] text-zinc-600 hover:text-zinc-300">Close</button></div><ScrollArea className="h-40"><div className="space-y-2">{builder?.versions.length ? builder.versions.map(version => <div key={version.id} className="rounded-lg border border-white/[0.07] bg-white/[0.018] p-2.5"><div className="flex items-center justify-between gap-2"><p className="text-[11px] text-zinc-400">{new Date(version.createdAt).toLocaleString()}</p><button disabled={restore.isPending} onClick={() => restore.mutate({ projectId, versionId: version.id })} className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-300 hover:text-violet-100"><RotateCcw className="size-3" />Restore</button></div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-zinc-600">{version.instruction || "Initial generated build"}</p></div>) : <p className="text-xs text-zinc-600">Your build history will appear here.</p>}</div></ScrollArea></div>}</aside>
    </div></div></DashboardLayout>;
}
