export const BACKGROUND_TASK_STATES = ["queued", "in_progress", "requires_action", "completed", "failed", "cancelled"] as const;

export type BackgroundTaskState = typeof BACKGROUND_TASK_STATES[number];

export const ACTIVE_BACKGROUND_TASK_STATES: BackgroundTaskState[] = ["queued", "in_progress", "requires_action"];

export function isTerminalBackgroundTaskState(state: BackgroundTaskState) {
  return state === "completed" || state === "failed" || state === "cancelled";
}

export function backgroundTaskProgress(state: BackgroundTaskState) {
  switch (state) {
    case "queued":
      return "Tâche en file d’attente…";
    case "in_progress":
      return "Lakay analyse et construit votre modification…";
    case "requires_action":
      return "Lakay attend une information ou une décision pour continuer.";
    case "completed":
      return "Modification terminée et résultat enregistré.";
    case "cancelled":
      return "Tâche annulée. Votre dernière version reste disponible.";
    case "failed":
      return "La tâche n’a pas pu être terminée. Votre dernière version reste disponible.";
  }
}
