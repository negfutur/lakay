import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = fs.readFileSync(path.resolve(process.cwd(), ".github/workflows/eas-build.yml"), "utf8");

describe("EAS first-project initialization workflow", () => {
  it("creates or links the generated Expo project under the configured owner before Android build dispatch", () => {
    const initialize = workflow.indexOf("eas init --account zetwal --non-interactive --json");
    const build = workflow.indexOf("eas build --platform android");

    expect(initialize).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(initialize);
  });
});
