import type { Express } from "express";
import { makePreviewDocument } from "../client/src/lib/staticPreview";
import { getSharedPreviewFiles } from "./db";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,96}$/;

export function registerSharedPreview(app: Express) {
  app.get("/preview/:token", async (req, res) => {
    const token = req.params.token;
    if (!TOKEN_PATTERN.test(token)) return res.status(404).type("text/plain").send("Preview not found");
    try {
      const files = await getSharedPreviewFiles(token);
      if (!files?.length) return res.status(404).type("text/plain").send("Preview not found or expired");
      res.set({
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      });
      return res.type("html").send(makePreviewDocument(files));
    } catch (error) {
      console.error("[SharedPreview] Failed to load preview", { message: error instanceof Error ? error.message : String(error) });
      return res.status(404).type("text/plain").send("Preview not found");
    }
  });
}
