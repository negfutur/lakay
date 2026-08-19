import type { BuilderFile } from "../shared/builder";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function titleFromInstruction(instruction: string, projectName: string) {
  const cleaned = instruction.replace(/^(create|build|make|design)\s+(a|an|the)?\s*/i, "").replace(/[.!?]+$/g, "").trim();
  return (cleaned || projectName).slice(0, 72);
}

/**
 * Test-only static build fixture. It deliberately does not call an LLM, external API,
 * or the credit ledger; it exists solely to exercise the Lakay file/history/preview path.
 */
export function createMockWebsiteBuild(input: { projectName: string; instruction?: string }) {
  const instruction = input.instruction?.trim() || `Create a polished landing page for ${input.projectName}`;
  const title = titleFromInstruction(instruction, input.projectName);
  const escapedTitle = escapeHtml(title);
  const accent = /blue/i.test(instruction) ? "#2563eb" : "#8b5cf6";
  const files: BuilderFile[] = [
    { path: "index.html", language: "html", content: `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapedTitle}</title></head><body><main id="app"></main></body></html>` },
    { path: "styles.css", language: "css", content: `:root{--accent:${accent};--ink:#16121f;--muted:#6d647a;--surface:#fffaf7}*{box-sizing:border-box}body{margin:0;background:var(--surface);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.shell{max-width:1080px;margin:0 auto;padding:28px}.nav{display:flex;justify-content:space-between;align-items:center;font-size:14px}.brand{font-weight:800;letter-spacing:-.04em}.hero{padding:112px 0 78px;display:grid;gap:28px;max-width:760px}.eyebrow{color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.hero h1{font-size:clamp(44px,8vw,88px);line-height:.94;letter-spacing:-.075em;margin:0}.hero p{max-width:580px;color:var(--muted);font-size:18px;line-height:1.6;margin:0}.cta{display:inline-flex;width:max-content;border:0;border-radius:999px;background:var(--accent);color:white;padding:14px 20px;font-weight:700;cursor:pointer;box-shadow:0 14px 35px color-mix(in srgb,var(--accent),transparent 72%)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding-bottom:54px}.card{border:1px solid #e9e0ec;border-radius:18px;padding:22px;background:#fff}.card span{color:var(--accent);font-weight:800}@media(max-width:700px){.shell{padding:20px}.hero{padding:76px 0 48px}.grid{grid-template-columns:1fr}.hero h1{font-size:54px}}` },
    { path: "data.js", language: "javascript", content: `window.LakayData={title:${JSON.stringify(title)},prompt:${JSON.stringify(instruction)},features:["Fast start","Thoughtful details","Ready to share"]};` },
    { path: "state.js", language: "javascript", content: "window.LakayState={active:false};" },
    { path: "components.js", language: "javascript", content: "window.LakayComponents={card:function(item){return '<article class=\"card\"><span>0'+(window.LakayData.features.indexOf(item)+1)+'</span><h3>'+item+'</h3><p>A focused first-release detail, created in Lakay test mode.</p></article>'}};" },
    { path: "app.js", language: "javascript", content: "var d=window.LakayData;var root=document.getElementById('app');root.innerHTML='<div class=\"shell\"><nav class=\"nav\"><div class=\"brand\">'+d.title+'</div><small>Test-mode build</small></nav><section class=\"hero\"><div class=\"eyebrow\">Built in Lakay test mode</div><h1>'+d.title+'</h1><p>This is a real generated static project fixture. Edit files, save changes, restore versions, and refresh the sandbox without calling an external LLM.</p><button class=\"cta\" id=\"action\">Explore the idea</button></section><section class=\"grid\">'+d.features.map(window.LakayComponents.card).join('')+'</section></div>';document.getElementById('action').addEventListener('click',function(){window.LakayState.active=true;this.textContent='Preview interaction works';});" },
  ];
  return { files, summary: `Test-mode mock build created for “${title}”. No external LLM or Lakay AI credit was used.` };
}
