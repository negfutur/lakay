import { describe, expect, it } from "vitest";
import { makePreviewDocument } from "../lib/staticPreview";

const baseFiles = [
  { path: "index.html" as const, language: "html" as const, content: "<!doctype html><html><head></head><body><main id='app'>Original</main></body></html>" },
  { path: "styles.css" as const, language: "css" as const, content: "button { background: black; }" },
  { path: "data.js" as const, language: "javascript" as const, content: "window.LakayData = {};" },
  { path: "state.js" as const, language: "javascript" as const, content: "window.LakayState = {};" },
  { path: "components.js" as const, language: "javascript" as const, content: "window.render = () => {};" },
  { path: "app.js" as const, language: "javascript" as const, content: "window.render();" },
];

describe("Lakay sandbox preview refresh source", () => {
  it("creates a new isolated preview document when persisted generated files change", () => {
    const before = makePreviewDocument(baseFiles);
    const after = makePreviewDocument(baseFiles.map(file => file.path === "styles.css" ? { ...file, content: "button { background: blue; }" } : file));

    expect(before).toContain("background: black");
    expect(after).toContain("background: blue");
    expect(after).not.toBe(before);
    expect(after).toContain("Content-Security-Policy");
    expect(after).toContain("https://unpkg.com/react@18/umd/react.production.min.js");
    expect(after).toContain("https://unpkg.com/react-dom@18/umd/react-dom.production.min.js");
    expect(after).toContain("https://unpkg.com/@babel/standalone/babel.min.js");
    expect(after).toContain("https://cdn.tailwindcss.com");
    expect(after).toContain("connect-src 'none'");
    expect(after).toContain("sandbox allow-scripts");
    expect(after).toContain("Object.defineProperty(window,name,{configurable:true,value:storage})");
    expect(after).toContain("localStorage");
    expect(after).toContain("sessionStorage");
    expect(after).toContain("type:'render-ready'");
    expect(after).toContain("meaningful:Boolean(root&&root.innerHTML.trim())");
    expect(after).toContain("-webkit-text-size-adjust:100%");
    expect(after).toContain("overflow-x:hidden");
    expect(after).toContain("font-size:clamp(1.7rem,6vw,3rem)");
    expect(after).toContain('nav,header,[role="navigation"]{max-width:100%;min-width:0;flex-wrap:wrap;align-items:center}');
    expect(after).toContain('nav a,nav button,header a,header button,[role="navigation"] a,[role="navigation"] button{white-space:nowrap!important;overflow-wrap:normal!important;word-break:normal!important}');
    expect(after).toContain('nav>* ,header>* ,[role="navigation"]>*{min-width:0!important;max-width:100%;flex-wrap:wrap!important}');
  });

  it("keeps only the allowlisted in-memory runtime sources and strips generated external scripts", () => {
    const document = makePreviewDocument(baseFiles.map(file => file.path === "index.html" ? {
      ...file,
      content: "<!doctype html><html><head><script src='https://example.test/untrusted.js'></script></head><body><main id='app'>Safe</main></body></html>",
    } : file));

    expect(document).toContain("https://unpkg.com/react@18/umd/react.production.min.js");
    expect(document).not.toContain("https://example.test/untrusted.js");
    expect(document).toContain("connect-src 'none'");
  });
});
