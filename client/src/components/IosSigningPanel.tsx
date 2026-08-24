import { Download, Smartphone, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function IosSigningPanel() {
  const [teamId, setTeamId] = useState("");
  const [profile, setProfile] = useState("");
  const [mode, setMode] = useState<"xcode" | "store">("xcode");
  const inputClass = "mt-1.5 h-9 w-full rounded-lg border border-neutral-800 bg-[#101014] px-3 text-xs text-zinc-100 outline-none focus:border-emerald-300/60";

  return <div className="space-y-3">
    <section className="rounded-xl border border-neutral-800 bg-[#15151a] p-4">
      <p className="text-sm font-semibold text-zinc-100">Choisissez votre méthode de publication</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">Vous pouvez continuer sur votre Mac ou préparer les informations nécessaires à la publication Apple.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={() => setMode("xcode")} className={`rounded-xl border p-3 text-left transition-colors ${mode === "xcode" ? "border-emerald-300/45 bg-emerald-300/[0.07]" : "border-neutral-800 bg-[#101014] hover:bg-white/[0.03]"}`}><Download className="size-4 text-emerald-300" /><p className="mt-2 text-sm font-medium">Télécharger les sources Xcode</p><p className="mt-1 text-xs leading-5 text-zinc-500">Compilez et signez vous-même sur votre Mac.</p></button>
        <button onClick={() => setMode("store")} className={`rounded-xl border p-3 text-left transition-colors ${mode === "store" ? "border-emerald-300/45 bg-emerald-300/[0.07]" : "border-neutral-800 bg-[#101014] hover:bg-white/[0.03]"}`}><Smartphone className="size-4 text-sky-200" /><p className="mt-2 text-sm font-medium">TestFlight / App Store</p><p className="mt-1 text-xs leading-5 text-zinc-500">Préparez les informations de publication Apple.</p></button>
      </div>
    </section>
    {mode === "xcode" ? <section className="rounded-xl border border-neutral-800 bg-[#15151a] p-4"><p className="text-sm font-medium">Compilation sur Mac</p><p className="mt-1 text-xs leading-5 text-zinc-500">Téléchargez le code source, ouvrez-le dans Xcode puis utilisez votre compte Apple pour construire et distribuer l’application.</p><Button className="mt-3" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("lakay-download-source"))}><Download className="mr-1.5 size-3.5" />Télécharger les sources Xcode</Button></section> : <section className="rounded-xl border border-neutral-800 bg-[#15151a] p-4"><p className="text-sm font-medium">Informations pour TestFlight / App Store</p><p className="mt-1 text-xs leading-5 text-zinc-500">Ajoutez les références de votre compte Apple. Elles seront utilisées lorsque la publication Apple sera activée pour votre application.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-zinc-300">Apple Team ID<input value={teamId} onChange={event => setTeamId(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder="ABCDE12345" className={inputClass} /></label><label className="text-xs text-zinc-300">Profil de publication<input value={profile} onChange={event => setProfile(event.target.value.slice(0, 120))} placeholder="App Store Production" className={inputClass} /></label></div><p className="mt-3 rounded-lg bg-sky-300/[0.06] px-3 py-2 text-xs leading-5 text-sky-100">Vous pourrez finaliser la publication TestFlight ou App Store dès que votre compte Apple sera connecté.</p><Button className="mt-3" disabled><Upload className="mr-1.5 size-3.5" />Préparer la publication Apple</Button></section>}
  </div>;
}
