import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function SetLocalPasswordPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/settings/password" });
  const { data, isLoading } = trpc.localAuth.credentialStatus.useQuery();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const setPasswordMutation = trpc.localAuth.setPasswordForCurrentUser.useMutation({
    onSuccess: () => { toast.success("Votre mot de passe Lakay est prêt. Vous pourrez maintenant vous connecter avec votre e-mail."); navigate("/settings"); },
  });
  const mismatch = confirmation.length > 0 && password !== confirmation;
  const canSave = password.length >= 10 && password === confirmation && !setPasswordMutation.isPending;

  return <DashboardLayout><main className="mx-auto max-w-lg px-4 py-8 sm:py-12"><button onClick={() => navigate("/settings")} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Retour aux paramètres</button><section className="mt-7 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"><div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="size-5" /></div><h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">Créer votre mot de passe Lakay</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Vous êtes connecté avec <span className="font-medium text-foreground">{user?.email || data?.email || "votre compte"}</span>. Créez un mot de passe pour pouvoir revenir directement avec votre e-mail, même sans passer par Manus.</p>{isLoading ? <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Vérification du compte…</div> : <form onSubmit={event => { event.preventDefault(); if (canSave) setPasswordMutation.mutate({ password }); }} className="mt-6 space-y-4"><div><label className="text-xs font-medium text-muted-foreground">Nouveau mot de passe</label><Input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="new-password" minLength={10} required className="mt-2 h-11 rounded-xl" /></div><div><label className="text-xs font-medium text-muted-foreground">Confirmer le mot de passe</label><Input value={confirmation} onChange={event => setConfirmation(event.target.value)} type="password" autoComplete="new-password" minLength={10} required className="mt-2 h-11 rounded-xl" />{mismatch && <p className="mt-2 text-xs text-rose-500">Les deux mots de passe ne correspondent pas.</p>}</div><div className="rounded-2xl bg-muted p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mb-2 size-4 text-primary" />Au moins 10 caractères. Lakay enregistre un hachage sécurisé, jamais votre mot de passe en clair.</div>{setPasswordMutation.error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{setPasswordMutation.error.message}</p>}<Button disabled={!canSave} type="submit" className="h-11 w-full rounded-xl">{setPasswordMutation.isPending ? "Enregistrement…" : data?.configured ? "Mettre à jour mon mot de passe" : "Créer mon mot de passe"}</Button></form>}</section></main></DashboardLayout>;
}
