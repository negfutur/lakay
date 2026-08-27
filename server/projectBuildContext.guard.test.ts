import { describe, expect, it } from "vitest";
import { createBuildProjectContext, createOperationalProjectContext } from "./projectBuildContext";

describe("Lakay incremental build context", () => {
  it("makes the senior incremental execution policy available to every follow-up build", () => {
    const context = createBuildProjectContext([{ path: "app.js", language: "javascript", content: "document.addEventListener('click', () => {})" }] as never);
    expect(context.executionPolicy).toContain("preserve working workflows");
    expect(context.executionPolicy).toContain("Never restart from a blank template");
  });

  it("derives real, planned, in-progress, failed, and verified state from persisted project evidence without inventing integrations", () => {
    const context = createOperationalProjectContext({
      project: { id: "project-context", userId: 1, name: "Réservation", description: "Réserver simplement", target: "web", generatedPlan: { summary: "Réserver une chambre", features: ["Disponibilités", "Confirmation"], techStack: [{ name: "HTML", reason: "Aperçu" }] }, createdAt: new Date(), updatedAt: new Date() } as never,
      files: [
        { path: "index.html", language: "html", content: "<!doctype html><link rel=\"stylesheet\" href=\"styles.css\"><script src=\"app.js\"></script>" },
        { path: "styles.css", language: "css", content: ":root { --brand: #000; }" },
        { path: "app.js", language: "javascript", content: "document.addEventListener('click', () => {})" },
      ] as never,
      versions: [{ origin: "generate", summary: "Version de réservation", instruction: "Créer une réservation", createdAt: new Date() }] as never,
      history: [{ role: "user", content: "Ajoute une confirmation" }],
      backgroundTasks: [{ id: "failed", status: "failed", errorMessage: "Réponse de génération invalide", updatedAt: new Date() }],
      decisions: [{ id: "decision", type: "confirm", impact: "high", status: "awaiting_confirmation", summary: "Publier", updatedAt: new Date() }],
      validation: { valid: true, issues: [] },
      execution: null,
    });

    expect(context).toMatchObject({ project_id: "project-context", project_type: "web", objective: "Réserver une chambre" });
    expect(context.current_state.real.join(" ")).toContain("3 fichiers enregistrés");
    expect(context.current_state.planned).toContain("Disponibilités");
    expect(context.current_state.failed.join(" ")).toContain("Réponse de génération invalide");
    expect(context.current_state.verified).toContain("La structure des fichiers de l’aperçu statique est valide.");
    expect(context.integrations.join(" ")).toContain("Aucune intégration externe vérifiée");
    expect(context.pending_tasks.join(" ")).toContain("Confirmation requise");
  });
});
