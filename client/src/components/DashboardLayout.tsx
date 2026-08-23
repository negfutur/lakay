import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { LakayMark } from "@/components/LakayMark";
import { applyWorkspacePreferences, isQuickSwitchShortcut, parseWorkspacePreferences, withDensityPreviewOverride, WORKSPACE_PREFERENCES_KEY } from "@/lib/workspacePreferences";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Command as CommandIcon, FolderPlus, LayoutDashboard, LogOut, PanelLeft, Search, Settings2, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const navigation = [
  { icon: FolderPlus, label: "Nouvelle création", path: "/projects/new", shortcut: "N", primary: true },
  { icon: LayoutDashboard, label: "Mes projets", path: "/dashboard", shortcut: "G P" },
  { icon: WandSparkles, label: "App builder", path: "/build", shortcut: "G B" },
  { icon: Settings2, label: "Settings", path: "/settings", shortcut: "G S" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [quickOpen, setQuickOpen] = useState(false);
  const { data: creditBalance } = trpc.billing.balance.useQuery(undefined, { enabled: Boolean(user) });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isQuickSwitchShortcut(event)) {
        event.preventDefault();
        setQuickOpen(open => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const stored = parseWorkspacePreferences(localStorage.getItem(WORKSPACE_PREFERENCES_KEY));
    const densityOverride = new URLSearchParams(window.location.search).get("density");
    applyWorkspacePreferences(document.documentElement, withDensityPreviewOverride(stored, densityOverride));
  }, []);

  const go = (path: string) => {
    navigate(path);
    setQuickOpen(false);
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#0b0b10]"><div className="size-6 animate-pulse rounded-full bg-violet-400/70" /></div>;
  if (!user) return <div className="grid min-h-screen place-items-center bg-[#0b0b10] p-5"><div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.035] p-7 text-center"><LakayMark className="justify-center" /><h1 className="mt-7 text-xl font-semibold tracking-[-0.04em] text-white">Your workspace is waiting.</h1><p className="mt-2 text-sm leading-6 text-zinc-500">Sign in with Manus to create and manage your Lakay projects.</p><Button onClick={() => startLogin()} className="mt-7 w-full rounded-xl bg-violet-400 font-semibold text-zinc-950 hover:bg-violet-300">Continue with Manus</Button></div></div>;

  return <SidebarProvider defaultOpen>
    <Sidebar className="border-r border-white/[0.07] bg-[#101419] text-zinc-400">
      <SidebarHeader className="h-20 justify-center px-4"><div className="flex items-center justify-between"><LakayMark /><button onClick={() => navigate("/dashboard")} className="hidden size-8 place-items-center rounded-lg text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-200 group-data-[collapsible=icon]:grid" aria-label="Open projects"><PanelLeft className="size-4" /></button></div></SidebarHeader>
      <SidebarContent className="px-3">
        <button onClick={() => setQuickOpen(true)} className="mb-5 flex h-9 w-full items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-left text-xs text-zinc-500 transition-colors hover:border-emerald-300/20 hover:bg-emerald-400/[0.06] hover:text-zinc-200 group-data-[collapsible=icon]:hidden"><Search className="size-3.5" /><span>Rechercher</span><kbd className="ml-auto rounded border border-white/[0.08] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">⌘ K</kbd></button>
        <p className="px-3 pb-2 pt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-700 group-data-[collapsible=icon]:hidden">Créer & gérer</p>
        <SidebarMenu>{navigation.map(item => { const active = item.path === "/build" ? location === "/build" || location.endsWith("/build") : item.path === "/dashboard" ? location === "/dashboard" || (location.startsWith("/projects/") && !location.endsWith("/build")) : location === item.path; return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={active} onClick={() => navigate(item.path)} tooltip={item.label} className={`h-10 rounded-xl px-3 transition-colors ${item.primary ? "mb-2 bg-emerald-400 text-emerald-950 hover:bg-emerald-300 hover:text-emerald-950" : "text-zinc-500 hover:bg-white/[0.055] hover:text-zinc-200 data-[active=true]:bg-emerald-400/[0.12] data-[active=true]:text-emerald-100"}`}><item.icon className="size-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="space-y-2 p-3"><button onClick={() => navigate("/settings?tab=billing")} className="flex w-full items-center gap-2 rounded-2xl border border-amber-200/15 bg-gradient-to-r from-amber-300/[0.12] to-emerald-300/[0.06] p-3 text-left transition-colors hover:border-amber-200/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 group-data-[collapsible=icon]:justify-center"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-200/15 text-amber-200"><Sparkles className="size-4 fill-amber-200/30" /></span><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="text-sm font-semibold tabular-nums text-amber-100">{creditBalance?.balance ?? 0} crédits</p><p className="mt-0.5 text-[10px] text-amber-100/55">Gérer les crédits</p></div></button><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.045] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 group-data-[collapsible=icon]:justify-center"><Avatar className="size-8 border border-white/10"><AvatarFallback className="bg-emerald-400/15 text-[11px] font-semibold text-emerald-200">{user.name?.charAt(0).toUpperCase() || "L"}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-medium text-zinc-200">{user.name || "Membre Lakay"}</p><p className="mt-0.5 truncate text-[10px] text-zinc-600">{user.email || "Connecté avec Manus"}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 border-white/10 bg-[#1a1a20] text-zinc-300"><DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer focus:bg-white/5"><Settings2 className="mr-2 size-4" />Paramètres</DropdownMenuItem><DropdownMenuItem onClick={logout} className="cursor-pointer text-red-300 focus:bg-red-400/10 focus:text-red-200"><LogOut className="mr-2 size-4" />Se déconnecter</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter>
    </Sidebar>
    <SidebarInset className="min-h-screen min-w-0 bg-[#0b0f11]"><div className="sticky top-0 z-20 flex h-14 items-center border-b border-white/[0.07] bg-[#0b0f11]/90 px-3 backdrop-blur md:hidden"><SidebarTrigger className="size-9 rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white" /><LakayMark className="ml-2 scale-90 origin-left" /><button onClick={() => setQuickOpen(true)} className="ml-auto grid size-9 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-white/5 hover:text-white" aria-label="Rechercher"><Search className="size-4" /></button></div><main className="min-h-screen min-w-0">{children}</main></SidebarInset>
    <CommandDialog open={quickOpen} onOpenChange={setQuickOpen} title="Lakay quick switch" description="Jump between workspace destinations." className="border-white/10 bg-[#15151b] text-zinc-100 sm:max-w-lg"><CommandInput placeholder="Search Lakay…" /><CommandList><CommandEmpty className="text-zinc-500">No workspace destination found.</CommandEmpty><CommandGroup heading="Navigate">{navigation.map(item => <CommandItem key={item.path} value={item.label} onSelect={() => go(item.path)} className="cursor-pointer text-zinc-300 data-[selected=true]:bg-violet-400/[0.12] data-[selected=true]:text-violet-100"><item.icon className="size-4" /><span>{item.label}</span><CommandShortcut>{item.shortcut}</CommandShortcut></CommandItem>)}</CommandGroup><CommandGroup heading="Actions"><CommandItem value="Quick switch" onSelect={() => setQuickOpen(false)} className="cursor-pointer text-zinc-300 data-[selected=true]:bg-violet-400/[0.12] data-[selected=true]:text-violet-100"><CommandIcon className="size-4" /><span>Close quick switch</span><CommandShortcut>Esc</CommandShortcut></CommandItem></CommandGroup></CommandList></CommandDialog>
  </SidebarProvider>;
}
