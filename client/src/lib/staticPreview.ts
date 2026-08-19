import type { BuilderFile } from "@shared/builder";

export function makePreviewDocument(files: BuilderFile[]) {
  const html = files.find(file => file.path === "index.html")?.content || "<main><h1>Waiting for your first build</h1></main>";
  const css = files.filter(file => file.path.endsWith(".css")).sort((left, right) => left.path === "styles.css" ? -1 : right.path === "styles.css" ? 1 : left.path.localeCompare(right.path)).map(file => file.content).join("\n");
  const scriptPriority = ["data.js", "state.js", "components.js", "app.js"];
  const js = files.filter(file => file.path.endsWith(".js")).sort((left, right) => {
    const leftOrder = scriptPriority.indexOf(left.path);
    const rightOrder = scriptPriority.indexOf(right.path);
    const normalizedLeft = leftOrder < 0 ? scriptPriority.length - 1 : leftOrder;
    const normalizedRight = rightOrder < 0 ? scriptPriority.length - 1 : rightOrder;
    return normalizedLeft === normalizedRight ? left.path.localeCompare(right.path) : normalizedLeft - normalizedRight;
  }).map(file => file.content).join("\n");
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  const security = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:\">";
  const reporter = `<script>window.addEventListener('error',function(event){parent.postMessage({source:'lakay-preview',type:'runtime-error',message:String(event.message||'Unknown runtime error'),line:event.lineno||0},'*')});window.addEventListener('unhandledrejection',function(event){parent.postMessage({source:'lakay-preview',type:'runtime-error',message:String(event.reason&&event.reason.message||event.reason||'Unhandled promise rejection'),line:0},'*')});<\/script>`;
  let document = html.replace(/<head([^>]*)>/i, `<head$1>${security}${reporter}<style>${safeCss}</style>`);
  if (document === html) document = `${security}${reporter}<style>${safeCss}</style>${html}`;
  document = document.replace(/<script[^>]*src=["'][^"']+\.js[^"']*["'][^>]*><\/script>/gi, "");
  return document.replace(/<\/body>/i, `<script>${safeJs}<\/script></body>`);
}
