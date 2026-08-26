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
  const responsiveFoundation = `:root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:clamp(14px,1.5vw,16px);-webkit-text-size-adjust:100%}*,:before,:after{box-sizing:border-box}html,body{width:100%;min-width:0;margin:0;overflow-x:hidden}body{min-height:100vh;line-height:1.5;overflow-wrap:anywhere}img,svg,video,canvas{display:block;max-width:100%;height:auto}button,input,select,textarea{max-width:100%;font:inherit}a{overflow-wrap:anywhere}nav,header,[role="navigation"]{max-width:100%;min-width:0;flex-wrap:wrap;align-items:center}nav *,header *,[role="navigation"] *{word-break:normal!important}nav a,nav button,header a,header button,[role="navigation"] a,[role="navigation"] button{white-space:nowrap!important;overflow-wrap:normal!important;word-break:normal!important}h1{font-size:clamp(1.7rem,6vw,3rem);line-height:1.08;letter-spacing:-.04em}h2{font-size:clamp(1.3rem,4vw,2.1rem);line-height:1.16;letter-spacing:-.028em}h3{font-size:clamp(1.05rem,2.6vw,1.3rem);line-height:1.25}p{max-width:70ch}@media(max-width:480px){nav,header,[role="navigation"]{height:auto!important;min-height:3.25rem;gap:.5rem!important}nav>* ,header>* ,[role="navigation"]>*{min-width:0!important;max-width:100%;flex-wrap:wrap!important}nav a,nav button,header a,header button,[role="navigation"] a,[role="navigation"] button{font-size:.78rem!important;padding:.45rem .55rem!important}nav [class*="brand"],nav [class*="logo"],header [class*="brand"],header [class*="logo"],[role="navigation"] [class*="brand"],[role="navigation"] [class*="logo"]{white-space:nowrap!important;overflow-wrap:normal!important;font-size:.84rem!important;line-height:1.1!important}h1{font-size:clamp(1.65rem,9.5vw,2.35rem)}h2{font-size:clamp(1.25rem,6.5vw,1.65rem)}section{min-width:0}}`;
  const safeCss = `${css}\n${responsiveFoundation}`.replace(/<\/style/gi, "<\\/style");
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  const security = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://unpkg.com https://cdn.tailwindcss.com; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts\">";
  const clientRuntime = `<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script><script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script><script src="https://cdn.tailwindcss.com"><\/script>`;
  const isolatedStorage = `<script>(function(){const entries=new Map();const storage={getItem:function(key){const value=entries.get(String(key));return value===undefined?null:value;},setItem:function(key,value){entries.set(String(key),String(value));},removeItem:function(key){entries.delete(String(key));},clear:function(){entries.clear();},key:function(index){return Array.from(entries.keys())[index]||null;}};Object.defineProperty(storage,'length',{get:function(){return entries.size;}});for(const name of ['localStorage','sessionStorage']){try{Object.defineProperty(window,name,{configurable:true,value:storage});}catch(_error){}}})();<\/script>`;
  const reporter = `<script>window.addEventListener('error',function(event){parent.postMessage({source:'lakay-preview',type:'runtime-error',message:String(event.message||'Unknown runtime error'),line:event.lineno||0},'*')});window.addEventListener('unhandledrejection',function(event){parent.postMessage({source:'lakay-preview',type:'runtime-error',message:String(event.reason&&event.reason.message||event.reason||'Unhandled promise rejection'),line:0},'*')});window.addEventListener('load',function(){requestAnimationFrame(function(){const root=document.getElementById('app')||document.body;parent.postMessage({source:'lakay-preview',type:'render-ready',meaningful:Boolean(root&&root.innerHTML.trim())},'*')})});<\/script>`;
  let document = html.replace(/<head([^>]*)>/i, `<head$1>${security}${clientRuntime}${isolatedStorage}${reporter}<style>${safeCss}</style>`);
  if (document === html) document = `${security}${clientRuntime}${isolatedStorage}${reporter}<style>${safeCss}</style>${html}`;
  const trustedRuntimeSources = new Set([
    "https://unpkg.com/react@18/umd/react.production.min.js",
    "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
    "https://unpkg.com/@babel/standalone/babel.min.js",
    "https://cdn.tailwindcss.com",
  ]);
  document = document.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/gi, (tag, _attributes, source) => trustedRuntimeSources.has(source) ? tag : "");
  return document.replace(/<\/body>/i, `<script>${safeJs}<\/script></body>`);
}
