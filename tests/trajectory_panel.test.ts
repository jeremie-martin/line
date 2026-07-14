import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import {
  TRAJECTORY_PANEL_CASES,
  TRAJECTORY_CALIBRATION_PROTOCOL,
  activeTrajectoryPanelCases,
  assertActiveTrajectoryPanel,
  assertCalibrationTrajectoryPanel,
  assertTrajectoryCalibrationProtocol,
  buildTrajectoryPanelSetup,
  getTrajectoryPanelCase,
  materializeTrajectoryPanelInput,
} from "../scripts/v0/trajectory/panel.ts";
import { assertFixturePanelDeclaration } from "../scripts/v0/trajectory/study_context.ts";

describe("trajectory study panel", () => {
  test("declares one explicit comparable calibration protocol", () => {
    expect(TRAJECTORY_CALIBRATION_PROTOCOL).toEqual({
      engine: "wasm",
      captureBudget: 500_000,
      relevantEnvironment: { LR_ENGINE: "wasm" },
    });
  });

  test("rejects engine or budget drift under the calibration label", () => {
    expect(() => assertTrajectoryCalibrationProtocol({
      engine: "js", captureBudget: 500_000, relevantEnvironment: { LR_ENGINE: "js" },
    }, "test"))
      .toThrow(/LR_ENGINE=wasm/);
    expect(() => assertTrajectoryCalibrationProtocol({
      engine: "wasm", captureBudget: 250_000, relevantEnvironment: { LR_ENGINE: "wasm" },
    }, "test"))
      .toThrow(/capture budget 500000/);
    expect(() => assertTrajectoryCalibrationProtocol({
      engine: "wasm", captureBudget: 500_000, relevantEnvironment: { LR_ENGINE: "wasm", LR_TEST: "1" },
    }, "test")).toThrow(/canonical LR environment/);
    expect(() => assertTrajectoryCalibrationProtocol({
      engine: "wasm", captureBudget: 500_000, relevantEnvironment: { LR_ENGINE: "wasm" },
    }, "test")).not.toThrow();
  });

  test("keeps validation empty until an independently captured roster is declared", () => {
    expect(activeTrajectoryPanelCases("validation")).toEqual([]);
    expect(Object.values(TRAJECTORY_PANEL_CASES).some((panel) => panel.cohort === "validation")).toBe(false);
    expect(() => getTrajectoryPanelCase("validation_v3_dense_dialogue")).toThrow(/unknown trajectory panel/);
  });

  test("makes quarantined rows audit-only and keeps the envelope study calibration-only", () => {
    const calibration = TRAJECTORY_PANEL_CASES.dense;
    const quarantined = TRAJECTORY_PANEL_CASES.validation_dense_dialogue;

    expect(() => assertActiveTrajectoryPanel(calibration, "test")).not.toThrow();
    expect(() => assertCalibrationTrajectoryPanel(calibration, "test")).not.toThrow();
    expect(() => assertActiveTrajectoryPanel(quarantined, "test")).toThrow(/quarantined trajectory panel/);
    expect(() => assertCalibrationTrajectoryPanel(quarantined, "test")).toThrow(/requires a calibration trajectory fixture/);
    expect(() => assertCalibrationTrajectoryPanel({ id: "future-validation", cohort: "validation" }, "test"))
      .toThrow(/requires a calibration trajectory fixture/);
  });

  test("capture CLI fails before runtime setup for an empty or quarantined cohort request", () => {
    const run = (args: string[]) => spawnSync(process.execPath, [
      "--import", "tsx", "scripts/v0/capture_trajectory_fixture.ts", ...args,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, LR_ENGINE: "js" },
    });
    const emptyValidation = run(["--case=all", "--cohort=validation"]);
    const quarantined = run(["--case=validation_dense_dialogue", "--cohort=validation"]);

    expect(emptyValidation.error).toBeUndefined();
    expect(emptyValidation.status).toBe(1);
    expect(`${emptyValidation.stdout}\n${emptyValidation.stderr}`).toContain("no active validation trajectory panels");
    expect(quarantined.error).toBeUndefined();
    expect(quarantined.status).toBe(1);
    expect(`${quarantined.stdout}\n${quarantined.stderr}`).toContain("cannot use quarantined trajectory panel");
  }, 15_000);

  test("declares exact contact-bounded transitions without fallback selection", () => {
    for (const panel of Object.values(TRAJECTORY_PANEL_CASES)) {
      const setup = buildTrajectoryPanelSetup(panel);
      const current = setup.gaps[panel.targetGap];
      const outgoing = setup.gaps[panel.targetGap + 1];
      expect(current, `${panel.id} current gap`).toBeDefined();
      expect(outgoing, `${panel.id} outgoing gap`).toBeDefined();
      expect(current!.endsWithContact, `${panel.id} current contact`).toBe(true);
      expect(outgoing!.endsWithContact, `${panel.id} outgoing contact`).toBe(true);
      expect(outgoing!.startFrame, `${panel.id} interval ownership`).toBe(current!.endFrame);
      if (panel.expectedOutgoingFrames !== undefined) {
        expect(outgoing!.endFrame - outgoing!.startFrame, `${panel.id} duration`).toBe(
          panel.expectedOutgoingFrames,
        );
      }
    }
  });

  test("materializes targets deterministically from each declared source and seed", () => {
    for (const panel of Object.values(TRAJECTORY_PANEL_CASES)) {
      const first = materializeTrajectoryPanelInput(buildTrajectoryPanelSetup(panel));
      const second = materializeTrajectoryPanelInput(buildTrajectoryPanelSetup(panel));
      expect(second).toEqual(first);
    }
  });

  test("binds a frozen fixture to its declared seed and target rather than fixture-selected values", () => {
    const panel = TRAJECTORY_PANEL_CASES.dense;
    const declaration = {
      id: panel.id,
      cohort: panel.cohort,
      category: panel.category,
      sourcePath: panel.sourcePath,
      sourceFingerprint: "a".repeat(64),
      publicSeed: panel.seed,
      requestedTargetGap: panel.targetGap,
      selectionRationale: panel.selectionRationale,
      selectedTargetGap: panel.targetGap,
      outgoingGap: panel.targetGap + 1,
      currentFrame: 1,
      outgoingFrame: 2,
      outgoingIntervalFrames: 1,
      expectedOutgoingFrames: panel.expectedOutgoingFrames ?? null,
    } as Parameters<typeof assertFixturePanelDeclaration>[0];
    expect(() => assertFixturePanelDeclaration(declaration, panel)).not.toThrow();
    expect(() => assertFixturePanelDeclaration({ ...declaration, publicSeed: panel.seed + 1 }, panel))
      .toThrow(/selection declaration/);
    expect(() => assertFixturePanelDeclaration({ ...declaration, requestedTargetGap: panel.targetGap + 1 }, panel))
      .toThrow(/selection declaration/);
    expect(() => assertFixturePanelDeclaration({ ...declaration, selectedTargetGap: panel.targetGap + 1 }, panel))
      .toThrow(/selection declaration/);
    expect(() => assertFixturePanelDeclaration({ ...declaration, outgoingGap: panel.targetGap + 2 }, panel))
      .toThrow(/selection declaration/);
  });
});
