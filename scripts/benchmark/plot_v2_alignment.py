"""Export review figures from retained measurements; no alternative scoring."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

root = Path("benchmark/v2/studies")
review = json.loads((root / "v2-alignment-review.json").read_text())
replay = json.loads((root / "v2-alignment-replay.json").read_text())
out = Path("docs/assets")
out.mkdir(exist_ok=True)
plt.rcParams.update({"font.size": 11, "axes.spines.top": False,
                     "axes.spines.right": False, "savefig.facecolor": "white"})

fig, (ax, bx) = plt.subplots(2, 1, figsize=(10, 8), gridspec_kw={"height_ratios": [1, 1.1]})
names = ["Headline", "Representative · 70%", "Capabilities · 15%", "Regression · 10%", "Music · 5%"]
current = [review["canonical"]["headline"]] + [r["score"] for r in review["canonical"]["strata"]]
bounds = [review["measurementUpperBound"]["headline"]] + [r["score"] for r in review["measurementUpperBound"]["strata"]]
ys = np.arange(len(names))
ax.barh(ys, current, color="#247c96", height=.54, label="Current compiler")
ax.scatter(bounds, ys, color="#a43d59", marker="|", s=280, linewidths=2.5, label="Optimistic measurement upper bound")
for y, value, bound in zip(ys, current, bounds):
    ax.text(value - 9, y, f"{value:.1f}", color="white", va="center", ha="right", fontsize=10)
    ax.text(bound + 6, y, f"{bound:.1f}", va="center", fontsize=10, color="#a43d59")
ax.set(yticks=ys, yticklabels=names, xlim=(0, 1040), xlabel="Unchanged V2 score")
ax.invert_yaxis()
ax.legend(loc="lower left", bbox_to_anchor=(0, 1.01), ncol=2, frameon=False, fontsize=10)
ax.set_title("Remaining points have different meanings", loc="left", pad=35, weight="bold")

selected = ["frontier_dense_recovery", "frontier_pickup_progression", "frontier_low_air_endurance", "regression_amplitude_mosaic"]
labels = ["Dense recovery", "Pickup progression", "Low-air endurance", "Amplitude regression"]
for i, (source, label) in enumerate(zip(selected, labels)):
    row = next(r for r in review["cases"] if r["sourceId"] == source)
    bx.plot([row["score"], row["measurementUpperBoundScore"]], [i, i], color="#b4c6cb", linewidth=5)
    bx.scatter(row["score"], i, color="#247c96", s=65, zorder=3)
    bx.scatter(row["measurementUpperBoundScore"], i, color="#a43d59", marker="|", s=260, linewidths=2.5)
    bx.text(row["score"] - 7, i - .17, f'{row["score"]:.1f}', ha="right", fontsize=10)
    bx.text(row["measurementUpperBoundScore"] + 7, i + .17, f'{row["measurementUpperBoundScore"]:.1f}', fontsize=10, color="#a43d59")
bx.set(yticks=range(4), yticklabels=labels, xlim=(580, 1020), ylim=(3.6, -.6), xlabel="Case score · current to optimistic bound")
bx.set_title("A low score need not imply much recoverable error", loc="left", weight="bold", pad=14)
fig.text(.03, .018, "Bounds retain unavoidable airtime error and assume all other errors vanish.\nThey ignore coupled physics and do not establish attainable scores.", fontsize=10, color="#444444")
fig.tight_layout(rect=(0, .07, 1, .98), h_pad=2.3)
fig.savefig(out / "v2-alignment-headroom.png", dpi=160)
plt.close(fig)

source = "open_hook"
trace = json.loads(Path(f"generated/benchmark-v2/review-2026-09/replays/{source}.trace.json").read_text())
row = next(r for r in replay["replays"] if r["sourceId"] == source)
tail = row["tail"]
frames = [f for f in trace["frames"] if 43 <= f["frame"] / 40 <= 58]
time = [f["frame"] / 40 for f in frames]
fig, (ax, bx) = plt.subplots(2, 1, figsize=(10, 5.4), sharex=True, gridspec_kw={"height_ratios": [2, 1]})
ax.plot(time, [f["speed"] for f in frames], color="#247c96", label="Replayed instantaneous speed")
target = 5.4 + 7.2 * tail["targets"]["speed"]
achieved = 5.4 + 7.2 * tail["achieved"]["speed"]
ax.hlines([target, achieved], tail["start"], tail["end"], colors=["#777777", "#a43d59"], linestyles=["dashed", "dotted"], label="Ending: target mean / achieved mean")
ax.set(ylabel="Speed · px/frame", title="Open Hook: authored ending receives no axis score")
ax.legend(frameon=False, fontsize=9, loc="upper left")
bx.step(time, [int(f["airborne"]) for f in frames], where="post", color="#247c96")
bx.set(yticks=[0, 1], yticklabels=["Contact", "Airborne"], xlabel="Time · seconds", ylim=(-.15, 1.2))
for axis in (ax, bx):
    axis.axvspan(tail["start"], tail["end"], color="#a43d59", alpha=.1)
    axis.axvline(tail["start"], color="#a43d59", linewidth=1)
    axis.set_xlim(43, 58)
ax.text(57.8, ax.get_ylim()[1] - .3, "Final beat → 7.025 seconds unscored", ha="right", color="#a43d59", fontsize=10)
fig.text(.03, .015, "The track remains valid. Shading marks the authored tail; survival and off-beat rules still apply.\nThis trace describes behavior, not a judgment of visual quality.", fontsize=10, color="#444444")
fig.tight_layout(rect=(0, .08, 1, 1))
fig.savefig(out / "v2-alignment-outro.png", dpi=160)
plt.close(fig)
print("Wrote two review figures to docs/assets")
