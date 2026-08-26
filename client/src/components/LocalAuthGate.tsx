import { useState } from "react";
import { startLogin } from "@/const";
import { LakayMark } from "@/components/LakayMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export function LocalAuthGate() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const login = trpc.localAuth.login.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); window.location.assign("/dashboard"); } });
  const register = trpc.localAuth.register.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); window.location.assign("/dashboard"); } });
  const pending = login.isPending || register.isPending;
  const error = login.error?.message || register.error?.message;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "login") login.mutate({ email, password });
    else register.mutate({ email, password, name: name || undefined });
  };

  return <div className="grid min-h-screen place-items-center bg-[#0b0f11] p-5"><div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.035] p-7"><LakayMark className="justify-center" /><div className="mt-7 text-center"><h1 className="text-xl font-semibold text-white">{mode === "login" ? "Bienvenue sur Lakay" : "Créez votre espace Lakay"}</h1><p className="mt-2 text-sm leading-6 text-zinc-500">{mode === "login" ? "Connectez-vous pour retrouver vos projets." : "Commencez à créer vos applications avec l’IA."}</p></div><form onSubmit={submit} className="mt-6 space-y-3">{mode === "register" && <Input value={name} onChange={event => setName(event.target.value)} placeholder="Votre nom" autoComplete="name" className="border-white/10 bg-white/[0.05] text-white placeholder:text-zinc-600" />}<Input value={email} onChange={event => setEmail(event.target.value)} placeholder="Adresse e-mail" type="email" autoComplete="email" required className="border-white/10 bg-white/[0.05] text-white placeholder:text-zinc-600" /><Input value={password} onChange={event => setPassword(event.target.value)} placeholder="Mot de passe" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} required className="border-white/10 bg-white/[0.05] text-white placeholder:text-zinc-600" />{mode === "register" && <p className="text-xs text-zinc-500">Au moins 10 caractères.</p>}{error && <p role="alert" className="rounded-lg bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}<Button disabled={pending} type="submit" className="w-full rounded-xl bg-emerald-400 font-semibold text-emerald-950 hover:bg-emerald-300">{pending ? "Connexion…" : mode === "login" ? "Se connecter" : "Créer mon compte"}</Button></form><div className="my-5 flex items-center gap-3 text-xs text-zinc-600 before:h-px before:flex-1 before:bg-white/10 after:h-px after:flex-1 after:bg-white/10">ou</div><Button type="button" onClick={startLogin} variant="outline" className="w-full rounded-xl border-white/10 text-zinc-200 hover:bg-white/[0.06]">Continuer avec Manus</Button><button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setPassword(""); }} className="mt-5 w-full text-center text-sm text-emerald-300 hover:text-emerald-200">{mode === "login" ? "Créer un compte avec e-mail" : "J’ai déjà un compte"}</button></div></div>;
}
