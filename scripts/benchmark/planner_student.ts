export type PlannerTree = { left: number[]; right: number[]; feature: number[]; threshold: number[];
  value: number[]; leaf: boolean[] };
export type PlannerModel = { schema: "line.physical-planner-model.v1"; featureVersion: number;
  inputDtype: "float32"; features: number; penalty: number;
  validity: { initial: number; link: string; trees: PlannerTree[] };
  loss: { initial: number; link: string; trees: PlannerTree[] } };

/** Predict proposal priority only. Admission and the finished track always use
 * the exact engine and the unchanged scorer. Float32 matches training input. */
export function predictPlannerCandidate(model: PlannerModel, features: readonly number[]): {
  validity: number; loss: number; priority: number;
} {
  if (features.length !== model.features || features.some(x => !Number.isFinite(x))) throw new Error("invalid planner model features");
  const x = features.map(Math.fround);
  const raw = (head: PlannerModel["validity"]) => {
    let sum = head.initial;
    for (const tree of head.trees) {
      let node = 0;
      while (!tree.leaf[node]) node = x[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
      sum += tree.value[node];
    }
    return sum;
  };
  const logit = raw(model.validity), validity = logit >= 0 ? 1 / (1 + Math.exp(-logit)) : Math.exp(logit) / (1 + Math.exp(logit));
  const loss = raw(model.loss);
  return { validity, loss, priority: loss + model.penalty * (1 - validity) };
}
