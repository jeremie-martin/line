#!/usr/bin/env Rscript
# Analysis + plots for the dead-end-policy budget-curve sweep.
#
# Inputs  (produced by extract.mjs, same directory):
#   budget.csv       variant, budget, suite_score, passed, total, contract_pass_rate
#   long.csv         variant, spec, seed, budget, score, valid, axis_quality, sim_frames, ...
#   spec_budget.csv  variant, budget, spec, score, passed, total
#   summary.csv      variant headline metadata
#
# Outputs (written to ./plots/ and ./tables/):
#   plots/*.png  + plots/all.pdf
#   tables/*.csv  (AUC, paired deltas, per-budget winners)
#
# Run:  Rscript analysis.R     (from this directory)

suppressPackageStartupMessages({
  library(ggplot2)
  library(dplyr)
  library(tidyr)
})
read_csv <- function(p, ...) read.csv(p, stringsAsFactors = FALSE)
write_csv <- function(x, p) write.csv(x, p, row.names = FALSE)

HERE <- tryCatch(dirname(sys.frame(1)$ofile), error = function(e) ".")
if (is.null(HERE) || is.na(HERE) || HERE == "") HERE <- "."
setwd(HERE)
dir.create("plots", showWarnings = FALSE)
dir.create("tables", showWarnings = FALSE)

# ── Variant ordering / colours ────────────────────────────────────────────────
VARIANT_LEVELS <- c("base", "backjump", "bestjump_w1", "bestjump_w2")
VARIANT_LABELS <- c(
  base = "baseline (DFS)",
  backjump = "backjump (->uncle)",
  bestjump_w1 = "bestjump w=1 (sib u uncle)",
  bestjump_w2 = "bestjump w=2 (+great-uncle)"
)
PALETTE <- c(base = "#444444", backjump = "#1b9e77",
             bestjump_w1 = "#d95f02", bestjump_w2 = "#7570b3")

fct <- function(x) factor(x, levels = VARIANT_LEVELS)
kbudget <- function(b) b / 1000

budget      <- read_csv("budget.csv")      |> mutate(variant = fct(variant))
long        <- read_csv("long.csv")        |> mutate(variant = fct(variant))
spec_budget <- read_csv("spec_budget.csv") |> mutate(variant = fct(variant))
summary_tbl <- read_csv("summary.csv")

theme_set(theme_bw(base_size = 12))
col_scale  <- scale_colour_manual(values = PALETTE, labels = VARIANT_LABELS, name = "policy")
fill_scale <- scale_fill_manual(values = PALETTE, labels = VARIANT_LABELS, name = "policy")

save_png <- function(p, name, w = 9, h = 6) {
  ggsave(file.path("plots", paste0(name, ".png")), p, width = w, height = h, dpi = 130)
  invisible(p)
}

plots <- list()

# ── P1: suite score vs budget ─────────────────────────────────────────────────
p1 <- ggplot(budget, aes(kbudget(budget), suite_score, colour = variant)) +
  geom_line(linewidth = 0.9) + geom_point(size = 1.6) + col_scale +
  labs(title = "Suite score vs budget (honest-repair env)",
       subtitle = "weighted suite score per budget; higher is better",
       x = "budget (k sim-frames)", y = "suite score")
plots$score_curve <- save_png(p1, "01_score_curve")

# ── P2: delta vs baseline ─────────────────────────────────────────────────────
base_budget <- budget |> filter(variant == "base") |> select(budget, base = suite_score)
delta_budget <- budget |> filter(variant != "base") |>
  left_join(base_budget, by = "budget") |>
  mutate(delta = suite_score - base)
p2 <- ggplot(delta_budget, aes(kbudget(budget), delta, colour = variant)) +
  geom_hline(yintercept = 0, linetype = 2, colour = "grey50") +
  geom_line(linewidth = 0.9) + geom_point(size = 1.6) + col_scale +
  labs(title = "Suite-score delta vs baseline DFS",
       subtitle = "above zero = the dead-end policy beats plain DFS at that budget",
       x = "budget (k sim-frames)", y = "delta suite score (variant - base)")
plots$delta_curve <- save_png(p2, "02_delta_vs_base")

# ── P3: validity (contract pass rate) vs budget ───────────────────────────────
p3 <- ggplot(budget, aes(kbudget(budget), 100 * contract_pass_rate, colour = variant)) +
  geom_line(linewidth = 0.9) + geom_point(size = 1.6) + col_scale +
  labs(title = "Validity vs budget", x = "budget (k sim-frames)",
       y = "contract pass rate (%)")
plots$validity <- save_png(p3, "03_validity")

# ── P4: per-spec score curves (facet) ─────────────────────────────────────────
p4 <- ggplot(spec_budget, aes(kbudget(budget), score, colour = variant)) +
  geom_line(linewidth = 0.6) + col_scale +
  facet_wrap(~ spec, ncol = 5, scales = "free_y") +
  labs(title = "Per-spec score vs budget", x = "budget (k)", y = "spec score") +
  theme(legend.position = "bottom", strip.text = element_text(size = 7))
plots$per_spec <- save_png(p4, "04_per_spec_curves", w = 14, h = 10)

# ── P5: per-spec delta heatmaps vs base ───────────────────────────────────────
base_spec <- spec_budget |> filter(variant == "base") |> select(budget, spec, base = score)
delta_spec <- spec_budget |> filter(variant != "base") |>
  left_join(base_spec, by = c("budget", "spec")) |>
  mutate(delta = score - base)
p5 <- ggplot(delta_spec, aes(factor(kbudget(budget)), spec, fill = delta)) +
  geom_tile() +
  scale_fill_gradient2(low = "#b2182b", mid = "white", high = "#2166ac",
                       midpoint = 0, name = "delta") +
  facet_wrap(~ variant, ncol = 3,
             labeller = as_labeller(VARIANT_LABELS)) +
  labs(title = "Per-spec score delta vs baseline (blue = better)",
       x = "budget (k)", y = NULL) +
  theme(axis.text.x = element_text(angle = 90, vjust = 0.5, size = 6),
        axis.text.y = element_text(size = 6))
plots$delta_heat <- save_png(p5, "05_delta_heatmap", w = 14, h = 7)

# ── P6: mean axis quality (valid rows) vs budget ──────────────────────────────
axisq <- long |> filter(valid == 1, !is.na(axis_quality)) |>
  group_by(variant, budget) |> summarise(axis_quality = mean(axis_quality), .groups = "drop")
p6 <- ggplot(axisq, aes(kbudget(budget), 100 * axis_quality, colour = variant)) +
  geom_line(linewidth = 0.9) + geom_point(size = 1.6) + col_scale +
  labs(title = "Mean axis quality (valid tracks) vs budget",
       x = "budget (k sim-frames)", y = "axis quality (%)")
plots$axisq <- save_png(p6, "06_axis_quality")

# ── P7: paired per-(spec,seed,budget) delta distribution ──────────────────────
base_cell <- long |> filter(variant == "base") |> select(spec, seed, budget, base = score)
paired <- long |> filter(variant != "base") |>
  left_join(base_cell, by = c("spec", "seed", "budget")) |>
  mutate(delta = score - base)
p7 <- ggplot(paired, aes(variant, delta, fill = variant)) +
  geom_hline(yintercept = 0, linetype = 2, colour = "grey50") +
  geom_violin(alpha = 0.4, colour = NA) +
  geom_boxplot(width = 0.15, outlier.size = 0.4, alpha = 0.8) +
  fill_scale + scale_x_discrete(labels = VARIANT_LABELS) +
  labs(title = "Paired per-(spec,seed,budget) score delta vs baseline",
       x = NULL, y = "delta score (variant - base)") +
  theme(legend.position = "none", axis.text.x = element_text(angle = 20, hjust = 1))
plots$paired <- save_png(p7, "07_paired_delta")

# ── Combined PDF ──────────────────────────────────────────────────────────────
pdf(file.path("plots", "all.pdf"), width = 12, height = 8)
for (p in plots) print(p)
invisible(dev.off())

# ── Tables / analyses ─────────────────────────────────────────────────────────
# AUC of suite score over budget (trapezoid), per variant + delta vs base.
auc <- budget |> arrange(variant, budget) |> group_by(variant) |>
  summarise(auc = sum((head(suite_score, -1) + tail(suite_score, -1)) / 2 *
                       diff(budget)), .groups = "drop") |>
  mutate(auc_per_kframe = auc / (max(budget$budget) - min(budget$budget)) * 1000)
base_auc <- auc$auc[auc$variant == "base"]
auc <- auc |> mutate(delta_auc_vs_base = auc - base_auc,
                     pct_vs_base = 100 * (auc - base_auc) / base_auc)
write_csv(auc, "tables/auc.csv")

# Per-budget mean paired delta + sign + paired t-test p-value.
paired_budget <- paired |> group_by(variant, budget) |>
  summarise(mean_delta = mean(delta),
            median_delta = median(delta),
            frac_better = mean(delta > 0),
            frac_worse = mean(delta < 0),
            p_ttest = tryCatch(t.test(delta)$p.value, error = function(e) NA_real_),
            n = n(), .groups = "drop")
write_csv(paired_budget, "tables/paired_delta_by_budget.csv")

# Overall paired delta per variant (pooled over all cells).
paired_overall <- paired |> group_by(variant) |>
  summarise(mean_delta = mean(delta), median_delta = median(delta),
            frac_better = mean(delta > 0), frac_worse = mean(delta < 0),
            wilcox_p = tryCatch(wilcox.test(delta)$p.value, error = function(e) NA_real_),
            n = n(), .groups = "drop")
write_csv(paired_overall, "tables/paired_delta_overall.csv")

# Winner per budget (highest suite score).
winners <- budget |> group_by(budget) |>
  slice_max(suite_score, n = 1, with_ties = FALSE) |>
  select(budget, winner = variant, suite_score) |> ungroup()
write_csv(winners, "tables/winner_by_budget.csv")

# ── Console summary ───────────────────────────────────────────────────────────
cat("\n================ SUMMARY ================\n")
cat("\nHeadline (from golden.json):\n"); print(as.data.frame(summary_tbl[, c("variant","headline_score","n_seeds","n_budgets")]))
cat("\nAUC of suite-score curve (higher better):\n"); print(as.data.frame(auc), digits = 6)
cat("\nOverall paired delta vs base (pooled spec x seed x budget):\n"); print(as.data.frame(paired_overall), digits = 4)
cat("\nWinner per budget:\n"); print(as.data.frame(winners), digits = 5)
cat("\nPlots -> ./plots/ (png + all.pdf) ; tables -> ./tables/\n")
