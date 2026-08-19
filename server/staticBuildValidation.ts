import type { BuilderFile, BuilderFilePath } from "../shared/builder";

export type StaticBuildValidation = {
  valid: boolean;
  issues: string[];
};

const REQUIRED_PATHS: BuilderFilePath[] = ["index.html", "styles.css", "app.js"];
const BLOCKED_HTML = /<(iframe|object|embed|base|meta\s+http-equiv\s*=\s*["']?refresh)/i;
const BLOCKED_NETWORK = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon)\b/i;
const BLOCKED_DYNAMIC_SCRIPT = /\b(import\s*\(|Worker\s*\(|SharedWorker\s*\()/i;
const BLOCKED_STYLESHEET = /@import\b|url\(\s*["']?https?:/i;

export function validateStaticBuild(files: BuilderFile[]): StaticBuildValidation {
  const issues: string[] = [];
  const filesByPath = new Map(files.map(file => [file.path, file]));
  const missing = REQUIRED_PATHS.filter(path => !filesByPath.has(path));
  if (missing.length) issues.push(`Required files are missing: ${missing.join(", ")}.`);

  const html = filesByPath.get("index.html")?.content ?? "";
  const css = filesByPath.get("styles.css")?.content ?? "";
  const js = (Object.keys(Object.fromEntries(filesByPath)) as BuilderFilePath[]).filter(path => path.endsWith(".js")).map(path => filesByPath.get(path)?.content ?? "").join("\n");
  if (html && !/<!doctype\s+html/i.test(html)) issues.push("index.html must be a complete HTML document with a doctype.");
  if (BLOCKED_HTML.test(html)) issues.push("HTML contains an unsupported embedded or redirecting element.");
  if (BLOCKED_NETWORK.test(`${html}\n${js}`)) issues.push("Network APIs are blocked in Lakay's isolated static preview.");
  if (BLOCKED_DYNAMIC_SCRIPT.test(js)) issues.push("Dynamic imports and worker processes are not supported in Lakay's static preview.");
  if (BLOCKED_STYLESHEET.test(css)) issues.push("Remote stylesheet imports are not supported in Lakay's isolated static preview.");

  return { valid: issues.length === 0, issues };
}

export function assertValidStaticBuild(files: BuilderFile[]): void {
  const validation = validateStaticBuild(files);
  if (!validation.valid) throw new Error(validation.issues.join(" "));
}
