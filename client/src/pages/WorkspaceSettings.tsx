import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Github, Globe2, Moon, Palette, PlugZap, Settings2, Sun, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import React from "react";

type Tab = "profile" | "preferences" | "integrations";
const tabs: { id: Tab; label: string; icon: typeof UserRound }[] = [
  { id: "profile", label: "Profil & Compte", icon: UserRound },
  { id: "preferences", label: "Préférences", icon: Palette },
  { id: "integrations", label: "Intégrations & Publication", icon: PlugZap },
];
const ADMINISTRATOR_EMAIL = "dormesgaetan16@gmail.com";

export function AppearanceThemeChoices({ theme, setTheme }: { theme: "light" | "dark"; setTheme?: (next: "light" | "dark") => void }) { return <div className="grid gap-3 sm:grid-cols-2"><button aria-pressed={theme === "dark"} onClick={() => setTheme?.("dark")} className={`rounded-xl border p-4 text-left ${theme === "dark" ? "border-primary bg-primary/10" : "border-border"}`}><Moon className="size-4 text-primary" /><p className="mt-3 font-medium">Sombre</p></button><button aria-pressed={theme === "light"} onClick={() => setTheme?.("light")} className={`rounded-xl border p-4 text-left ${theme === "light" ? "border-primary bg-primary/10" : "border-border"}`}><Sun className="size-4 text-amber-400" /><p className="mt-3 font-medium">Clair</p></button></div>; }

export default function WorkspaceSettings() {
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/settings" });
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>(() => new URLSearchParams(window.location.search).get("tab") === "billing" ? "profile" : (new URLSearchParams(window.location.search).get("tab") as Tab) || "profile");
  const [language, setLanguage] = useState("fr");
  const isAdministrator = user?.email?.toLowerCase() === ADMINISTRATOR_EMAIL;
  const visibleTabs = isAdministrator ? tabs : tabs.filter(item => item.id !== "integrations");
  useEffect(() => { if (!isAdministrator && tab === "integrations") setTab("profile"); }, [isAdministrator, tab]);
  return <DashboardLayout><div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9"><section className="border-b border-border pb-6"><div className="inline-flex items-center gap-2 text-xs font-medium text-primary"><Settings2 className="size-3.5" />Compte Lakay</div><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Paramètres</h1><p className="mt-2 text-sm text-muted-foreground">Gérez votre compte et vos préférences.</p></section><div className="mt-6 flex gap-2 overflow-x-auto pb-1">{visibleTabs.map(({ icon: Icon, ...item }) => <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm ${tab === item.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}><Icon className="size-4" />{item.label}</button>)}</div><main className="mt-5 space-y-4">{tab === "profile" && <Card icon={UserRound} title="Profil & Compte" detail="Vos informations de connexion."><div className="space-y-1"><p className="text-base font-semibold">{user?.name || "Membre Lakay"}</p><p className="text-sm text-muted-foreground">{user?.email}</p></div></Card>}{tab === "preferences" && <Card icon={Palette} title="Préférences" detail="Votre langue et votre apparence."><AppearanceThemeChoices theme={theme} setTheme={setTheme} /><div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-muted p-4"><div><p className="font-medium">Langue</p><p className="text-sm text-muted-foreground">Langue de l’interface</p></div><Select value={language} onValueChange={setLanguage}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fr">Français</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></div></Card>}{isAdministrator && tab === "integrations" && <Card icon={PlugZap} title="Intégrations & Publication" detail="Gérez les outils réservés à la publication Lakay."><Rows /></Card>}</main></div></DashboardLayout>;
}

function Rows() { const items = [{ Icon: Github, title: "GitHub", detail: "Le dépôt Lakay est relié au flux de publication Android." }, { Icon: PlugZap, title: "Supabase", detail: "Préparez votre base de données." }, { Icon: Globe2, title: "Domaine personnalisé", detail: "Utilisez votre propre adresse web." }]; return <div className="space-y-3">{items.map(({ Icon, title, detail }) => <div key={title} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted p-4"><div className="flex items-center gap-3"><Icon className="size-5 text-primary" /><div><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{detail}</p></div></div>{title === "GitHub" ? <Button variant="outline" onClick={() => window.open("https://github.com/negfutur/lakay/settings/secrets/actions", "_blank", "noopener,noreferrer")}>Gérer GitHub</Button> : <Button disabled variant="outline">Bientôt disponible</Button>}</div>)}</div>; }
function Card({ icon: Icon, title, detail, children }: { icon: typeof UserRound; title: string; detail: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex gap-3"><Icon className="mt-0.5 size-5 text-primary" /><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div></div><div className="mt-5">{children}</div></section>; }
