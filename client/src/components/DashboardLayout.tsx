import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { LakayMark } from "@/components/LakayMark";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CircleDollarSign, FolderKanban, FolderPlus, LogOut, Menu, Settings2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { LocalAuthGate } from "@/components/LocalAuthGate";

const navigation = [
  { icon: FolderPlus, label: "Nouvelle création", path: "/projects/new", primary: true },
  { icon: FolderKanban, label: "Mes projets", path: "/dashboard" },
  { icon: CircleDollarSign, label: "Plans & Crédits", path: "/plans" },
  { icon: Settings2, label: "Paramètres", path: "/settings" },
];

function pageTitle(location: string) {
  if (location === "/projects/new") return "";
  if (location.startsWith("/settings")) return "Paramètres";
  if (location === "/plans") return "Plans & Crédits";
  if (location === "/dashboard") return "Mes projets";
  if (location.endsWith("/build") || location === "/build") return "App builder";
  return "";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: creditBalance } = trpc.billing.balance.useQuery(undefined, { enabled: Boolean(user) });
  const go = (path: string) => { setDrawerOpen(false); navigate(path); };
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#0b0f11]"><div className="size-6 animate-pulse rounded-full bg-emerald-400/70" /></div>;
  if (!user) return <LocalAuthGate />;
  const title = pageTitle(location);
  return <div className="min-h-screen bg-[#0b0f11] text-zinc-100"><header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.07] bg-[#0b0f11]/90 px-4 backdrop-blur sm:px-6"><button onClick={() => setDrawerOpen(true)} aria-label="Ouvrir la navigation" className="grid size-10 place-items-center rounded-full bg-white/[0.07] text-zinc-100 transition-colors hover:bg-white/[0.12]"><Menu className="size-5" /></button><p className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-zinc-200">{title}</p><button onClick={() => go("/plans")} aria-label={`${creditBalance?.balance ?? 0} crédits disponibles`} className="inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[0.07] px-3 py-1.5 text-sm font-semibold tabular-nums text-amber-200"><Sparkles className="size-3.5 fill-amber-200/30" />{creditBalance?.balance ?? 0}</button></header><main className="min-h-[calc(100vh-3.5rem)]">{children}</main><Sheet open={drawerOpen} onOpenChange={setDrawerOpen}><SheetContent side="left" className="flex w-[84%] max-w-sm flex-col border-white/[0.08] bg-[#101419] p-5 text-zinc-100"><SheetHeader><SheetTitle className="text-left"><LakayMark /></SheetTitle></SheetHeader><nav className="mt-5 space-y-2"><button onClick={() => go("/projects/new")} className="flex w-full items-center gap-3 rounded-xl bg-emerald-400 px-3 py-3 text-left text-sm font-semibold text-emerald-950"><FolderPlus className="size-4" />Nouvelle création</button>{navigation.slice(1).map(item => <button key={item.path} onClick={() => go(item.path)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${location === item.path ? "bg-white/[0.08] text-emerald-200" : "text-zinc-300 hover:bg-white/[0.06]"}`}><item.icon className="size-4" />{item.label}</button>)}</nav><div className="mt-auto space-y-3 border-t border-white/[0.07] pt-4"><button onClick={() => go("/plans")} className="flex w-full items-center gap-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.07] p-3 text-left"><Sparkles className="size-4 text-amber-200" /><span className="text-sm font-semibold text-amber-100">{creditBalance?.balance ?? 0} crédits</span><span className="ml-auto text-xs text-amber-100/60">Voir les plans</span></button><div className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3"><Avatar className="size-9 border border-white/10"><AvatarFallback className="bg-emerald-400/15 text-emerald-200">{user.name?.charAt(0).toUpperCase() || "L"}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name || "Membre Lakay"}</p><p className="truncate text-xs text-zinc-500">{user.email || "Connecté avec Manus"}</p></div><button onClick={logout} aria-label="Se déconnecter" className="text-zinc-500 hover:text-rose-300"><LogOut className="size-4" /></button></div></div></SheetContent></Sheet></div>;
}
