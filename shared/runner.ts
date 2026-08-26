export type RunnerExecutionMode = "static" | "full_stack_runner";
export type RunnerProfileStatus = "static_preview_ready" | "runner_required" | "runner_connected" | "build_queued" | "build_failed";

export type FullStackRunnerManifest = {
  version: "2026-08";
  runtime: "node20";
  projectKind: "web_application" | "mobile_application" | "full_stack_web_app";
  framework: "vite_react_express";
  entrypoints: { client: string; server: string; build: string; start: string };
  services: { api: true; database: "isolated_namespaced"; storage: "scoped" };
  isolation: { network: "deny_by_default"; secrets: "runner_scoped_only"; lifecycle: "ephemeral_job" };
  capabilities: { staticPreview: true; runnerRequired: true; autoFixStateMachine: true };
  scaffold: { files: RunnerScaffoldFile[] };
};

export type RunnerScaffoldFile = { path: string; language: "html" | "css" | "javascript" | "json" | "typescript" | "tsx" | "sql"; purpose: string; content: string };
export type FullStackSourceReference = { path: string; content: string };
export type MobileAppConfiguration = { appName: string; version: string; bundleId: string };
export type RunnerStatusEvent = { state: RunnerProfileStatus; message: string; occurredAt: string };

export function createRunnerStatusEvent(state: RunnerProfileStatus, message: string): RunnerStatusEvent {
  return { state, message, occurredAt: new Date().toISOString() };
}

export function createRunnerScaffold(projectName: string, projectDescription = "", sourceFiles: FullStackSourceReference[] = [], mobileConfiguration?: MobileAppConfiguration, target: "web" | "mobile" = "web", projectPlan?: ProjectPlan | null): RunnerScaffoldFile[] {
  const safeName = projectName.replace(/[<>]/g, "").slice(0, 120) || "Lakay application";
  const packageName = safeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "lakay-app";
  const mobileName = mobileConfiguration?.appName.trim() || safeName;
  const mobileVersion = mobileConfiguration?.version || "1.0.0";
  const mobileBundleId = mobileConfiguration?.bundleId || `com.lakay.${packageName.replace(/-/g, "")}`;
  const planSummary = projectPlan?.summary?.trim().slice(0, 600) || projectDescription.slice(0, 600) || "Une expérience mobile structurée autour de votre produit.";
  const planTagline = projectPlan?.tagline?.trim().slice(0, 160) || "Votre produit, prêt à être testé sur mobile.";
  const planFeatures = (projectPlan?.features || projectPlan?.components.map(component => component.name) || []).map(feature => feature.trim().slice(0, 100)).filter(Boolean).slice(0, 6);
  const mobileProduct = { name: mobileName, tagline: planTagline, summary: planSummary, features: planFeatures.length ? planFeatures : ["Parcours principal", "Données et états", "Expérience de test"] };
  const safeSources = sourceFiles.filter(file => SAFE_SCAFFOLD_PATH.test(file.path) && file.content.length <= 120_000).slice(0, 24);
  const apiContract = {
    version: "1.0",
    project: safeName,
    purpose: projectDescription.slice(0, 500),
    api: [
      { method: "GET", path: "/api/health", purpose: "Confirms that the generated application API is available." },
      { method: "GET", path: "/api/records", purpose: "Lists project-owned application records." },
      { method: "POST", path: "/api/records", purpose: "Creates a validated project-owned application record." },
    ],
    database: { namespace: "project_scoped", tables: [{ name: "records", columns: ["id", "title", "payload", "created_at"] }] },
    security: { authentication: "project_defined", secrets: "runner_scoped_only", network: "deny_by_default" },
  };
  return [
    { path: "package.json", language: "json", purpose: "Defines package-managed client, API, and database build scripts for the isolated project.", content: JSON.stringify({ name: packageName, private: true, type: "module", scripts: { dev: "concurrently \"vite\" \"tsx watch server/index.ts\"", build: "vite build && tsc -p server/tsconfig.json", start: "node dist/server/index.js", test: "vitest run", "db:generate": "drizzle-kit generate" }, dependencies: { express: "^4.21.2", mysql2: "^3.11.0", react: "^19.0.0", "react-dom": "^19.0.0" }, devDependencies: { "@vitejs/plugin-react": "^5.0.0", concurrently: "^9.0.0", "drizzle-kit": "^0.31.0", "drizzle-orm": "^0.44.0", tsx: "^4.0.0", typescript: "^5.0.0", vite: "^7.0.0", vitest: "^2.1.9" } }, null, 2) },
    { path: "lakay.project.json", language: "json", purpose: "Contains non-secret project metadata used by the isolated build and deployment workflow.", content: JSON.stringify({ name: safeName, description: projectDescription.slice(0, 2000), target, kind: target === "mobile" ? "mobile_application" : "web_application", generatedBy: "Lakay", secrets: "runner_scoped_only" }, null, 2) },
    { path: ".env.example", language: "typescript", purpose: "Lists non-secret environment variable names that the deployment environment must provide separately.", content: "# Copy to .env only in your deployment environment. Never commit real values.\nPORT=3000\nDATABASE_URL=mysql://USER:PASSWORD@HOST:3306/PROJECT_DATABASE\n" },
    { path: "DEPLOYMENT_CHECKLIST.md", language: "typescript", purpose: "Lists the safe handoff checks required before this isolated project is deployed.", content: `# ${target === "mobile" ? "Mobile" : "Web"} release readiness\n\n1. Install dependencies with \`pnpm install\`.\n2. Copy \`.env.example\` to your host-managed environment and provide a dedicated \`DATABASE_URL\`; never place secrets in \`client/\` or Vite variables.\n3. Generate and review the Drizzle migration before applying it to the project-scoped database.\n4. Run \`pnpm test\` and \`pnpm build\` inside a separate isolated environment.\n${target === "mobile" ? "5. Configure Expo identity, Android signing, EAS profiles, and a signed EAS webhook before requesting an APK or AAB.\n6. Install a verified test artifact on a physical device before Play Store submission." : "5. Start with \`pnpm start\`, then verify \`/api/health\` over HTTPS.\n6. Configure authentication, authorization, retention, monitoring, and a custom domain before public release."}\n\nThis export is source code, not a hosted service or compiled mobile artifact. Do not run unreviewed generated code on Lakay’s control-plane server.\n` },
    { path: "lakay.api-contract.json", language: "json", purpose: "Defines the project-specific API, database, and security contract for the isolated application build.", content: JSON.stringify(apiContract, null, 2) },
    { path: "lakay-source/source-files.json", language: "json", purpose: "Preserves the current browser application source as non-executable reference material for the isolated full-stack migration.", content: JSON.stringify(safeSources, null, 2) },
    { path: "client/index.html", language: "html", purpose: "Provides the browser document for the generated React client.", content: "<!doctype html><html><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/><title>Lakay app</title></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>" },
    { path: "client/src/main.tsx", language: "tsx", purpose: "Client entry point for the isolated web application.", content: `import { createRoot } from "react-dom/client";\nfunction App() { return <main style={{fontFamily:"system-ui",padding:32}}><h1>${safeName}</h1><p>Cette application full-stack est prête à recevoir son interface et ses données.</p></main>; }\ncreateRoot(document.getElementById("root")!).render(<App />);` },
    { path: "server/index.ts", language: "typescript", purpose: "Server entry point with runner-provided port, health endpoint, and API route boundary.", content: "import express from 'express';\nimport { appRouter } from './routes/app.js';\nconst app = express();\napp.use(express.json({ limit: '1mb' }));\napp.get('/api/health', (_req, res) => res.json({ ok: true }));\napp.use('/api', appRouter);\nconst port = Number(process.env.PORT || 3000);\napp.listen(port);" },
    { path: "server/routes/app.ts", language: "typescript", purpose: "Defines the generated API boundary for project-owned business routes.", content: "import { Router } from 'express';\nexport const appRouter = Router();\nappRouter.get('/app', (_req, res) => res.json({ status: 'ready' }));" },
    { path: "server/db.ts", language: "typescript", purpose: "Creates the project-scoped database connection from runner-injected DATABASE_URL only.", content: "export function requireDatabaseUrl() { const value = process.env.DATABASE_URL; if (!value) throw new Error('DATABASE_URL is required in the isolated project environment.'); return value; }" },
    { path: "server/tsconfig.json", language: "json", purpose: "Compiles isolated server code without exposing Lakay control-plane files.", content: JSON.stringify({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", outDir: "../dist/server", strict: true, esModuleInterop: true }, include: ["./**/*.ts"] }, null, 2) },
    { path: "drizzle/schema.ts", language: "typescript", purpose: "Contains the project-namespaced database schema for runner migration generation.", content: "import { mysqlTable, serial, text, timestamp } from 'drizzle-orm/mysql-core';\nexport const records = mysqlTable('records', { id: serial('id').primaryKey(), title: text('title').notNull(), createdAt: timestamp('created_at').defaultNow().notNull() });" },
    { path: "vite.config.ts", language: "typescript", purpose: "Builds the generated React client inside the isolated runner.", content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ root: 'client', plugins: [react()], build: { outDir: '../dist/client', emptyOutDir: true } });" },
    { path: "mobile/package.json", language: "json", purpose: "Defines the Expo React Native export target used by EAS Build.", content: JSON.stringify({ name: `${packageName}-mobile`, private: true, main: "expo/AppEntry", scripts: { start: "expo start", "eas:configure": "eas build:configure --non-interactive", "build:android": "eas build --platform android --profile preview --non-interactive" }, dependencies: { expo: "^54.0.0", react: "^19.0.0", "react-native": "^0.81.0", "expo-status-bar": "~3.0.0" }, devDependencies: { "eas-cli": "^16.0.0" } }, null, 2) },
    { path: "mobile/app.json", language: "json", purpose: "Contains generated Expo app identity, approved owner, Android package metadata, and Lakay target context for first-time EAS project initialization.", content: JSON.stringify({ expo: { owner: "zetwal", name: mobileName, slug: packageName, version: mobileVersion, orientation: "portrait", userInterfaceStyle: "automatic", android: { package: mobileBundleId }, extra: { lakay: { sourceTarget: target, publication: "eas" } } } }, null, 2) },
    { path: "mobile/eas.json", language: "json", purpose: "Defines EAS preview APK and production AAB build profiles for the generated Expo target.", content: JSON.stringify({ build: { preview: { android: { buildType: "apk" }, distribution: "internal" }, production: { android: { buildType: "app-bundle" } } } }, null, 2) },
    { path: "mobile/lakay.mobile-plan.json", language: "json", purpose: "Preserves the non-secret product plan used to shape the generated mobile starter.", content: JSON.stringify({ target, product: mobileProduct }, null, 2) },
    { path: "mobile/App.tsx", language: "tsx", purpose: "Provides a plan-informed React Native starter with touch-first feature states for the EAS-compatible mobile export target.", content: `import { StatusBar } from 'expo-status-bar';\nimport { useState } from 'react';\nimport { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';\nconst target = ${JSON.stringify(target)};\nconst product = ${JSON.stringify(mobileProduct, null, 2)} as const;\nexport default function App() { const [activeFeature, setActiveFeature] = useState(product.features[0]); return <SafeAreaView style={styles.screen}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.content}><View style={styles.eyebrow}><Text style={styles.eyebrowText}>{target === 'mobile' ? 'MOBILE APP' : 'WEB APP · MOBILE PACKAGE'}</Text></View><Text style={styles.title}>{product.name}</Text><Text style={styles.tagline}>{product.tagline}</Text><View style={styles.hero}><Text style={styles.sectionLabel}>APERÇU PRODUIT</Text><Text style={styles.summary}>{product.summary}</Text></View><View style={styles.section}><Text style={styles.sectionTitle}>Fonctions principales</Text>{product.features.map((feature, index) => <Pressable key={feature} onPress={() => setActiveFeature(feature)} style={[styles.feature, activeFeature === feature && styles.featureActive]}><View style={styles.featureIndex}><Text style={styles.featureIndexText}>{String(index + 1).padStart(2, '0')}</Text></View><Text style={styles.featureText}>{feature}</Text></Pressable>)}</View><View style={styles.focus}><Text style={styles.sectionLabel}>SÉLECTION ACTUELLE</Text><Text style={styles.focusText}>{activeFeature}</Text><Text style={styles.focusHint}>Cette interaction est incluse dans le starter Expo. Ajoutez les données et les flux métier dans l’environnement isolé avant publication.</Text></View></ScrollView></SafeAreaView>; }\nconst styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#081310' }, content: { padding: 24, paddingTop: 34, gap: 18 }, eyebrow: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#174f43' }, eyebrowText: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#d7fff3' }, title: { fontSize: 34, fontWeight: '800', letterSpacing: -1, color: '#f4fffb' }, tagline: { fontSize: 16, lineHeight: 24, color: '#b7cec7' }, hero: { gap: 8, borderRadius: 24, padding: 22, backgroundColor: '#eefbf5' }, sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#35866f' }, summary: { fontSize: 17, lineHeight: 25, color: '#12352a' }, section: { gap: 10, paddingTop: 4 }, sectionTitle: { fontSize: 18, fontWeight: '700', color: '#f4fffb' }, feature: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 15, backgroundColor: '#10251f' }, featureActive: { backgroundColor: '#1b6a55' }, featureIndex: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#e3fff4' }, featureIndexText: { fontSize: 11, fontWeight: '800', color: '#14483a' }, featureText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#f4fffb' }, focus: { gap: 8, borderRadius: 20, padding: 18, backgroundColor: '#10251f' }, focusText: { fontSize: 19, fontWeight: '700', color: '#f4fffb' }, focusHint: { fontSize: 14, lineHeight: 21, color: '#b7cec7' } });` },
    { path: "README.runner.md", language: "typescript", purpose: "Explains the isolated runner contract and deployment handoff.", content: "This blueprint runs only in a Lakay isolated project environment. Use runner-scoped secrets, project-namespaced database resources, deny-by-default network policy, and never copy Lakay control-plane credentials into generated files." },
  ];
}

export const FULL_STACK_RUNNER_MANIFEST: FullStackRunnerManifest = {
  version: "2026-08",
  runtime: "node20",
  projectKind: "web_application",
  framework: "vite_react_express",
  entrypoints: { client: "client/src/main.tsx", server: "server/index.ts", build: "pnpm build", start: "pnpm start" },
  services: { api: true, database: "isolated_namespaced", storage: "scoped" },
  isolation: { network: "deny_by_default", secrets: "runner_scoped_only", lifecycle: "ephemeral_job" },
  capabilities: { staticPreview: true, runnerRequired: true, autoFixStateMachine: true },
  scaffold: { files: createRunnerScaffold("Lakay application") },
};

const SAFE_SCAFFOLD_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?:\.env\.example|[A-Za-z0-9_./-]{1,180}\.(?:html|css|js|json|ts|tsx|sql|md))$/;

export function validateFullStackRunnerManifest(manifest: FullStackRunnerManifest): string[] {
  const issues: string[] = [];
  if (manifest.version !== "2026-08") issues.push("Unsupported runner contract version.");
  if (manifest.runtime !== "node20" || manifest.framework !== "vite_react_express" || !["web_application", "mobile_application", "full_stack_web_app"].includes(manifest.projectKind)) issues.push("Unsupported target-aware runtime contract.");
  if (manifest.isolation.network !== "deny_by_default" || manifest.isolation.secrets !== "runner_scoped_only" || manifest.isolation.lifecycle !== "ephemeral_job") issues.push("Runner isolation requirements are incomplete.");
  if (!manifest.capabilities.runnerRequired || !manifest.capabilities.autoFixStateMachine) issues.push("Runner capability safeguards are incomplete.");
  if (!manifest.scaffold.files.length) issues.push("Runner scaffold must contain project files.");
  const seen = new Set<string>();
  manifest.scaffold.files.forEach(file => {
    if (!SAFE_SCAFFOLD_PATH.test(file.path)) issues.push(`Unsafe runner scaffold path: ${file.path}`);
    if (seen.has(file.path)) issues.push(`Duplicate runner scaffold path: ${file.path}`);
    seen.add(file.path);
    if (!file.content.trim() || !file.purpose.trim()) issues.push(`Incomplete runner scaffold file: ${file.path}`);
  });
  return issues;
}

export function assertValidFullStackRunnerManifest(manifest: FullStackRunnerManifest): void {
  const issues = validateFullStackRunnerManifest(manifest);
  if (issues.length) throw new Error(`Invalid full-stack runner contract: ${issues.join(" ")}`);
}
import type { ProjectPlan } from "./project";
