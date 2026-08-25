import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/eas-build.yml"), "utf8");

describe("Lakay GitHub Actions EAS workflow", () => {
  it("is manually dispatched, uses the repository-scoped Expo secret, and triggers a non-interactive Android build", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}");
    expect(workflow).toContain("expo/expo-github-action@v8");
    expect(workflow).toContain("eas build --platform android --profile");
    expect(workflow).toContain("job_id:");
    expect(workflow).toContain('Lakay job ${{ inputs.job_id }}');
    expect(workflow).toContain("--non-interactive --no-wait");
  });

  it("does not accept Expo credentials as a workflow input", () => {
    expect(workflow).not.toContain("expo_token:");
    expect(workflow).toContain("The EXPO_TOKEN repository secret is required.");
  });
});
