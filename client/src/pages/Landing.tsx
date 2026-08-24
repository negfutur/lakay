import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { ArrowRight, FolderKanban, Menu, Plus, Settings2, Sparkles, WalletCards } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { startLogin } from "@/const";

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: creditBalance } = trpc.billing.balance.useQuery(undefined, { enabled: isAuthenticated });
  const [menuOpen, setMenuOpen] = useState(false);
  const startCreating = () => {
    if (isAuthenticated) navigate("/projects/new");
    else startLogin();
  };

  return <div className="min-h-screen overflow-hidden bg-[#080d0d] text-white">
    <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(45,212,191,0.17),transparent_33%),radial-gradient(circle_at_10%_75%,rgba(14,116,144,0.10),transparent_30%)]" />
    <header className="relative z-10 mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8"><button onClick={() => isAuthenticated ? setMenuOpen(true) : startLogin()} aria-label="Ouvrir la navigation" className="grid size-10 place-items-center rounded-full bg-white/[0.07] text-zinc-100 transition-colors hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"><Menu className="size-5" /></button><div aria-label={`${creditBalance?.balance ?? 0} crédits disponibles`} className="inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[0.07] px-3 py-1.5 text-sm font-semibold tabular-nums text-amber-200"><Sparkles className="size-3.5 fill-amber-200/30 text-amber-200" />{creditBalance?.balance ?? 0}<span className="hidden text-amber-100/60 sm:inline">crédits</span></div></header>
    <main className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-4xl flex-col items-center justify-center px-5 pb-20 text-center sm:min-h-[calc(100svh-4rem)] sm:px-8 sm:pb-28">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">Lakay AI</p>
      <h1 className="mt-4 max-w-3xl text-balance text-[2.85rem] font-semibold leading-[0.98] tracking-[-0.07em] sm:text-7xl">Créez votre application.<br />Voyez-la prendre vie.</h1>
      <p className="mt-5 max-w-lg text-pretty text-sm leading-6 text-zinc-400 sm:text-base">Décrivez votre idée, créez votre projet et visualisez le résultat dans un seul espace.</p>
      <Button disabled={loading} onClick={startCreating} size="lg" className="mt-8 h-12 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-emerald-950 shadow-[0_14px_38px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-emerald-300 active:scale-[0.97]">{isAuthenticated ? "Créer un projet" : "Se connecter pour créer"}<ArrowRight className="ml-2 size-4" /></Button>
    </main><Sheet open={menuOpen} onOpenChange={setMenuOpen}><SheetContent side="left" className="border-white/[0.08] bg-[#101419] p-5 text-zinc-100"><SheetHeader><SheetTitle className="text-left text-base">Menu Lakay</SheetTitle></SheetHeader><nav className="mt-5 space-y-2"><button onClick={() => { setMenuOpen(false); navigate("/projects/new"); }} className="flex w-full items-center gap-3 rounded-xl bg-emerald-400 px-3 py-3 text-left text-sm font-semibold text-emerald-950"><Plus className="size-4" />Nouvelle création</button><button onClick={() => { setMenuOpen(false); navigate("/dashboard"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-300 hover:bg-white/[0.06]"><FolderKanban className="size-4 text-emerald-300" />Mes projets</button><button onClick={() => { setMenuOpen(false); navigate("/settings?tab=billing"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-300 hover:bg-white/[0.06]"><WalletCards className="size-4 text-amber-200" />Crédits & facturation <span className="ml-auto tabular-nums text-amber-200">{creditBalance?.balance ?? 0}</span></button><button onClick={() => { setMenuOpen(false); navigate("/settings"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-300 hover:bg-white/[0.06]"><Settings2 className="size-4 text-zinc-400" />Paramètres</button></nav></SheetContent></Sheet>
  </div>;
}
