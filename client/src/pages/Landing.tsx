import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, Plus, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const startCreating = () => { if (isAuthenticated) navigate("/projects/new"); else navigate("/login"); };
  const content = <div className="min-h-screen overflow-hidden bg-[#080d0d] text-white"><div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(45,212,191,0.17),transparent_33%),radial-gradient(circle_at_10%_75%,rgba(14,116,144,0.10),transparent_30%)]" />{!isAuthenticated && <header className="relative z-10 flex h-14 items-center justify-between px-5"><button onClick={() => navigate("/login")} aria-label="Se connecter" className="grid size-10 place-items-center rounded-full bg-white/[0.07] text-zinc-100"><Menu className="size-5" /></button><span className="inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[0.07] px-3 py-1.5 text-sm font-semibold text-amber-200"><Sparkles className="size-3.5" />0</span></header>}<main className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-4xl flex-col items-center justify-center px-5 pb-20 text-center sm:min-h-[calc(100svh-4rem)]"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">Lakay AI</p><h1 className="mt-4 max-w-3xl text-balance text-[2.85rem] font-semibold leading-[0.98] tracking-[-0.07em] sm:text-7xl">Créez votre application.<br />Voyez-la prendre vie.</h1><p className="mt-5 max-w-lg text-pretty text-sm leading-6 text-zinc-400 sm:text-base">Décrivez votre idée, créez votre projet et visualisez le résultat dans un seul espace.</p><Button disabled={loading} onClick={startCreating} size="lg" className="mt-8 h-12 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-emerald-950 hover:bg-emerald-300">{isAuthenticated ? "Créer un projet" : "Se connecter pour créer"}<ArrowRight className="ml-2 size-4" /></Button></main></div>;
  return isAuthenticated ? <DashboardLayout>{content}</DashboardLayout> : content;
}
