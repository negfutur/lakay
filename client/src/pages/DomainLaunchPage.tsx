import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, ExternalLink, Globe2, Link2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

function purchaseUrl(hostname: string) {
  return `https://www.name.com/domain/search?search=${encodeURIComponent(hostname)}`;
}

export default function DomainLaunchPage() {
  const [, params] = useRoute("/projects/:projectId/domains");
  const projectId = params?.projectId ?? "";
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.domains.get.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const [hostname, setHostname] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState("");

  useEffect(() => {
    if (!data) return;
    const next = data.domain?.hostname || data.suggestions[0] || "";
    setHostname(next);
    setSelectedSuggestion(next);
  }, [data]);

  const claim = trpc.domains.claim.useMutation({
    onSuccess: async saved => {
      setHostname(saved?.hostname || hostname);
      setSelectedSuggestion(saved?.hostname || hostname);
      await utils.domains.get.invalidate({ projectId });
      toast.success("Domaine enregistré. Lakay préparera la connexion après publication web.");
    },
    onError: issue => toast.error(issue.message),
  });

  const candidate = useMemo(() => hostname.trim().toLowerCase(), [hostname]);
  if (isLoading) return <DashboardLayout><div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-5 animate-spin text-emerald-300" /></div></DashboardLayout>;
  if (error || !data) return <DashboardLayout><div className="mx-auto max-w-md py-28 text-center"><h1 className="text-xl font-semibold text-white">Ce projet n’est pas disponible.</h1><Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-xl">Retour aux projets</Button></div></DashboardLayout>;

  return <DashboardLayout><main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-10"><button onClick={() => navigate(`/projects/${projectId}`)} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-100"><ArrowLeft className="size-3.5" />Retour au projet</button><section className="mt-7 overflow-hidden rounded-[28px] border border-emerald-200/10 bg-[radial-gradient(circle_at_86%_0%,rgba(16,185,129,0.18),transparent_32%),linear-gradient(135deg,rgba(17,24,39,0.92),rgba(5,15,12,0.96))] p-6 sm:p-10"><div className="max-w-2xl"><Badge className="border border-emerald-300/15 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10"><Globe2 className="mr-1.5 size-3.5" />Domaine du projet</Badge><h1 className="mt-5 text-3xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">Lancez votre site avec votre propre nom.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-emerald-50/65 sm:text-base">Choisissez un nom, achetez-le directement chez Name.com, puis revenez ici pour le connecter à votre publication. Votre domaine et vos données d’enregistrement restent à votre nom.</p></div><div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><Sparkles className="size-4 text-emerald-200" /><p className="mt-3 text-sm font-medium text-white">1. Choisir</p><p className="mt-1 text-xs leading-5 text-zinc-400">Suggestions créatives, sans promesse de disponibilité.</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><ExternalLink className="size-4 text-emerald-200" /><p className="mt-3 text-sm font-medium text-white">2. Acheter</p><p className="mt-1 text-xs leading-5 text-zinc-400">Paiement et enregistrement sécurisés chez le registrar.</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><Link2 className="size-4 text-emerald-200" /><p className="mt-3 text-sm font-medium text-white">3. Connecter</p><p className="mt-1 text-xs leading-5 text-zinc-400">DNS et HTTPS après une publication web vérifiée.</p></div></div></section><section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-3xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-white">Choisissez une direction</h2><p className="mt-1 text-sm leading-6 text-zinc-500">La disponibilité et le prix final sont vérifiés uniquement sur Name.com.</p></div><Badge variant="outline" className="shrink-0 border-white/10 text-zinc-400">Name.com</Badge></div><div className="mt-5 grid gap-2">{data.suggestions.map(suggestion => <button key={suggestion} type="button" onClick={() => { setHostname(suggestion); setSelectedSuggestion(suggestion); }} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${selectedSuggestion === suggestion ? "border-emerald-300/40 bg-emerald-300/10" : "border-white/[0.08] bg-black/10 hover:border-white/20"}`}><span className="font-medium text-zinc-100">{suggestion}</span><span className="text-xs text-zinc-500">Vérifier →</span></button>)}</div><div className="mt-5"><label className="text-xs font-medium text-zinc-400">Ou entrez votre domaine</label><Input value={hostname} onChange={event => { setHostname(event.target.value); setSelectedSuggestion(""); }} placeholder="ex. monprojet.com" className="mt-2 h-12 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-zinc-600" /></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button asChild disabled={candidate.length < 3} className="h-11 flex-1 rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300"><a href={purchaseUrl(candidate)} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4" />Voir chez Name.com</a></Button><Button disabled={claim.isPending || candidate.length < 3} variant="outline" onClick={() => claim.mutate({ projectId, hostname: candidate })} className="h-11 rounded-xl border-white/10 bg-transparent text-zinc-100 hover:bg-white/5"><CheckCircle2 className="mr-2 size-4" />J’ai ce domaine</Button></div><p className="mt-4 text-xs leading-5 text-zinc-600">Lakay peut recevoir une commission partenaire après activation officielle de l’affiliation. Elle ne modifie ni votre prix, ni la propriété de votre domaine.</p></div><aside className="rounded-3xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-7"><ShieldCheck className="size-5 text-emerald-300" /><h2 className="mt-4 text-lg font-semibold text-white">Connexion protégée</h2>{data.domain ? <><p className="mt-2 text-sm leading-6 text-zinc-400"><span className="font-medium text-zinc-100">{data.domain.hostname}</span> est enregistré pour ce projet. L’étape suivante est la publication web vérifiée.</p><div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4"><p className="text-sm font-medium text-amber-100">En attente de publication</p><p className="mt-1 text-xs leading-5 text-amber-100/65">Nous ne montrons pas de fausses adresses DNS. Elles apparaîtront seulement quand l’application aura une destination web publique vérifiable.</p></div></> : <><p className="mt-2 text-sm leading-6 text-zinc-400">Après votre achat, saisissez le domaine exact et indiquez que vous en êtes propriétaire. Lakay conservera uniquement le nom du domaine associé à ce projet.</p><div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/15 p-4"><p className="text-xs leading-5 text-zinc-500">Lakay ne stocke jamais votre mot de passe registrar, votre carte bancaire, vos coordonnées de titulaire ni vos codes de transfert.</p></div></>}<div className="mt-6 border-t border-white/[0.07] pt-5"><p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600">Ce qui arrivera ensuite</p><ol className="mt-3 space-y-3 text-sm text-zinc-400"><li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-300/10 text-[10px] text-emerald-200">1</span>Publication web confirmée</li><li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-300/10 text-[10px] text-emerald-200">2</span>Instructions DNS exactes</li><li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-300/10 text-[10px] text-emerald-200">3</span>Vérification, HTTPS et statut Live</li></ol></div></aside></section></main></DashboardLayout>;
}
