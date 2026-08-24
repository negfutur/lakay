import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CircleDollarSign, Sparkles } from "lucide-react";

export default function PlansCredits() {
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/plans" });
  const { data: balance } = trpc.billing.balance.useQuery(undefined, { enabled: Boolean(user) });
  const { data: packages = [] } = trpc.billing.packages.useQuery(undefined, { enabled: Boolean(user) });
  const cards = packages.length ? (packages as { label: string; credits: number }[]).map(item => ({ title: item.label, caption: `${item.credits} crédits` })) : [{ title: "500 crédits", caption: "Pour vos créations" }, { title: "1 000 crédits", caption: "Pour aller plus loin" }, { title: "Pass Illimité", caption: "Bientôt disponible" }];
  return <DashboardLayout><div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9"><div className="border-b border-border pb-6"><div className="inline-flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="size-3.5" />Lakay</div><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Plans & Crédits</h1><p className="mt-2 text-sm text-muted-foreground">Choisissez une formule adaptée à votre rythme de création.</p></div><section className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-emerald-400/5 p-6"><p className="text-xs font-medium text-primary">SOLDE DISPONIBLE</p><p className="mt-2 text-5xl font-semibold">{balance?.balance ?? 0}</p><p className="text-sm text-muted-foreground">crédits Lakay</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{cards.map(card => <div key={card.title} className="rounded-xl border border-border bg-card p-4"><p className="font-semibold">{card.title}</p><p className="mt-1 text-xs text-muted-foreground">{card.caption}</p><Button disabled className="mt-5 w-full rounded-lg"><CircleDollarSign className="mr-2 size-4" />Choisir</Button></div>)}</div></section></div></DashboardLayout>;
}
