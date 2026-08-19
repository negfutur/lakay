import type { ProjectComponent, ProjectPlan, ProjectTech } from "../shared/project";

type UnknownRecord = Record<string, unknown>;

const fallbackPlan: ProjectPlan = {
  name: "Untitled project",
  tagline: "A focused product concept, ready to shape.",
  summary: "A product plan ready for refinement in Lakay.",
  goals: ["Clarify the user outcome", "Build the smallest valuable release"],
  features: ["Clear onboarding", "Focused core workflow"],
  techStack: [
    { category: "Frontend", name: "React", reason: "Fast, polished application interfaces" },
    { category: "Backend", name: "TypeScript API", reason: "Reliable product logic and integrations" },
  ],
  components: [
    { name: "Application shell", purpose: "Navigation, structure, and responsive layout" },
    { name: "Core workspace", purpose: "The primary user task and project value" },
  ],
  milestones: ["Define the core workflow", "Build and validate the first release"],
};

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function stringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const result = value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 10);
  return result.length > 0 ? result : fallback;
}

function techList(value: unknown): ProjectTech[] {
  if (!Array.isArray(value)) return fallbackPlan.techStack;
  const result = value
    .map(item => asRecord(item))
    .map(item => ({
      category: text(item.category, "Foundation"),
      name: text(item.name, "Recommended tool"),
      reason: text(item.reason, "Supports the product's core workflow"),
    }))
    .slice(0, 8);
  return result.length > 0 ? result : fallbackPlan.techStack;
}

function componentList(value: unknown): ProjectComponent[] {
  if (!Array.isArray(value)) return fallbackPlan.components;
  const result = value
    .map(item => asRecord(item))
    .map(item => ({
      name: text(item.name, "Product component"),
      purpose: text(item.purpose, "Delivers a core part of the user experience"),
    }))
    .slice(0, 10);
  return result.length > 0 ? result : fallbackPlan.components;
}

export function normalizeProjectPlan(value: unknown): ProjectPlan {
  const plan = asRecord(value);
  return {
    name: text(plan.name, fallbackPlan.name),
    tagline: text(plan.tagline, fallbackPlan.tagline),
    summary: text(plan.summary, fallbackPlan.summary),
    goals: stringList(plan.goals, fallbackPlan.goals),
    features: stringList(plan.features, fallbackPlan.features),
    techStack: techList(plan.techStack),
    components: componentList(plan.components),
    milestones: stringList(plan.milestones, fallbackPlan.milestones),
  };
}

export function projectBelongsToUser(projectUserId: number, requestUserId: number): boolean {
  return projectUserId === requestUserId;
}
