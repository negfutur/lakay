import { useAuth } from "@/_core/hooks/useAuth";
import { LakayMark } from "@/components/LakayMark";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { startLogin } from "@/const";

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const startCreating = () => {
    if (isAuthenticated) navigate("/projects/new");
    else startLogin();
  };

  return <div className="min-h-screen overflow-hidden bg-[#080d0d] text-white">
    <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(45,212,191,0.17),transparent_33%),radial-gradient(circle_at_10%_75%,rgba(14,116,144,0.10),transparent_30%)]" />
    <header className="relative z-10 mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8"><Link href="/" aria-label="Accueil Lakay"><LakayMark /></Link><div className="flex items-center gap-2">{isAuthenticated ? <Button variant="ghost" onClick={() => navigate("/dashboard")} className="h-9 px-3 text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-white sm:text-sm">Mes projets</Button> : <Button variant="ghost" disabled={loading} onClick={startLogin} className="h-9 px-3 text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-white sm:text-sm">Se connecter</Button>}<Button disabled={loading} onClick={startCreating} className="h-9 rounded-xl bg-emerald-400 px-3 text-xs font-semibold text-emerald-950 shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:bg-emerald-300 sm:px-4 sm:text-sm"><Plus className="mr-1.5 size-3.5" />Créer</Button></div></header>
    <main className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-4xl flex-col items-center justify-center px-5 pb-20 text-center sm:min-h-[calc(100svh-4rem)] sm:px-8 sm:pb-28">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">Lakay AI</p>
      <h1 className="mt-4 max-w-3xl text-balance text-[2.85rem] font-semibold leading-[0.98] tracking-[-0.07em] sm:text-7xl">Créez votre application.<br />Voyez-la prendre vie.</h1>
      <p className="mt-5 max-w-lg text-pretty text-sm leading-6 text-zinc-400 sm:text-base">Décrivez votre idée, créez votre projet et visualisez le résultat dans un seul espace.</p>
      <Button disabled={loading} onClick={startCreating} size="lg" className="mt-8 h-12 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-emerald-950 shadow-[0_14px_38px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-emerald-300 active:scale-[0.97]">{isAuthenticated ? "Créer un projet" : "Se connecter pour créer"}<ArrowRight className="ml-2 size-4" /></Button>
    </main>
  </div>;
}
