import { LakayMark } from "@/components/LakayMark";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { ArrowRight, Blocks, Bot, Check, Code2, Menu, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const capabilities = [
  ["Plan with precision", "Turn raw ideas into a focused product brief, feature map, and technical direction."],
  ["Refine in context", "Shape the details with a project-aware AI workspace that remembers the conversation."],
  ["Build with clarity", "Keep every important decision, component, and milestone in one calm workspace."],
];

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const startBuilding = () => {
    if (isAuthenticated) navigate("/dashboard");
    else startLogin();
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#09090d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-12%,rgba(139,92,246,0.24),transparent_34%),radial-gradient(circle_at_84%_45%,rgba(59,130,246,0.1),transparent_24%)]" />
      <header className="relative z-20 mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:h-20 sm:px-8">
        <Link href="/" aria-label="Lakay home"><LakayMark /></Link>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#workflow" className="transition-colors hover:text-white">How it works</a>
          <a href="#capabilities" className="transition-colors hover:text-white">Capabilities</a>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-zinc-300 hover:bg-white/6 hover:text-white">Open workspace</Button>
          ) : (
            <Button variant="ghost" disabled={loading} onClick={startLogin} className="text-zinc-300 hover:bg-white/6 hover:text-white">Sign in</Button>
          )}
          <Button onClick={startBuilding} disabled={loading} className="rounded-xl bg-white px-4 text-zinc-950 shadow-[0_8px_28px_rgba(255,255,255,0.1)] transition-transform hover:-translate-y-0.5 hover:bg-zinc-100 active:scale-[0.97]">
            Start building <ArrowRight className="ml-1.5 size-4" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setNavOpen(value => !value)} className="text-zinc-300 md:hidden" aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
        {navOpen && (
          <div className="absolute right-5 top-16 w-60 rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur md:hidden">
            <a href="#workflow" onClick={() => setNavOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5">How it works</a>
            <a href="#capabilities" onClick={() => setNavOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5">Capabilities</a>
            <Button onClick={startBuilding} className="mt-2 w-full rounded-xl bg-white text-zinc-950 hover:bg-zinc-100">Start building</Button>
          </div>
        )}
      </header>

      <main className="relative">
        <section className="mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pb-32 sm:pt-24 lg:pt-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-3 py-1.5 text-[11px] font-medium text-violet-200 sm:mb-7 sm:px-3.5 sm:text-xs">
              <Sparkles className="size-3.5" /> The thoughtful start for every product
            </div>
            <h1 className="text-balance font-display text-4xl font-medium leading-[1.02] tracking-[-0.065em] text-white sm:text-7xl lg:text-8xl">
              Give your next idea<br className="hidden sm:block" /> its clearest shape.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-6 text-zinc-400 sm:mt-7 sm:text-lg sm:leading-7">
              Lakay turns the way you describe an idea into a focused product plan, an intentional technical direction, and a workspace to refine every decision.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:mt-9 sm:flex-row sm:gap-3">
              <Button onClick={startBuilding} disabled={loading} size="lg" className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-300 via-violet-400 to-fuchsia-400 px-6 text-[15px] font-semibold text-zinc-950 shadow-[0_14px_40px_rgba(139,92,246,0.25)] transition-all hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.97] sm:w-auto">
                Start building with Lakay <ArrowRight className="ml-2 size-4" />
              </Button>
              <a href="#workflow" className="inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white sm:w-auto">Explore the workflow</a>
            </div>
          </div>

          <div className="relative mx-auto mt-10 max-w-5xl rounded-[22px] border border-white/[0.1] bg-gradient-to-b from-white/[0.09] to-white/[0.025] p-1.5 shadow-[0_32px_100px_rgba(0,0,0,0.45)] sm:mt-24 sm:rounded-[28px] sm:p-2">
            <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111116]">
              <div className="flex h-11 items-center gap-2 border-b border-white/[0.07] px-4"><span className="size-2 rounded-full bg-zinc-600" /><span className="size-2 rounded-full bg-zinc-600" /><span className="size-2 rounded-full bg-zinc-600" /><span className="ml-3 text-[11px] text-zinc-500">lakay / project brief</span></div>
              <div className="grid min-h-[330px] grid-cols-1 sm:min-h-[390px] lg:grid-cols-[0.32fr_0.68fr]">
                <div className="hidden border-r border-white/[0.07] bg-white/[0.018] p-5 lg:block">
                  <div className="mb-7 flex items-center gap-2"><LakayMark compact /><span className="text-xs font-medium text-zinc-300">Workspace</span></div>
                  <div className="space-y-1"><div className="rounded-lg bg-violet-400/10 px-3 py-2 text-xs text-violet-200">Overview</div><div className="px-3 py-2 text-xs text-zinc-500">Project brief</div><div className="px-3 py-2 text-xs text-zinc-500">AI conversation</div></div>
                </div>
                <div className="p-4 sm:p-8">
                  <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-300">Concept ready</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white sm:text-2xl">A calmer way to plan travel</h2></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">Ready</span></div>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400">A personal travel planner that turns scattered inspiration into a considered, shared itinerary.</p>
                  <div className="mt-5 grid gap-3 sm:mt-7 sm:grid-cols-2"><PreviewCard icon={Blocks} label="Core experience" value="Plan, save, and share" /><PreviewCard icon={Code2} label="Recommended stack" value="React · TypeScript · Database" /></div>
                  <div className="mt-4 rounded-xl border border-violet-300/10 bg-violet-400/[0.055] p-3 sm:mt-5 sm:p-4"><div className="flex gap-3"><div className="grid size-6 shrink-0 place-items-center rounded-md bg-violet-400/15"><Bot className="size-3.5 text-violet-300" /></div><p className="text-xs leading-5 text-zinc-300 sm:text-sm sm:leading-6">I’ve mapped the first release. Want to focus the onboarding flow or the collaboration model next?</p></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-y border-white/[0.07] bg-white/[0.018] py-16 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-violet-300">From idea to direction</p><h2 className="mt-4 max-w-md text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">A planning flow that respects your momentum.</h2></div><div className="grid gap-7 sm:grid-cols-3">{[["01", "Describe it", "Start with a messy thought, a constraint, or a fully formed brief."], ["02", "See the shape", "Receive a product plan, feature priorities, and technical perspective."], ["03", "Make it yours", "Talk through trade-offs until every decision feels deliberate."]].map(([number, title, body]) => <div key={number}><span className="font-mono text-xs text-violet-300">{number}</span><h3 className="mt-4 font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{body}</p></div>)}</div></div></div>
        </section>

        <section id="capabilities" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-28"><div className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end"><div><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-violet-300">Made for a clearer start</p><h2 className="mt-4 text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">Everything needed to make the first move.</h2></div><Button variant="outline" onClick={startBuilding} className="w-fit rounded-xl border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white">Create a project <ArrowRight className="ml-1.5 size-4" /></Button></div><div className="grid gap-3 md:grid-cols-3 sm:gap-4">{capabilities.map(([title, body], index) => <article key={title} className="group rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.055] to-transparent p-5 transition-transform duration-200 hover:-translate-y-1 hover:border-violet-300/20 sm:p-6"><div className="grid size-9 place-items-center rounded-xl bg-violet-400/[0.1] text-violet-200">{[<Sparkles className="size-4" />, <Bot className="size-4" />, <Check className="size-4" />][index]}</div><h3 className="mt-7 text-lg font-semibold tracking-[-0.03em] text-white sm:mt-12">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{body}</p></article>)}</div></section>
      </main>
      <footer className="relative border-t border-white/[0.07] py-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-8"><LakayMark compact /><p>Turn possibility into a plan.</p></div></footer>
    </div>
  );
}

function PreviewCard({ icon: Icon, label, value }: { icon: typeof Blocks; label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5"><Icon className="size-4 text-zinc-500" /><p className="mt-5 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p><p className="mt-1 text-xs font-medium text-zinc-300">{value}</p></div>;
}
