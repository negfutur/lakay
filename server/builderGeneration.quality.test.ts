import { describe, expect, it } from "vitest";
import { assertFirstVersionQuality } from "./builderGeneration";

const highQualityFiles = [
  { path: "index.html" as const, language: "html" as const, content: "<!doctype html><html><head><link rel='stylesheet' href='styles.css'></head><body><main id='app'></main><script src='data.js'></script><script src='state.js'></script><script src='components.js'></script><script src='app.js'></script></body></html>" },
  { path: "styles.css" as const, language: "css" as const, content: ".card{padding:1rem}@media (max-width: 640px){.card{padding:.75rem}}" },
  { path: "data.js" as const, language: "javascript" as const, content: "window.LakayData=[{title:'Une idée'}];" },
  { path: "state.js" as const, language: "javascript" as const, content: "window.LakayState={items:[]};" },
  { path: "components.js" as const, language: "javascript" as const, content: "window.renderCard=(item)=>`<button>${item.title}</button>`;" },
  { path: "app.js" as const, language: "javascript" as const, content: "const app=document.querySelector('#app'); app.innerHTML='<button id=\"add\">Ajouter</button>'; document.querySelector('#add').addEventListener('click',()=>app.appendChild(document.createElement('p')));" },
];

describe("Lakay first-version build quality", () => {
  it("accepts a mobile-responsive application with a wired interactive journey", () => {
    expect(() => assertFirstVersionQuality(highQualityFiles)).not.toThrow();
  });

  it("rejects a non-interactive static shell before it reaches the Builder", () => {
    const nonInteractive = highQualityFiles.map(file => file.path === "app.js" ? { ...file, content: "document.querySelector('#app').innerHTML = '<p>Bienvenue</p>';" } : file);
    expect(() => assertFirstVersionQuality(nonInteractive)).toThrow("working user interaction");
  });
});
