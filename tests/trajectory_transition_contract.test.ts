import { describe, expect, it } from "vitest";
import type { AxisValues, Gap } from "../scripts/v0/types.ts";
import { transitionContractForGap, transitionContracts } from "../scripts/v0/trajectory/transition_contract.ts";

function gap(index: number, startFrame: number, endFrame: number, endsWithContact = true): Gap {
  return { index, startFrame, endFrame, endsWithContact, targets: {} };
}

describe("transition contract", () => {
  it("keeps incoming scoring axes, event impact, and outgoing axes distinct", () => {
    const current = gap(3, 80, 100);
    const next = gap(4, 100, 140);
    const targets: AxisValues[] = [
      {}, {}, {},
      { air: 0.2, speed: 0.7, impact: 0.6 },
      { air: 0.85, speed: 0.35, amplitude: 0.4 },
    ];
    const contract = transitionContractForGap(current, next, targets);

    expect(contract.incoming.axes).toEqual({ air: 0.2, speed: 0.7 });
    expect(contract.event).toEqual({ frame: 100, impact: 0.6 });
    expect(contract.outgoing?.axes).toEqual({ air: 0.85, speed: 0.35, amplitude: 0.4 });
    expect(contract.outgoing?.arrival).toEqual({ frame: 140, impact: null });
    expect(contract.incoming.intervalFrames).toBe(20);
    expect(contract.outgoing?.intervalFrames).toBe(40);
  });

  it("does not invent an event impact when no subsequent physical interval exists", () => {
    const current = gap(0, 0, 25);
    const contract = transitionContractForGap(current, undefined, [{ air: 0.4 }]);
    expect(contract.event.impact).toBeNull();
    expect(contract.outgoing).toBeNull();
  });

  it("rejects a non-contiguous outgoing interval", () => {
    const current = gap(0, 0, 25);
    expect(() => transitionContractForGap(current, gap(1, 26, 50), [{}, {}])).toThrow("contiguous outgoing");
    expect(transitionContractForGap(current, gap(1, 25, 50, false), [{}, {}]).outgoing?.endKind).toBe("tail");
  });

  it("constructs one contract per authored contact and retains a following tail", () => {
    const gaps = [gap(0, 0, 20), gap(1, 20, 50), gap(2, 50, 70, false)];
    const contracts = transitionContracts(gaps, [{ air: 0.1 }, { air: 0.8 }, { speed: 0.6 }]);
    expect(contracts).toHaveLength(2);
    expect(contracts[0]!.outgoing?.gapIndex).toBe(1);
    expect(contracts[1]!.outgoing?.endKind).toBe("tail");
  });

  it("keeps the next contact impact out of outgoing interval axes", () => {
    const current = gap(0, 0, 20);
    const next = gap(1, 20, 50);
    const contract = transitionContractForGap(current, next, [
      { air: 0.1, impact: 0.3 },
      { air: 0.8, speed: 0.6, impact: 0.9 },
    ]);
    expect(contract.outgoing?.axes).toEqual({ air: 0.8, speed: 0.6 });
    expect(contract.outgoing?.arrival).toEqual({ frame: 50, impact: 0.9 });
  });
});
