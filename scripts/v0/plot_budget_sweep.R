#!/usr/bin/env Rscript

suppressPackageStartupMessages({
  library(ggplot2)
  library(jsonlite)
  library(scales)
})

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1 || length(args) > 2) {
  stop("usage: Rscript scripts/v0/plot_budget_sweep.R <sweep-dir> [first-failed-budget]")
}

sweep_dir <- normalizePath(args[[1]], mustWork = TRUE)
failure_budget <- if (length(args) == 2) as.numeric(args[[2]]) else NA_real_

num <- function(value, default = NA_real_) {
  if (is.null(value) || length(value) == 0 || !is.finite(as.numeric(value[[1]]))) default else as.numeric(value[[1]])
}

count <- function(value) {
  if (is.null(value)) 0L else length(value)
}

read_json <- function(path) {
  fromJSON(path, simplifyVector = FALSE)
}

text_value <- function(value, default = NA_character_) {
  if (is.null(value) || length(value) == 0) default else as.character(value[[1]])
}

bool_num <- function(value) {
  if (is.null(value) || length(value) == 0) NA_real_ else as.numeric(isTRUE(value[[1]]))
}

flatten_scalars <- function(value, prefix = "") {
  if (is.list(value)) {
    if (length(value) == 0 || is.null(names(value)) || any(names(value) == "")) return(list())
    rows <- list()
    for (name in names(value)) {
      child_prefix <- if (prefix == "") name else paste(prefix, name, sep = ".")
      rows <- c(rows, flatten_scalars(value[[name]], child_prefix))
    }
    return(rows)
  }
  if (length(value) != 1 || is.null(value)) return(list())
  value_type <- if (is.logical(value)) "logical" else if (is.numeric(value)) "numeric" else "text"
  list(data.frame(
    metric = prefix,
    value_numeric = if (is.numeric(value) || is.logical(value)) as.numeric(value) else NA_real_,
    value_text = if (is.numeric(value)) NA_character_ else as.character(value),
    value_type = value_type,
    stringsAsFactors = FALSE
  ))
}

rows_or_empty <- function(rows) {
  if (length(rows) == 0) data.frame() else do.call(rbind, rows)
}

segment_rows_for_run <- function(segments, budget) {
  if (is.null(segments) || length(segments) == 0) return(data.frame())
  rows_or_empty(lapply(seq_along(segments), function(index) {
    segment <- segments[[index]]
    data.frame(
      budget = budget,
      budget_m = budget / 1e6,
      segment_index = index - 1L,
      kind = text_value(segment$kind),
      attempt_id = num(segment$attempt_id),
      start_total_spent_frames = num(segment$start_total_spent_frames),
      end_total_spent_frames = num(segment$end_total_spent_frames),
      spent_frames = num(segment$spent_frames),
      stop_reason = text_value(segment$stop_reason),
      stringsAsFactors = FALSE
    )
  }))
}

attempt_rows_for_run <- function(attempts, budget) {
  if (is.null(attempts) || length(attempts) == 0) return(data.frame())
  rows_or_empty(lapply(attempts, function(attempt) {
    outcome <- attempt$outcome
    data.frame(
      budget = budget,
      budget_m = budget / 1e6,
      attempt_id = num(attempt$attempt_id),
      kind = text_value(attempt$kind),
      parent_attempt_id = num(attempt$parent_attempt_id),
      search_seed = num(attempt$search_seed),
      has_fallback = bool_num(attempt$has_fallback),
      anchor_gap_index = num(attempt$anchor$gap_index),
      anchor_frame = num(attempt$anchor$anchor_frame),
      anchor_remaining_gaps = num(attempt$anchor$remaining_gaps),
      anchor_remaining_contacts = num(attempt$anchor$remaining_contacts),
      anchor_remaining_duration_frames = num(attempt$anchor$remaining_duration_frames),
      repair_round_index = num(attempt$repair_round_index),
      anchor_upstream_offset = num(attempt$anchor_upstream_offset),
      incumbent_weak_gap_sse = num(attempt$incumbent_weak_gap_sse),
      start_total_spent_frames = num(attempt$start_total_spent_frames),
      ceiling_total_spent_frames = num(attempt$ceiling_total_spent_frames),
      ceiling_source = text_value(attempt$ceiling_source),
      available_hard_budget_frames = num(attempt$available_hard_budget_frames),
      local_budget_frames = num(attempt$local_budget_frames),
      end_total_spent_frames = num(outcome$end_total_spent_frames),
      spent_frames = num(outcome$spent_frames),
      stop_reason = text_value(outcome$stop_reason),
      completed = bool_num(outcome$completed),
      first_terminal_offset_frames = num(outcome$first_terminal_offset_frames),
      accepted_improvement = bool_num(outcome$accepted_improvement),
      first_accepted_improvement_offset_frames = num(outcome$first_accepted_improvement_offset_frames),
      accepted_score_delta = num(outcome$accepted_score_delta),
      censored = bool_num(outcome$censored),
      start_estimator_applicability = text_value(attempt$start$estimator_applicability),
      end_estimator_applicability = text_value(attempt$end$estimator_applicability),
      stringsAsFactors = FALSE
    )
  }))
}

observation_rows_for_run <- function(attempts, budget) {
  if (is.null(attempts) || length(attempts) == 0) return(data.frame())
  rows <- list()
  index <- 1L
  for (attempt in attempts) {
    observations <- attempt$observations
    if (is.null(observations)) next
    for (observation_index in seq_along(observations)) {
      observation <- observations[[observation_index]]
      rows[[index]] <- data.frame(
        budget = budget,
        budget_m = budget / 1e6,
        attempt_id = num(attempt$attempt_id),
        attempt_kind = text_value(attempt$kind),
        observation_index = observation_index - 1L,
        event = text_value(observation$event),
        total_spent_frames = num(observation$total_spent_frames),
        hard_remaining_frames = num(observation$hard_remaining_frames),
        hard_overrun_frames = num(observation$hard_overrun_frames),
        attempt_spent_frames = num(observation$attempt_spent_frames),
        attempt_remaining_frames = num(observation$attempt_remaining_frames),
        attempt_overrun_frames = num(observation$attempt_overrun_frames),
        high_water_gap_index = num(observation$high_water$gap_index),
        high_water_anchor_frame = num(observation$high_water$anchor_frame),
        high_water_remaining_gaps = num(observation$high_water$remaining_gaps),
        high_water_remaining_contacts = num(observation$high_water$remaining_contacts),
        high_water_remaining_duration_frames = num(observation$high_water$remaining_duration_frames),
        structural_startup_included = bool_num(observation$structural_startup_included),
        estimator_applicability = text_value(observation$estimator_applicability),
        structural_progress_fraction = num(observation$structural_progress_fraction),
        structural_work_prior_frames = num(observation$structural_work_prior_frames),
        incumbent_path_work_estimate_frames = num(observation$incumbent_path_work_estimate_frames),
        episode_pace_work_estimate_frames = num(observation$episode_pace_work_estimate_frames),
        estimated_remaining_work_frames = num(observation$estimated_remaining_work_frames),
        estimate_lower_frames = num(observation$estimate_lower_frames),
        estimate_upper_frames = num(observation$estimate_upper_frames),
        estimate_uncertainty_frames = num(observation$estimate_uncertainty_frames),
        hard_completion_margin = num(observation$hard_completion_margin),
        hard_completion_surplus_frames = num(observation$hard_completion_surplus_frames),
        attempt_completion_margin = num(observation$attempt_completion_margin),
        attempt_completion_surplus_frames = num(observation$attempt_completion_surplus_frames),
        stringsAsFactors = FALSE
      )
      index <- index + 1L
    }
  }
  rows_or_empty(rows)
}

axis_rows_for_report <- function(report, budget) {
  rows <- list()
  index <- 1L
  for (gap in report$gaps) {
    for (axis_name in names(gap$axes)) {
      axis <- gap$axes[[axis_name]]
      rows[[index]] <- data.frame(
        budget = budget,
        budget_m = budget / 1e6,
        gap_index = num(gap$gap_index),
        t_end = num(gap$t_end),
        axis = axis_name,
        target = num(axis$target),
        achieved = num(axis$achieved),
        error = abs(num(axis$error)),
        signed_error = num(axis$achieved) - num(axis$target),
        feasibility_bound = num(axis$feasibility_bound),
        ceiling = num(axis$ceiling),
        stringsAsFactors = FALSE
      )
      index <- index + 1L
    }
  }
  do.call(rbind, rows)
}

score_report <- function(report, axis_rows) {
  statuses <- vapply(report$contacts, function(contact) contact$status, character(1))
  frame_errors <- vapply(report$contacts, function(contact) num(contact$frame_error), numeric(1))
  landed <- statuses != "missing"
  landed_excess <- pmax(0, abs(frame_errors[landed]) - 1)
  drift_rms <- if (any(landed)) sqrt(mean(landed_excess^2, na.rm = TRUE)) else 0

  hits <- sum(statuses == "hit")
  drift <- sum(statuses == "drift")
  missing <- sum(statuses == "missing")
  axis_rms <- sqrt(mean(axis_rows$error^2))
  axis_quality <- exp(-axis_rms / 0.25)
  drift_quality <- exp(-drift_rms / 1.0)
  missing_quality <- exp(-missing / 1.0)
  sync_quality <- drift_quality * missing_quality
  offbeat_count <- count(report$off_beat_landings)
  offbeat_quality <- exp(-offbeat_count / 1.0)
  reached_end <- identical(report$terminus$reason, "endOfSpec")
  survival_quality <- if (reached_end) 1 else 0
  score <- 1000 * axis_quality * sync_quality * offbeat_quality * survival_quality

  list(
    score = score,
    contacts = length(statuses),
    hits = hits,
    drift = drift,
    missing = missing,
    offbeat = offbeat_count,
    survived = reached_end,
    contract_passed = drift == 0 && missing == 0 && offbeat_count == 0 && reached_end,
    axis_error_mean = mean(axis_rows$error),
    axis_error_rms = axis_rms,
    axis_error_max = max(axis_rows$error),
    axis_quality = axis_quality,
    drift_quality = drift_quality,
    missing_quality = missing_quality,
    sync_quality = sync_quality,
    offbeat_quality = offbeat_quality,
    survival_quality = survival_quality
  )
}

stats_files <- sort(list.files(sweep_dir, pattern = "^b[0-9]+\\.stats\\.json$", full.names = TRUE))
if (length(stats_files) == 0) stop("no bNNN.stats.json files found in ", sweep_dir)

run_rows <- list()
all_axis_rows <- list()
all_stats_scalar_rows <- list()
all_compile_scalar_rows <- list()
all_segment_rows <- list()
all_attempt_rows <- list()
all_observation_rows <- list()

for (i in seq_along(stats_files)) {
  stats_path <- stats_files[[i]]
  prefix <- sub("\\.stats\\.json$", "", stats_path)
  report_path <- paste0(prefix, ".report.json")
  track_path <- paste0(prefix, ".track.json")
  budget_telemetry_path <- paste0(prefix, ".budget-telemetry.json")
  if (!file.exists(report_path) || !file.exists(track_path) || !file.exists(budget_telemetry_path)) next

  stats_json <- read_json(stats_path)
  report <- read_json(report_path)
  track <- read_json(track_path)
  budget_telemetry <- read_json(budget_telemetry_path)
  budget_compile <- budget_telemetry$compile
  budget <- num(stats_json$budget)
  axis_rows <- axis_rows_for_report(report, budget)
  scored <- score_report(report, axis_rows)
  optimizer <- stats_json$stats
  segments <- segment_rows_for_run(budget_telemetry$segments, budget)
  attempts <- attempt_rows_for_run(budget_telemetry$attempts, budget)
  observations <- observation_rows_for_run(budget_telemetry$attempts, budget)
  segment_frames <- function(kind) sum(segments$spent_frames[segments$kind == kind], na.rm = TRUE)
  attempt_count <- function(kind) sum(attempts$kind == kind, na.rm = TRUE)

  stats_scalars <- rows_or_empty(flatten_scalars(optimizer))
  stats_scalars$budget <- budget
  stats_scalars$budget_m <- budget / 1e6
  stats_scalars$source <- "compile_stats"
  compile_scalars <- rows_or_empty(flatten_scalars(budget_compile))
  compile_scalars$budget <- budget
  compile_scalars$budget_m <- budget / 1e6
  compile_scalars$source <- "budget_telemetry.compile"

  run_rows[[length(run_rows) + 1L]] <- data.frame(
    budget = budget,
    budget_m = budget / 1e6,
    score = scored$score,
    contacts = scored$contacts,
    hits = scored$hits,
    drift = scored$drift,
    missing = scored$missing,
    offbeat = scored$offbeat,
    survived = scored$survived,
    contract_passed = scored$contract_passed,
    axis_error_mean = scored$axis_error_mean,
    axis_error_rms = scored$axis_error_rms,
    axis_error_max = scored$axis_error_max,
    axis_quality = scored$axis_quality,
    drift_quality = scored$drift_quality,
    missing_quality = scored$missing_quality,
    sync_quality = scored$sync_quality,
    offbeat_quality = scored$offbeat_quality,
    survival_quality = scored$survival_quality,
    elapsed_sec = num(stats_json$elapsed_ms) / 1000,
    sim_frames = num(optimizer$sim_frames),
    first_completion_frame = num(optimizer$first_completion_frame),
    candidates_sampled = num(optimizer$candidates_sampled),
    candidates_viable = num(optimizer$candidates_viable),
    search_nodes_expanded = num(optimizer$search_nodes_expanded),
    improvements = num(optimizer$improvements),
    frontier_max_size = num(optimizer$frontier_max_size),
    full_evaluations = num(optimizer$handoff_full_evaluations),
    unique_full_evaluations = num(optimizer$handoff_unique_full_evaluations),
    duplicate_full_evaluations = num(optimizer$handoff_duplicate_full_evaluations),
    policy_candidate_count = num(optimizer$handoff_policy_candidate_count_mean),
    policy_branch_limit = num(optimizer$handoff_policy_branch_limit_mean),
    predicted_first_completion_frames = num(optimizer$predicted_first_completion_frames),
    structural_work_prior_frames = num(budget_compile$initial_structural_work_prior_frames),
    structural_slack = num(budget_compile$initial_structural_slack),
    structural_applicability = as.character(budget_compile$initial_structural_applicability),
    hard_budget_frames = num(budget_compile$hard_budget_frames),
    policy_budget_frames = num(budget_compile$policy_budget_frames),
    total_spent_frames = num(budget_compile$total_spent_frames),
    hard_overrun_frames = num(budget_compile$hard_overrun_frames),
    first_terminal_total_spent_frames = num(budget_compile$first_terminal_total_spent_frames),
    startup_segment_frames = segment_frames("startup"),
    initial_search_segment_frames = segment_frames("initial_search"),
    repair_segment_frames = segment_frames("repair_attempt"),
    resumed_search_segment_frames = segment_frames("resumed_search"),
    segment_count = nrow(segments),
    attempt_count = nrow(attempts),
    initial_attempt_count = attempt_count("initial"),
    repair_attempt_count = attempt_count("repair"),
    resumed_attempt_count = attempt_count("resumed"),
    accepted_attempt_improvements = sum(attempts$accepted_improvement == 1, na.rm = TRUE),
    tail_completion_attempts = num(optimizer$handoff_tail_completion_attempts),
    tail_completion_improvements = num(optimizer$handoff_tail_completion_improvements),
    track_lines = count(track$lines),
    track_md5 = unname(tools::md5sum(track_path)),
    stringsAsFactors = FALSE
  )
  all_axis_rows[[length(all_axis_rows) + 1L]] <- axis_rows
  all_stats_scalar_rows[[length(all_stats_scalar_rows) + 1L]] <- stats_scalars
  all_compile_scalar_rows[[length(all_compile_scalar_rows) + 1L]] <- compile_scalars
  all_segment_rows[[length(all_segment_rows) + 1L]] <- segments
  all_attempt_rows[[length(all_attempt_rows) + 1L]] <- attempts
  all_observation_rows[[length(all_observation_rows) + 1L]] <- observations
}

runs <- do.call(rbind, run_rows)
runs <- runs[order(runs$budget), ]
axis_values <- do.call(rbind, all_axis_rows)
stats_scalar_values <- do.call(rbind, all_stats_scalar_rows)
compile_scalar_values <- do.call(rbind, all_compile_scalar_rows)
segment_values <- do.call(rbind, all_segment_rows)
attempt_values <- do.call(rbind, all_attempt_rows)
observation_values <- do.call(rbind, all_observation_rows)

runs$rolling_best <- cummax(runs$score)
runs$score_delta <- c(NA_real_, diff(runs$score))
runs$rolling_best_delta <- c(NA_real_, diff(runs$rolling_best))
runs$viable_rate <- runs$candidates_viable / runs$candidates_sampled
runs$completion_budget_share <- runs$first_terminal_total_spent_frames / runs$total_spent_frames
runs$post_completion_share <- 1 - runs$completion_budget_share
runs$post_completion_frames <- runs$total_spent_frames - runs$first_terminal_total_spent_frames
runs$hard_overrun_rate <- runs$hard_overrun_frames / runs$hard_budget_frames
runs$startup_segment_share <- runs$startup_segment_frames / runs$total_spent_frames
runs$initial_search_segment_share <- runs$initial_search_segment_frames / runs$total_spent_frames
runs$repair_segment_share <- runs$repair_segment_frames / runs$total_spent_frames
runs$resumed_search_segment_share <- runs$resumed_search_segment_frames / runs$total_spent_frames
runs$segment_accounting_residual_frames <- runs$total_spent_frames - (
  runs$startup_segment_frames + runs$initial_search_segment_frames +
    runs$repair_segment_frames + runs$resumed_search_segment_frames
)
runs$first_completion_counter_delta <- runs$first_completion_frame - runs$first_terminal_total_spent_frames
runs$seconds_per_million_frames <- runs$elapsed_sec / (runs$sim_frames / 1e6)
runs$sim_frames_per_second <- runs$sim_frames / runs$elapsed_sec
runs$candidates_per_second <- runs$candidates_sampled / runs$elapsed_sec
runs$unique_full_evaluation_rate <- runs$unique_full_evaluations / runs$full_evaluations
runs$duplicate_full_evaluation_rate <- runs$duplicate_full_evaluations / runs$full_evaluations
runs$tail_improvement_rate <- runs$tail_completion_improvements / runs$tail_completion_attempts
runs$first_completion_prediction_ratio <- runs$first_completion_frame / runs$predicted_first_completion_frames
runs$first_completion_prior_ratio <- runs$first_completion_frame / runs$structural_work_prior_frames
runs$new_track <- !duplicated(runs$track_md5)
runs$cumulative_unique_tracks <- cumsum(runs$new_track)
runs$same_as_previous <- c(FALSE, runs$track_md5[-1] == runs$track_md5[-nrow(runs)])

axis_metrics <- aggregate(
  cbind(mean_abs = axis_values$error, rms = axis_values$error, max_abs = axis_values$error,
        bias = axis_values$signed_error),
  by = list(budget = axis_values$budget, budget_m = axis_values$budget_m, axis = axis_values$axis),
  FUN = mean
)
for (row_index in seq_len(nrow(axis_metrics))) {
  selected <- axis_values$budget == axis_metrics$budget[[row_index]] &
    axis_values$axis == axis_metrics$axis[[row_index]]
  errors <- axis_values$error[selected]
  signed <- axis_values$signed_error[selected]
  axis_metrics$mean_abs[[row_index]] <- mean(errors)
  axis_metrics$rms[[row_index]] <- sqrt(mean(errors^2))
  axis_metrics$max_abs[[row_index]] <- max(errors)
  axis_metrics$bias[[row_index]] <- mean(signed)
}
axis_metrics <- axis_metrics[order(axis_metrics$budget, axis_metrics$axis), ]
axis_metrics$squared_error_share <- axis_metrics$rms^2 / ave(axis_metrics$rms^2, axis_metrics$budget, FUN = sum)

mean_or_na <- function(values) {
  if (all(is.na(values))) NA_real_ else mean(values, na.rm = TRUE)
}

gap_splits <- split(
  axis_values,
  interaction(axis_values$gap_index, axis_values$axis, drop = TRUE)
)
gap_axis_metrics <- do.call(rbind, lapply(gap_splits, function(values) {
  data.frame(
    gap_index = values$gap_index[[1]],
    t_end = values$t_end[[1]],
    axis = values$axis[[1]],
    target = values$target[[1]],
    achieved_mean = mean(values$achieved),
    achieved_sd = sd(values$achieved),
    achieved_p10 = unname(quantile(values$achieved, 0.1)),
    achieved_p90 = unname(quantile(values$achieved, 0.9)),
    error_mean = mean(values$error),
    error_rms = sqrt(mean(values$error^2)),
    error_p90 = unname(quantile(values$error, 0.9)),
    error_max = max(values$error),
    signed_bias = mean(values$signed_error),
    feasibility_bound_mean = mean_or_na(values$feasibility_bound),
    ceiling_mean = mean_or_na(values$ceiling),
    stringsAsFactors = FALSE
  )
}))
gap_axis_metrics <- gap_axis_metrics[order(gap_axis_metrics$t_end, gap_axis_metrics$axis), ]

segment_summary <- aggregate(
  spent_frames ~ budget + budget_m + kind,
  data = segment_values,
  FUN = sum
)
segment_summary$total_spent_frames <- runs$total_spent_frames[match(segment_summary$budget, runs$budget)]
segment_summary$spent_share <- segment_summary$spent_frames / segment_summary$total_spent_frames
segment_summary <- segment_summary[order(segment_summary$budget, segment_summary$kind), ]

attempt_kind_summary <- aggregate(
  cbind(attempts = rep(1, nrow(attempt_values)), spent_frames = attempt_values$spent_frames,
        accepted_improvements = ifelse(is.na(attempt_values$accepted_improvement), 0, attempt_values$accepted_improvement)) ~
    budget + budget_m + kind,
  data = attempt_values,
  FUN = sum
)
attempt_kind_summary <- attempt_kind_summary[order(attempt_kind_summary$budget, attempt_kind_summary$kind), ]

observation_event_summary <- aggregate(
  rep(1, nrow(observation_values)) ~ budget + budget_m + attempt_kind + event,
  data = observation_values,
  FUN = sum
)
names(observation_event_summary)[[5]] <- "observations"
observation_event_summary <- observation_event_summary[
  order(observation_event_summary$budget, observation_event_summary$attempt_kind, observation_event_summary$event),
]

scalar_values <- rbind(stats_scalar_values, compile_scalar_values)
scalar_values <- scalar_values[order(scalar_values$source, scalar_values$metric, scalar_values$budget), ]
scalar_values$metric_key <- paste(scalar_values$source, scalar_values$metric, sep = ":")
numeric_scalar_values <- scalar_values[
  scalar_values$value_type %in% c("numeric", "logical") & is.finite(scalar_values$value_numeric),
]
numeric_scalar_values$score <- runs$score[match(numeric_scalar_values$budget, runs$budget)]
numeric_scalar_values$elapsed_sec <- runs$elapsed_sec[match(numeric_scalar_values$budget, runs$budget)]

safe_cor <- function(x, y, method = "spearman") {
  keep <- is.finite(x) & is.finite(y)
  if (sum(keep) < 3 || length(unique(x[keep])) < 2 || length(unique(y[keep])) < 2) return(NA_real_)
  suppressWarnings(cor(x[keep], y[keep], method = method))
}

partial_score_cor_controlling_budget <- function(value, budget_m, score) {
  keep <- is.finite(value) & is.finite(budget_m) & is.finite(score)
  if (sum(keep) < 4 || length(unique(value[keep])) < 2 || length(unique(score[keep])) < 2) return(NA_real_)
  value_residual <- residuals(lm(value[keep] ~ budget_m[keep]))
  score_residual <- residuals(lm(score[keep] ~ budget_m[keep]))
  safe_cor(value_residual, score_residual, method = "pearson")
}

numeric_metric_splits <- split(numeric_scalar_values, numeric_scalar_values$metric_key)
scalar_metric_summary <- rows_or_empty(lapply(numeric_metric_splits, function(values) {
  values <- values[order(values$budget), ]
  fit <- if (nrow(values) >= 3 && length(unique(values$budget_m)) >= 2 &&
             length(unique(values$value_numeric)) >= 2) {
    lm(value_numeric ~ budget_m, data = values)
  } else {
    NULL
  }
  data.frame(
    source = values$source[[1]],
    metric = values$metric[[1]],
    metric_key = values$metric_key[[1]],
    observed_runs = nrow(values),
    coverage = nrow(values) / nrow(runs),
    unique_values = length(unique(values$value_numeric)),
    minimum = min(values$value_numeric),
    p10 = unname(quantile(values$value_numeric, 0.10)),
    p25 = unname(quantile(values$value_numeric, 0.25)),
    median = median(values$value_numeric),
    mean = mean(values$value_numeric),
    p75 = unname(quantile(values$value_numeric, 0.75)),
    p90 = unname(quantile(values$value_numeric, 0.90)),
    maximum = max(values$value_numeric),
    sd = sd(values$value_numeric),
    first = values$value_numeric[[1]],
    last = tail(values$value_numeric, 1),
    delta = tail(values$value_numeric, 1) - values$value_numeric[[1]],
    max_abs_step = if (nrow(values) > 1) max(abs(diff(values$value_numeric))) else NA_real_,
    monotone_non_decreasing = if (nrow(values) > 1) all(diff(values$value_numeric) >= 0) else NA,
    monotone_non_increasing = if (nrow(values) > 1) all(diff(values$value_numeric) <= 0) else NA,
    zero_fraction = mean(values$value_numeric == 0),
    spearman_budget = safe_cor(values$value_numeric, values$budget_m),
    spearman_score = safe_cor(values$value_numeric, values$score),
    spearman_score_at_or_above_6m = safe_cor(
      values$value_numeric[values$budget_m >= 6], values$score[values$budget_m >= 6]
    ),
    partial_score_cor_controlling_budget = partial_score_cor_controlling_budget(
      values$value_numeric, values$budget_m, values$score
    ),
    spearman_runtime = safe_cor(values$value_numeric, values$elapsed_sec),
    linear_slope_per_million = if (is.null(fit)) NA_real_ else coef(fit)[["budget_m"]],
    linear_r_squared = if (is.null(fit)) NA_real_ else suppressWarnings(summary(fit)$r.squared),
    stringsAsFactors = FALSE
  )
}))
scalar_metric_summary <- scalar_metric_summary[order(scalar_metric_summary$source, scalar_metric_summary$metric), ]

run_numeric_columns <- names(runs)[vapply(runs, function(column) is.numeric(column) || is.logical(column), logical(1))]
run_metric_values <- rows_or_empty(lapply(run_numeric_columns, function(metric_name) {
  values <- as.numeric(runs[[metric_name]])
  data.frame(
    budget = runs$budget,
    budget_m = runs$budget_m,
    score = runs$score,
    elapsed_sec = runs$elapsed_sec,
    metric = metric_name,
    value = values,
    stringsAsFactors = FALSE
  )
}))
run_metric_values <- run_metric_values[is.finite(run_metric_values$value), ]
run_metric_splits <- split(run_metric_values, run_metric_values$metric)
run_metric_summary <- rows_or_empty(lapply(run_metric_splits, function(values) {
  values <- values[order(values$budget), ]
  fit <- if (nrow(values) >= 3 && length(unique(values$budget_m)) >= 2 &&
             length(unique(values$value)) >= 2) {
    lm(value ~ budget_m, data = values)
  } else {
    NULL
  }
  data.frame(
    metric = values$metric[[1]],
    observed_runs = nrow(values),
    coverage = nrow(values) / nrow(runs),
    unique_values = length(unique(values$value)),
    minimum = min(values$value),
    p10 = unname(quantile(values$value, 0.10)),
    p25 = unname(quantile(values$value, 0.25)),
    median = median(values$value),
    mean = mean(values$value),
    p75 = unname(quantile(values$value, 0.75)),
    p90 = unname(quantile(values$value, 0.90)),
    maximum = max(values$value),
    sd = sd(values$value),
    first = values$value[[1]],
    last = tail(values$value, 1),
    delta = tail(values$value, 1) - values$value[[1]],
    max_abs_step = if (nrow(values) > 1) max(abs(diff(values$value))) else NA_real_,
    monotone_non_decreasing = if (nrow(values) > 1) all(diff(values$value) >= 0) else NA,
    monotone_non_increasing = if (nrow(values) > 1) all(diff(values$value) <= 0) else NA,
    zero_fraction = mean(values$value == 0),
    spearman_budget = safe_cor(values$value, values$budget_m),
    spearman_score = safe_cor(values$value, values$score),
    spearman_score_at_or_above_6m = safe_cor(
      values$value[values$budget_m >= 6], values$score[values$budget_m >= 6]
    ),
    partial_score_cor_controlling_budget = partial_score_cor_controlling_budget(
      values$value, values$budget_m, values$score
    ),
    spearman_runtime = safe_cor(values$value, values$elapsed_sec),
    linear_slope_per_million = if (is.null(fit)) NA_real_ else coef(fit)[["budget_m"]],
    linear_r_squared = if (is.null(fit)) NA_real_ else suppressWarnings(summary(fit)$r.squared),
    stringsAsFactors = FALSE
  )
}))
run_metric_summary <- run_metric_summary[order(run_metric_summary$metric), ]

metric_dictionary <- data.frame(
  metric = c(
    "budget", "score", "axis_error_rms", "axis_quality", "sync_quality", "offbeat_quality",
    "survival_quality", "elapsed_sec", "sim_frames", "hard_budget_frames", "total_spent_frames",
    "hard_overrun_frames", "first_terminal_total_spent_frames", "post_completion_frames",
    "completion_budget_share", "post_completion_share", "startup_segment_frames",
    "initial_search_segment_frames", "repair_segment_frames", "resumed_search_segment_frames",
    "candidates_sampled", "candidates_viable", "viable_rate", "policy_candidate_count",
    "policy_branch_limit", "search_nodes_expanded", "frontier_max_size", "improvements",
    "full_evaluations", "unique_full_evaluations", "duplicate_full_evaluations",
    "tail_completion_attempts", "tail_completion_improvements", "attempt_count",
    "accepted_attempt_improvements", "structural_work_prior_frames", "structural_slack",
    "first_completion_prior_ratio", "predicted_first_completion_frames",
    "first_completion_prediction_ratio", "track_lines", "track_md5"
  ),
  category = c(
    rep("score/contract", 7), rep("runtime/accounting", 13), rep("search behavior", 3),
    rep("search policy", 2), rep("search behavior", 10), rep("estimator", 5), rep("output", 2)
  ),
  unit = c(
    "simulated frames", "points", "normalized error", "factor", "factor", "factor", "factor",
    "seconds", "simulated frames", "simulated frames", "simulated frames", "simulated frames",
    "simulated frames", "simulated frames", "fraction", "fraction", "simulated frames",
    "simulated frames", "simulated frames", "simulated frames", "candidates", "candidates",
    "fraction", "candidates per expanded node", "branches", "nodes", "nodes", "count",
    "evaluations", "evaluations", "evaluations", "attempts", "improvements", "attempts",
    "improvements", "simulated frames", "ratio", "ratio", "simulated frames", "ratio", "lines", "MD5"
  ),
  source = c(
    "CLI argument", "derived from report", "derived from report", "derived from report",
    "derived from report", "derived from report", "derived from report", "stats.elapsed_ms",
    "stats.sim_frames", "budget telemetry compile", "budget telemetry compile",
    "budget telemetry compile", "budget telemetry compile", "derived from budget telemetry compile",
    "derived", "derived", "budget telemetry segments", "budget telemetry segments",
    "budget telemetry segments", "budget telemetry segments", "stats.candidates_sampled",
    "stats.candidates_viable", "derived", "stats.handoff_policy_candidate_count_mean",
    "stats.handoff_policy_branch_limit_mean", "stats.search_nodes_expanded",
    "stats.frontier_max_size", "stats.improvements", "stats.handoff_full_evaluations",
    "stats.handoff_unique_full_evaluations", "stats.handoff_duplicate_full_evaluations",
    "stats.handoff_tail_completion_attempts", "stats.handoff_tail_completion_improvements",
    "budget telemetry attempts", "budget telemetry attempts", "budget telemetry compile",
    "budget telemetry compile", "derived", "stats.predicted_first_completion_frames", "derived",
    "track JSON", "track file"
  ),
  definition = c(
    "Requested hard simulation-frame budget.",
    "1000 times the product of axis, sync, off-beat, and survival quality factors.",
    "RMS of all scored gap-axis errors.",
    "exp(-axis_error_rms / 0.25).",
    "Product of landed-drift and missing-contact qualities.",
    "exp(-off-beat landing count).",
    "1 at endOfSpec; otherwise survived-frame fraction when available.",
    "Wall-clock compile duration reported by run.ts.",
    "Total trajectory-extraction frames charged by the optimizer.",
    "Outer accounting budget.",
    "Actual charged frames at compile end, including permitted overrun.",
    "Frames charged beyond the hard budget.",
    "Spent-frame counter when the first terminal traversal was considered.",
    "total_spent_frames minus first_terminal_total_spent_frames.",
    "first_terminal_total_spent_frames divided by total_spent_frames.",
    "post_completion_frames divided by total_spent_frames.",
    "Frames in startup segments.",
    "Frames in the initial-search segment before repair handoff.",
    "Frames in repair-attempt segments after first terminal traversal.",
    "Frames in resumed-search segments after repair attempts.",
    "Candidate geometries sampled.",
    "Sampled candidates that pass viability checks.",
    "candidates_viable divided by candidates_sampled.",
    "Mean requested candidate count across expanded contact nodes.",
    "Mean resolved branch limit across expanded contact nodes.",
    "Search nodes expanded.",
    "Largest retained frontier size.",
    "Optimizer improvement events; not necessarily accepted repair attempts.",
    "Complete traversal evaluations, including duplicates.",
    "Full evaluations with unique track identity in the optimizer register.",
    "Full evaluations identified as duplicates.",
    "Tail completion attempts from partial paths.",
    "Tail completion attempts that improved the optimizer incumbent.",
    "Budget-telemetry attempt records, including initial, repair, and resumed attempts.",
    "Attempt outcomes whose accepted_improvement field is true.",
    "Budget-law estimate of initial structural work.",
    "policy budget divided by the initial structural work prior.",
    "Actual first-terminal work divided by the budget-law prior.",
    "V1 spec-structural yardstick; diagnostic policy coordinate, not an ETA.",
    "Actual first-terminal work divided by the stale V1 yardstick.",
    "Number of lines in the generated track.",
    "Exact generated track-file identity."
  ),
  stringsAsFactors = FALSE
)

scalar_score_relationships <- scalar_metric_summary[
  is.finite(scalar_metric_summary$spearman_score) |
    is.finite(scalar_metric_summary$partial_score_cor_controlling_budget),
]
scalar_score_relationships$max_abs_score_association <- pmax(
  abs(scalar_score_relationships$spearman_score),
  abs(scalar_score_relationships$spearman_score_at_or_above_6m),
  abs(scalar_score_relationships$partial_score_cor_controlling_budget),
  na.rm = TRUE
)
scalar_score_relationships <- scalar_score_relationships[
  order(scalar_score_relationships$max_abs_score_association, decreasing = TRUE),
]

run_score_relationships <- run_metric_summary[
  is.finite(run_metric_summary$spearman_score) |
    is.finite(run_metric_summary$partial_score_cor_controlling_budget),
]
run_score_relationships$max_abs_score_association <- pmax(
  abs(run_score_relationships$spearman_score),
  abs(run_score_relationships$spearman_score_at_or_above_6m),
  abs(run_score_relationships$partial_score_cor_controlling_budget),
  na.rm = TRUE
)
run_score_relationships <- run_score_relationships[
  order(run_score_relationships$max_abs_score_association, decreasing = TRUE),
]

selected_correlation_metrics <- intersect(c(
  "score", "axis_error_rms", "elapsed_sec", "sim_frames", "hard_overrun_rate",
  "post_completion_share", "repair_segment_share", "candidates_sampled", "viable_rate",
  "policy_candidate_count", "policy_branch_limit", "search_nodes_expanded", "frontier_max_size",
  "improvements", "full_evaluations", "unique_full_evaluations", "duplicate_full_evaluations",
  "tail_completion_attempts", "tail_completion_improvements", "tail_improvement_rate",
  "repair_attempt_count", "accepted_attempt_improvements", "first_completion_prior_ratio",
  "track_lines"
), names(runs))
selected_spearman <- cor(
  runs[, selected_correlation_metrics], use = "pairwise.complete.obs", method = "spearman"
)

write.csv(runs, file.path(sweep_dir, "sweep_metrics.csv"), row.names = FALSE)
write.csv(axis_metrics, file.path(sweep_dir, "axis_metrics.csv"), row.names = FALSE)
write.csv(axis_values, file.path(sweep_dir, "axis_gap_values.csv"), row.names = FALSE)
write.csv(gap_axis_metrics, file.path(sweep_dir, "gap_axis_metrics.csv"), row.names = FALSE)
write.csv(scalar_values, file.path(sweep_dir, "scalar_metric_values.csv"), row.names = FALSE)
write.csv(scalar_metric_summary, file.path(sweep_dir, "scalar_metric_summary.csv"), row.names = FALSE)
write.csv(run_metric_values, file.path(sweep_dir, "run_metric_values.csv"), row.names = FALSE)
write.csv(run_metric_summary, file.path(sweep_dir, "run_metric_summary.csv"), row.names = FALSE)
write.csv(scalar_score_relationships, file.path(sweep_dir, "scalar_score_relationships.csv"), row.names = FALSE)
write.csv(run_score_relationships, file.path(sweep_dir, "run_score_relationships.csv"), row.names = FALSE)
write.csv(selected_spearman, file.path(sweep_dir, "selected_metric_spearman.csv"), row.names = TRUE)
write.csv(metric_dictionary, file.path(sweep_dir, "metric_dictionary.csv"), row.names = FALSE)
write.csv(segment_values, file.path(sweep_dir, "budget_segments.csv"), row.names = FALSE)
write.csv(segment_summary, file.path(sweep_dir, "budget_segment_summary.csv"), row.names = FALSE)
write.csv(attempt_values, file.path(sweep_dir, "budget_attempts.csv"), row.names = FALSE)
write.csv(attempt_kind_summary, file.path(sweep_dir, "budget_attempt_kind_summary.csv"), row.names = FALSE)
write.csv(observation_values, file.path(sweep_dir, "budget_observations.csv"), row.names = FALSE)
write.csv(observation_event_summary, file.path(sweep_dir, "budget_observation_event_summary.csv"), row.names = FALSE)

ink <- "#202124"
muted <- "#6B7280"
teal <- "#087E8B"
gold <- "#D98E04"
red <- "#C73E1D"
blue <- "#3568A8"
purple <- "#7A5195"
axis_colors <- c(air = teal, speed = blue, amplitude = gold, impact = red)

theme_sweep <- theme_minimal(base_size = 12) +
  theme(
    plot.title = element_text(face = "bold", size = 16, color = ink),
    plot.subtitle = element_text(color = muted, margin = margin(b = 10)),
    plot.caption = element_text(color = muted),
    panel.grid.minor = element_blank(),
    legend.position = "bottom",
    strip.text = element_text(face = "bold", color = ink),
    axis.title = element_text(color = ink)
  )

failure_layer <- function() {
  if (is.na(failure_budget)) NULL else geom_vline(
    xintercept = failure_budget / 1e6,
    color = red,
    linewidth = 0.7,
    linetype = "dashed"
  )
}

best_index <- which.max(runs$score)
best <- runs[best_index, ]
score_plot <- ggplot(runs, aes(budget_m, score)) +
  geom_line(color = muted, linewidth = 0.45, alpha = 0.65) +
  geom_point(color = ink, size = 1.25, alpha = 0.8) +
  geom_smooth(method = "loess", formula = y ~ x, span = 0.2, se = TRUE,
              color = blue, fill = blue, alpha = 0.12, linewidth = 0.8) +
  geom_step(aes(y = rolling_best), color = teal, linewidth = 1) +
  geom_point(data = best, color = red, size = 3) +
  annotate("label", x = best$budget_m, y = best$score,
           label = sprintf("Best %.1f at %.1fM", best$score, best$budget_m),
           hjust = if (best$budget_m > median(runs$budget_m)) 1.05 else -0.05,
           vjust = -0.7, size = 3.3, linewidth = 0.2) +
  failure_layer() +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  labs(
    title = "Budget sweep: score and best-so-far",
    subtitle = "Raw fixed-seed outcomes are non-monotonic; the step line shows the attainable rolling best",
    x = "WASM simulation-frame budget",
    y = "Contract score (0-1000)",
    caption = if (is.na(failure_budget)) "No failure observed; the upper endpoint is censored" else sprintf("Dashed line: first failed budget (%.1fM)", failure_budget / 1e6)
  ) + theme_sweep

axis_long <- rbind(
  data.frame(axis_metrics[c("budget", "budget_m", "axis")], measure = "Mean |error|", value = axis_metrics$mean_abs),
  data.frame(axis_metrics[c("budget", "budget_m", "axis")], measure = "RMS error", value = axis_metrics$rms),
  data.frame(axis_metrics[c("budget", "budget_m", "axis")], measure = "Max |error|", value = axis_metrics$max_abs)
)
axis_plot <- ggplot(axis_long, aes(budget_m, value, color = axis)) +
  geom_line(linewidth = 0.65, alpha = 0.85) +
  geom_smooth(method = "loess", formula = y ~ x, span = 0.25, se = FALSE, linewidth = 0.9) +
  facet_wrap(~measure, scales = "free_y", ncol = 1) +
  failure_layer() +
  scale_color_manual(values = axis_colors) +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  labs(
    title = "Per-axis error across compute budgets",
    subtitle = "Each smoother follows one authored axis; faint lines retain the individual 100K results",
    x = "WASM simulation-frame budget",
    y = NULL,
    color = "Axis"
  ) + theme_sweep

contribution_plot <- ggplot(axis_metrics, aes(budget_m, squared_error_share, fill = axis)) +
  geom_area(position = "stack", alpha = 0.9) +
  scale_fill_manual(values = axis_colors) +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  scale_y_continuous(labels = label_percent(accuracy = 1), expand = expansion(mult = c(0, 0))) +
  labs(
    title = "Per-axis share of pooled squared error",
    subtitle = "Each share is axis RMS squared divided by the sum across axes",
    x = "WASM simulation-frame budget",
    y = "Share of squared error",
    fill = "Axis"
  ) + theme_sweep

heatmap_data <- gap_axis_metrics
heatmap_data$axis <- factor(heatmap_data$axis, levels = c("air", "speed", "amplitude", "impact"))
gap_heatmap_plot <- ggplot(heatmap_data, aes(t_end, axis, fill = error_rms)) +
  geom_tile(width = 0.52, height = 0.88) +
  scale_fill_viridis_c(option = "C", direction = -1) +
  scale_x_continuous(breaks = seq(0, max(heatmap_data$t_end), by = 10)) +
  labs(
    title = "Cross-budget gap-axis RMS error",
    subtitle = sprintf("RMS error at each gap and axis across all %d budgets", nrow(runs)),
    x = "Track time (seconds)",
    y = NULL,
    fill = "RMS error"
  ) + theme_sweep +
  theme(panel.grid = element_blank())

impact_gaps <- gap_axis_metrics[gap_axis_metrics$axis == "impact", ]
impact_plot <- ggplot(impact_gaps, aes(t_end)) +
  geom_ribbon(aes(ymin = achieved_p10, ymax = achieved_p90), fill = blue, alpha = 0.16) +
  geom_line(aes(y = target, color = "Authored target"), linewidth = 0.9) +
  geom_line(aes(y = achieved_mean, color = "Mean achieved"), linewidth = 0.75) +
  geom_line(aes(y = feasibility_bound_mean, color = "Feasibility bound"), linewidth = 0.7, linetype = "dashed") +
  scale_color_manual(values = c(`Authored target` = red, `Mean achieved` = blue, `Feasibility bound` = gold)) +
  scale_x_continuous(breaks = seq(0, max(impact_gaps$t_end), by = 10)) +
  scale_y_continuous(limits = c(0, 1), breaks = seq(0, 1, by = 0.2)) +
  labs(
    title = "Impact target, achieved range, and diagnostic bound",
    subtitle = "The ribbon is the achieved 10th-90th percentile across budgets; the authored target remains the score target",
    x = "Track time (seconds)",
    y = "Impact",
    color = NULL
  ) + theme_sweep

quality_long <- rbind(
  data.frame(budget_m = runs$budget_m, component = "Axis", quality = runs$axis_quality),
  data.frame(budget_m = runs$budget_m, component = "Sync", quality = runs$sync_quality),
  data.frame(budget_m = runs$budget_m, component = "Off-beat", quality = runs$offbeat_quality),
  data.frame(budget_m = runs$budget_m, component = "Survival", quality = runs$survival_quality)
)
quality_plot <- ggplot(quality_long, aes(budget_m, quality, color = component)) +
  geom_line(linewidth = 0.8) +
  facet_wrap(~component, scales = "free_y", ncol = 2) +
  failure_layer() +
  scale_color_manual(values = c(Axis = red, Sync = teal, `Off-beat` = gold, Survival = blue)) +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  labs(
    title = "Headline-score components",
    subtitle = "The score is 1000 times the product of these four qualities",
    x = "WASM simulation-frame budget",
    y = "Quality factor",
    color = "Component"
  ) + theme_sweep

frame_accounting_long <- rbind(
  data.frame(budget_m = runs$budget_m, metric = "Requested hard budget", value = runs$hard_budget_frames / 1e6),
  data.frame(budget_m = runs$budget_m, metric = "Total spent", value = runs$total_spent_frames / 1e6),
  data.frame(budget_m = runs$budget_m, metric = "First terminal", value = runs$first_terminal_total_spent_frames / 1e6),
  data.frame(budget_m = runs$budget_m, metric = "After first terminal", value = runs$post_completion_frames / 1e6)
)
frame_accounting_plot <- ggplot(frame_accounting_long, aes(budget_m, value, color = metric)) +
  geom_line(linewidth = 0.85) +
  failure_layer() +
  scale_color_manual(values = c(
    `Requested hard budget` = ink, `Total spent` = red,
    `First terminal` = blue, `After first terminal` = gold
  )) +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  scale_y_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  labs(
    title = "Simulation-frame accounting",
    subtitle = "After first terminal = total spent minus the frame counter at the first terminal traversal",
    x = "Requested WASM simulation-frame budget",
    y = "Simulation frames",
    color = NULL
  ) + theme_sweep

segment_kinds <- c("startup", "initial_search", "repair_attempt", "resumed_search")
segment_grid <- merge(
  expand.grid(budget = runs$budget, kind = segment_kinds, stringsAsFactors = FALSE),
  segment_summary[, c("budget", "kind", "spent_frames", "spent_share")],
  by = c("budget", "kind"), all.x = TRUE
)
segment_grid$budget_m <- segment_grid$budget / 1e6
segment_grid$spent_frames[is.na(segment_grid$spent_frames)] <- 0
segment_grid$spent_share[is.na(segment_grid$spent_share)] <- 0
segment_grid$kind <- factor(segment_grid$kind, levels = segment_kinds)
segment_share_plot <- ggplot(segment_grid, aes(budget_m, spent_share, fill = kind)) +
  geom_area(position = "stack", alpha = 0.9) +
  scale_fill_manual(
    values = c(startup = muted, initial_search = blue, repair_attempt = gold, resumed_search = purple),
    labels = c(startup = "Startup", initial_search = "Initial search", repair_attempt = "Repair attempts", resumed_search = "Resumed search")
  ) +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  scale_y_continuous(labels = label_percent(accuracy = 1), expand = expansion(mult = c(0, 0))) +
  labs(
    title = "Spent frames by telemetry segment kind",
    subtitle = "Shares are computed from the raw segment ledger and sum to total_spent_frames",
    x = "Requested WASM simulation-frame budget",
    y = "Share of total spent frames",
    fill = "Segment"
  ) + theme_sweep +
  theme(legend.position = "right")

runtime_efficiency_long <- rbind(
  data.frame(budget_m = runs$budget_m, metric = "Wall runtime (seconds)", value = runs$elapsed_sec),
  data.frame(budget_m = runs$budget_m, metric = "Simulation throughput (frames/s)", value = runs$sim_frames_per_second),
  data.frame(budget_m = runs$budget_m, metric = "Candidate throughput (candidates/s)", value = runs$candidates_per_second),
  data.frame(budget_m = runs$budget_m, metric = "Hard-budget overrun (%)", value = 100 * runs$hard_overrun_rate)
)
runtime_efficiency_plot <- ggplot(runtime_efficiency_long, aes(budget_m, value)) +
  geom_line(color = purple, linewidth = 0.65) +
  geom_point(color = ink, size = 1, alpha = 0.7) +
  facet_wrap(~metric, scales = "free_y", ncol = 2) +
  failure_layer() +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  labs(
    title = "Runtime, throughput, and budget overrun",
    subtitle = "Each panel presents one measured or directly derived runtime quantity",
    x = "WASM simulation-frame budget",
    y = NULL
  ) + theme_sweep

search_behavior_long <- rbind(
  data.frame(budget_m = runs$budget_m, metric = "Candidates sampled (thousands)", value = runs$candidates_sampled / 1e3),
  data.frame(budget_m = runs$budget_m, metric = "Candidate viability (%)", value = 100 * runs$viable_rate),
  data.frame(budget_m = runs$budget_m, metric = "Search nodes expanded", value = runs$search_nodes_expanded),
  data.frame(budget_m = runs$budget_m, metric = "Maximum frontier size", value = runs$frontier_max_size),
  data.frame(budget_m = runs$budget_m, metric = "Improvement events", value = runs$improvements),
  data.frame(budget_m = runs$budget_m, metric = "Full evaluations", value = runs$full_evaluations),
  data.frame(budget_m = runs$budget_m, metric = "Tail completion attempts", value = runs$tail_completion_attempts),
  data.frame(budget_m = runs$budget_m, metric = "Tail improvement rate (%)", value = 100 * runs$tail_improvement_rate)
)
search_behavior_plot <- ggplot(search_behavior_long, aes(budget_m, value)) +
  geom_line(color = teal, linewidth = 0.65) +
  geom_point(color = ink, size = 0.9, alpha = 0.7) +
  facet_wrap(~metric, scales = "free_y", ncol = 2) +
  failure_layer() +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  labs(
    title = "Selected search-behavior counters",
    subtitle = "Definitions and every other scalar compiler stat are available in the CSV catalog",
    x = "WASM simulation-frame budget",
    y = NULL
  ) + theme_sweep

policy_long <- rbind(
  data.frame(budget_m = runs$budget_m, metric = "Candidate policy size", value = runs$policy_candidate_count),
  data.frame(budget_m = runs$budget_m, metric = "First completion (% spent)", value = 100 * runs$completion_budget_share),
  data.frame(budget_m = runs$budget_m, metric = "Actual / budget-law prior", value = runs$first_completion_prior_ratio),
  data.frame(budget_m = runs$budget_m, metric = "Actual / V1 structural yardstick", value = runs$first_completion_prediction_ratio),
  data.frame(budget_m = runs$budget_m, metric = "Tail completion improvements", value = runs$tail_completion_improvements)
)
policy_plot <- ggplot(policy_long, aes(budget_m, value)) +
  geom_line(color = blue, linewidth = 0.7) +
  geom_point(color = ink, size = 1, alpha = 0.7) +
  facet_wrap(~metric, scales = "free_y", ncol = 3) +
  failure_layer() +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  labs(
    title = "How the budget changes search policy",
    subtitle = "The budget-law prior is an estimator; the V1 value is an intentionally stale policy coordinate",
    x = "WASM simulation-frame budget",
    y = NULL
  ) + theme_sweep

post_completion_long <- rbind(
  data.frame(budget_m = runs$budget_m, metric = "Post-first-terminal frames (millions)", value = runs$post_completion_frames / 1e6),
  data.frame(budget_m = runs$budget_m, metric = "Post-first-terminal share (%)", value = 100 * runs$post_completion_share),
  data.frame(budget_m = runs$budget_m, metric = "Repair attempts", value = runs$repair_attempt_count),
  data.frame(budget_m = runs$budget_m, metric = "Accepted attempt improvements", value = runs$accepted_attempt_improvements)
)
post_completion_plot <- ggplot(post_completion_long, aes(budget_m, value)) +
  geom_line(color = gold, linewidth = 0.7) +
  geom_point(color = ink, size = 1, alpha = 0.7) +
  facet_wrap(~metric, scales = "free_y", ncol = 2) +
  failure_layer() +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  labs(
    title = "Post-first-terminal work and attempt outcomes",
    subtitle = "The post share starts after the first terminal traversal is considered, not after the final track is selected",
    x = "WASM simulation-frame budget",
    y = NULL
  ) + theme_sweep

estimator_plot <- ggplot(
  runs,
  aes(structural_work_prior_frames / 1e6, first_terminal_total_spent_frames / 1e6,
      color = budget_m, shape = structural_applicability)
) +
  geom_abline(slope = 1, intercept = 0, color = muted, linetype = "dashed", linewidth = 0.7) +
  geom_point(size = 2, alpha = 0.85) +
  scale_color_viridis_c(option = "C", direction = -1, labels = label_number(suffix = "M", accuracy = 0.1)) +
  coord_equal() +
  labs(
    title = "Budget-law prior versus actual first-terminal work",
    subtitle = "The dashed line is equality; color is requested budget and shape is estimator applicability",
    x = "Initial structural work prior (million frames)",
    y = "Actual first terminal (million frames)",
    color = "Budget",
    shape = "Applicability"
  ) + theme_sweep

diversity_long <- rbind(
  data.frame(budget_m = runs$budget_m, metric = "Track lines", value = runs$track_lines, new_track = runs$new_track),
  data.frame(budget_m = runs$budget_m, metric = "Cumulative unique outputs", value = runs$cumulative_unique_tracks, new_track = runs$new_track),
  data.frame(budget_m = runs$budget_m, metric = "Unique full evaluations", value = runs$unique_full_evaluations, new_track = runs$new_track),
  data.frame(budget_m = runs$budget_m, metric = "Duplicate full evaluations", value = runs$duplicate_full_evaluations, new_track = runs$new_track)
)
diversity_plot <- ggplot(diversity_long, aes(budget_m, value)) +
  geom_line(color = teal, linewidth = 0.7) +
  geom_point(aes(color = new_track), size = 1.1, alpha = 0.75) +
  facet_wrap(~metric, scales = "free_y", ncol = 2) +
  failure_layer() +
  scale_color_manual(values = c(`TRUE` = teal, `FALSE` = red), labels = c(`TRUE` = "New output", `FALSE` = "Repeated output")) +
  scale_x_continuous(labels = label_number(suffix = "M", accuracy = 0.1)) +
  labs(
    title = "Solution diversity and evaluation reuse",
    subtitle = "Track-file hashes identify exact repeated outputs at adjacent or later budgets",
    x = "WASM simulation-frame budget",
    y = NULL,
    color = "Track identity"
  ) + theme_sweep

plots <- list(
  score = score_plot,
  axis_errors = axis_plot,
  error_contribution = contribution_plot,
  gap_error_heatmap = gap_heatmap_plot,
  impact_diagnostics = impact_plot,
  score_components = quality_plot,
  frame_accounting = frame_accounting_plot,
  segment_shares = segment_share_plot,
  runtime_efficiency = runtime_efficiency_plot,
  search_behavior = search_behavior_plot,
  search_policy = policy_plot,
  post_completion = post_completion_plot,
  estimator_calibration = estimator_plot,
  solution_diversity = diversity_plot
)
for (plot_name in names(plots)) {
  ggsave(
    file.path(sweep_dir, paste0(plot_name, ".png")),
    plots[[plot_name]], width = 13.33, height = 7.5, dpi = 180, bg = "white"
  )
}
pdf(file.path(sweep_dir, "budget_sweep_plots.pdf"), width = 13.33, height = 7.5, onefile = TRUE)
for (plot in plots) print(plot)
dev.off()

runtime_fit <- lm(elapsed_sec ~ budget_m, data = runs)
score_cor <- suppressWarnings(cor(runs$budget_m, runs$score, method = "spearman"))
rolling_gain <- tail(runs$rolling_best, 1) - runs$rolling_best[[1]]
late_runs <- runs[runs$budget_m >= 6, ]
late_score_fit <- lm(score ~ budget_m, data = late_runs)
first_completion_fit <- lm(first_completion_frame ~ budget_m, data = runs)
candidate_policy_fit <- lm(policy_candidate_count ~ budget_m, data = runs)
structural_prior_fit <- lm(first_completion_frame ~ structural_work_prior_frames, data = runs)
runner_up <- runs[order(runs$score, decreasing = TRUE)[[2]], ]
best_axis <- axis_metrics[axis_metrics$budget == best$budget, ]
best_axis <- best_axis[order(best_axis$squared_error_share, decreasing = TRUE), ]
runner_up_axis <- axis_metrics[axis_metrics$budget == runner_up$budget, ]
best_vs_runner <- merge(
  runner_up_axis[, c("axis", "rms")], best_axis[, c("axis", "rms")],
  by = "axis", suffixes = c("_runner_up", "_best")
)
best_vs_runner$rms_delta <- best_vs_runner$rms_best - best_vs_runner$rms_runner_up
impact_values <- axis_values[axis_values$axis == "impact" & !is.na(axis_values$feasibility_bound), ]
impact_over_bound <- impact_values$target > impact_values$feasibility_bound
impact_over_bound_sse_share <- sum(impact_values$error[impact_over_bound]^2) / sum(impact_values$error^2)
impact_error_over_bound <- mean(impact_values$error[impact_over_bound])
impact_error_within_bound <- mean(impact_values$error[!impact_over_bound])
hardest <- gap_axis_metrics[order(gap_axis_metrics$error_rms, decreasing = TRUE), ]
best_values <- axis_values[axis_values$budget == best$budget, ]
best_contributions <- sort(best_values$error^2 / sum(best_values$error^2), decreasing = TRUE)
early_axis <- axis_metrics[axis_metrics$budget == min(runs$budget), c("axis", "rms")]
improvement_axis <- merge(early_axis, best_axis[, c("axis", "rms")], by = "axis", suffixes = c("_early", "_best"))
improvement_axis$sse_reduction <- improvement_axis$rms_early^2 - improvement_axis$rms_best^2
improvement_axis$reduction_share <- improvement_axis$sse_reduction / sum(improvement_axis$sse_reduction)

threshold_lines <- vapply(c(0.97, 0.98, 0.99, 0.995, 0.999), function(fraction) {
  threshold <- fraction * best$score
  first <- runs[which(runs$score >= threshold)[[1]], ]
  sprintf("  %5.1f%% at %4.1fM: score %.3f, %.3fs", 100 * fraction, first$budget_m, first$score, first$elapsed_sec)
}, character(1))

axis_share_lines <- vapply(seq_len(nrow(best_axis)), function(index) {
  axis <- best_axis[index, ]
  sprintf(
    "  %-9s mean|err| %.4f, RMS %.4f, max %.4f, SSE share %.1f%%",
    axis$axis, axis$mean_abs, axis$rms, axis$max_abs, 100 * axis$squared_error_share
  )
}, character(1))

hotspot_lines <- vapply(seq_len(min(10, nrow(hardest))), function(index) {
  hotspot <- hardest[index, ]
  sprintf(
    "  t=%5.2fs g%-3d %-9s target %.3f, mean achieved %.3f, RMS %.3f",
    hotspot$t_end, hotspot$gap_index, hotspot$axis, hotspot$target,
    hotspot$achieved_mean, hotspot$error_rms
  )
}, character(1))

tradeoff_lines <- vapply(seq_len(nrow(best_vs_runner)), function(index) {
  axis <- best_vs_runner[index, ]
  sprintf(
    "  %-9s RMS %.4f -> %.4f (%+.4f)",
    axis$axis, axis$rms_runner_up, axis$rms_best, axis$rms_delta
  )
}, character(1))

improvement_lines <- vapply(seq_len(nrow(improvement_axis)), function(index) {
  axis <- improvement_axis[index, ]
  sprintf("  %-9s %.1f%% of total squared-error reduction", axis$axis, 100 * axis$reduction_share)
}, character(1))

summary_lines <- c(
  sprintf("Successful runs: %d", nrow(runs)),
  sprintf("Successful budget range: %.1fM to %.1fM", min(runs$budget_m), max(runs$budget_m)),
  if (is.na(failure_budget)) "Failure boundary: not observed; upper endpoint is censored" else sprintf("First failed budget: %.1fM", failure_budget / 1e6),
  sprintf("Best score: %.3f at %.1fM", best$score, best$budget_m),
  sprintf("Runner-up: %.3f at %.1fM (best margin %.3f)", runner_up$score, runner_up$budget_m, best$score - runner_up$score),
  sprintf("Last successful score: %.3f at %.1fM", tail(runs$score, 1), tail(runs$budget_m, 1)),
  sprintf("Rolling-best gain over 100K: %.3f", rolling_gain),
  sprintf("Budget/score Spearman correlation: %.4f", score_cor),
  sprintf(
    "Late score slope (>=6M): %.4f points/M, p=%.4f, R2=%.4f",
    coef(late_score_fit)[["budget_m"]], summary(late_score_fit)$coefficients["budget_m", "Pr(>|t|)"],
    summary(late_score_fit)$r.squared
  ),
  sprintf(
    "Runtime slope: %.3f seconds per additional million frames (R2 %.4f)",
    coef(runtime_fit)[["budget_m"]], summary(runtime_fit)$r.squared
  ),
  sprintf(
    "First-completion work slope: %.0f frames/M (R2 %.4f)",
    coef(first_completion_fit)[["budget_m"]], summary(first_completion_fit)$r.squared
  ),
  sprintf(
    "Candidate-policy slope: %.1f candidates/M (R2 %.4f)",
    coef(candidate_policy_fit)[["budget_m"]], summary(candidate_policy_fit)$r.squared
  ),
  sprintf(
    "Budget-law prior vs first completion: R2 %.4f; last actual/prior ratio %.2f",
    summary(structural_prior_fit)$r.squared, tail(runs$first_completion_prior_ratio, 1)
  ),
  sprintf(
    "Budget-law applicability: %d calibrated, %d extrapolated runs",
    sum(runs$structural_applicability == "calibrated"),
    sum(runs$structural_applicability != "calibrated")
  ),
  sprintf(
    "At the last run, first completion used %.1f%% of spent frames and was %.1fx the intentionally stale V1 yardstick",
    100 * tail(runs$completion_budget_share, 1), tail(runs$first_completion_prediction_ratio, 1)
  ),
  sprintf("Exact unique track files: %d/%d", sum(runs$new_track), nrow(runs)),
  sprintf("Adjacent exact repeats: %d", sum(runs$same_as_previous)),
  sprintf("Full-contract runs: %d/%d", sum(runs$contract_passed), nrow(runs)),
  "",
  "First budget reaching a fraction of the best observed score:",
  threshold_lines,
  "",
  "Per-axis errors and squared-error contribution at the best budget:",
  axis_share_lines,
  sprintf(
    "Impact target exceeds its diagnostic bound in %.1f%% of observations; those requests contribute %.1f%% of impact SSE",
    100 * mean(impact_over_bound), 100 * impact_over_bound_sse_share
  ),
  sprintf(
    "Mean impact |error|: %.3f above the bound versus %.3f within it",
    impact_error_over_bound, impact_error_within_bound
  ),
  sprintf(
    "Best-run error concentration: top 20/452 values %.1f%% of SSE; top 40 %.1f%%",
    100 * sum(head(best_contributions, 20)), 100 * sum(head(best_contributions, 40))
  ),
  "",
  sprintf("Best-vs-runner-up axis tradeoff (%.1fM -> %.1fM):", runner_up$budget_m, best$budget_m),
  tradeoff_lines,
  "",
  "Share of total squared-error reduction from 100K to best:",
  improvement_lines,
  "",
  "Persistent gap/axis hotspots across the sweep:",
  hotspot_lines,
  "",
  "Per-axis errors at best-scoring budget:",
  capture.output(print(axis_metrics[axis_metrics$budget == best$budget, c("axis", "mean_abs", "rms", "max_abs", "bias")], row.names = FALSE, digits = 4))
)
writeLines(summary_lines, file.path(sweep_dir, "summary.txt"))
cat(paste(summary_lines, collapse = "\n"), "\n")

selected_budgets <- c(0.1, 0.2, 0.5, 1.0, 2.7, 5.7, 7.4, 10.0, 11.6)
selected_runs <- runs[runs$budget_m %in% selected_budgets, ]

score_table <- c(
  "| Budget | Score | Rolling best | Axis RMS | Runtime | Contract |",
  "|---:|---:|---:|---:|---:|:---:|",
  vapply(seq_len(nrow(selected_runs)), function(index) {
    run <- selected_runs[index, ]
    sprintf(
      "| %.1fM | %.3f | %.3f | %.4f | %.3fs | %s |",
      run$budget_m, run$score, run$rolling_best, run$axis_error_rms,
      run$elapsed_sec, if (run$contract_passed) "pass" else "fail"
    )
  }, character(1))
)

accounting_table <- c(
  "| Budget | Hard | Total spent | Overrun | First terminal | After terminal | After % | Repair attempts | Accepted attempt improvements |",
  "|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  vapply(seq_len(nrow(selected_runs)), function(index) {
    run <- selected_runs[index, ]
    sprintf(
      "| %.1fM | %.3fM | %.3fM | %.3fM | %.3fM | %.3fM | %.1f%% | %d | %d |",
      run$budget_m, run$hard_budget_frames / 1e6, run$total_spent_frames / 1e6,
      run$hard_overrun_frames / 1e6, run$first_terminal_total_spent_frames / 1e6,
      run$post_completion_frames / 1e6, 100 * run$post_completion_share,
      run$repair_attempt_count, run$accepted_attempt_improvements
    )
  }, character(1))
)

search_table <- c(
  "| Budget | Policy candidates | Branch limit | Sampled | Viable % | Nodes | Frontier max | Register improvements | Full evals | Unique | Duplicate | Tail attempts | Tail improvements |",
  "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  vapply(seq_len(nrow(selected_runs)), function(index) {
    run <- selected_runs[index, ]
    sprintf(
      "| %.1fM | %.0f | %.2f | %.0f | %.1f%% | %.0f | %.0f | %.0f | %.0f | %.0f | %.0f | %.0f | %.0f |",
      run$budget_m, run$policy_candidate_count, run$policy_branch_limit,
      run$candidates_sampled, 100 * run$viable_rate, run$search_nodes_expanded,
      run$frontier_max_size, run$improvements, run$full_evaluations,
      run$unique_full_evaluations, run$duplicate_full_evaluations,
      run$tail_completion_attempts, run$tail_completion_improvements
    )
  }, character(1))
)

estimator_table <- c(
  "| Budget | Structural prior | First terminal | Actual/prior | Structural slack | Applicability | Actual/V1 yardstick |",
  "|---:|---:|---:|---:|---:|:---|---:|",
  vapply(seq_len(nrow(selected_runs)), function(index) {
    run <- selected_runs[index, ]
    sprintf(
      "| %.1fM | %.3fM | %.3fM | %.3f | %.3f | %s | %.2f |",
      run$budget_m, run$structural_work_prior_frames / 1e6,
      run$first_terminal_total_spent_frames / 1e6, run$first_completion_prior_ratio,
      run$structural_slack, run$structural_applicability,
      run$first_completion_prediction_ratio
    )
  }, character(1))
)

best_axis_table <- c(
  "| Axis | Mean abs error | RMS | Max abs error | Signed bias | Squared-error share |",
  "|:---|---:|---:|---:|---:|---:|",
  vapply(seq_len(nrow(best_axis)), function(index) {
    axis <- best_axis[index, ]
    sprintf(
      "| %s | %.4f | %.4f | %.4f | %+.4f | %.1f%% |",
      axis$axis, axis$mean_abs, axis$rms, axis$max_abs, axis$bias,
      100 * axis$squared_error_share
    )
  }, character(1))
)

hotspot_table <- c(
  "| Time | Gap | Axis | Target | Mean achieved | Achieved SD | RMS error | P90 error |",
  "|---:|---:|:---|---:|---:|---:|---:|---:|",
  vapply(seq_len(min(12, nrow(hardest))), function(index) {
    gap <- hardest[index, ]
    sprintf(
      "| %.2fs | %d | %s | %.4f | %.4f | %.4f | %.4f | %.4f |",
      gap$t_end, gap$gap_index, gap$axis, gap$target, gap$achieved_mean,
      gap$achieved_sd, gap$error_rms, gap$error_p90
    )
  }, character(1))
)

report_lines <- c(
  "# Preliminary Shelter WASM budget-sweep report",
  "",
  "> **Status: preliminary and non-exhaustive.** This report primarily presents",
  "> observed data and metric definitions. It does not claim that the available",
  "> telemetry has been exhaustively analyzed. Additional high-value relationships",
  "> may remain in the raw JSON, per-observation telemetry, and generated tables.",
  "",
  "## Scope",
  "",
  sprintf("- Source commit: `%s`", text_value(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))),
  "- Spec: `scripts/v0/specs/shelter_impact_sync.ts`",
  "- Compiler / engine / seed: `handoff` / WASM / `0`",
  sprintf("- Completed budgets: %.1fM through %.1fM in 0.1M increments (%d runs)", min(runs$budget_m), max(runs$budget_m), nrow(runs)),
  "- The sweep was stopped by the user. No failure was observed, so the upper endpoint is censored.",
  "- This is one spec, one seed, one engine, and one scoring-era commit.",
  "- Adjacent budget points are deterministic policy variants, not independent random samples.",
  "- Generic scalar extraction includes named scalar fields. Unnamed arrays remain in the raw JSON.",
  "",
  "## Dataset inventory",
  "",
  sprintf("- Raw run sets: %d reports, %d compile-stat files, %d budget-telemetry files, %d tracks",
          nrow(runs), nrow(runs), nrow(runs), nrow(runs)),
  sprintf("- Scored gap-axis observations: %s", format(nrow(axis_values), big.mark = ",")),
  sprintf("- Scalar telemetry values: %s across %d distinct metrics", format(nrow(scalar_values), big.mark = ","), nrow(scalar_metric_summary)),
  sprintf("- Budget segments: %s", format(nrow(segment_values), big.mark = ",")),
  sprintf("- Attempts: %s", format(nrow(attempt_values), big.mark = ",")),
  sprintf("- Estimator/event observations: %s", format(nrow(observation_values), big.mark = ",")),
  sprintf("- Total measured runtime: %.1f seconds (%.1f minutes)", sum(runs$elapsed_sec), sum(runs$elapsed_sec) / 60),
  sprintf("- Total charged simulation frames: %.0fM", sum(runs$sim_frames) / 1e6),
  sprintf("- Total candidates sampled: %.2fM", sum(runs$candidates_sampled) / 1e6),
  "",
  "## Score and contract observations",
  "",
  score_table,
  "",
  sprintf("All %d runs have 113/113 hits, zero drift, zero missing contacts, zero off-beat landings, and `endOfSpec` survival.", nrow(runs)),
  "Consequently, sync, off-beat, and survival quality are 1.0 throughout; score variation equals axis-quality variation.",
  "",
  "Plots: [score](score.png), [score components](score_components.png),",
  "[per-axis errors](axis_errors.png), [squared-error shares](error_contribution.png).",
  "",
  "## Per-axis observations at the highest-scoring run",
  "",
  sprintf("Highest observed score: %.3f at %.1fM.", best$score, best$budget_m),
  "",
  best_axis_table,
  "",
  "Full per-budget values are in `axis_metrics.csv`; all gap values are in `axis_gap_values.csv`.",
  "",
  "## Runtime and frame accounting",
  "",
  "Definitions:",
  "",
  "- `first terminal`: charged-frame counter when the first terminal traversal is considered.",
  "- `after terminal`: `total spent - first terminal`.",
  "- `after %`: `after terminal / total spent`.",
  "- Post-first-terminal work can contain repair-attempt and resumed-search segments.",
  "- It does not mean time after the final output was selected.",
  "",
  accounting_table,
  "",
  sprintf("Accounting validation: maximum segment residual = %.0f frames; maximum stats-vs-telemetry first-terminal delta = %.0f frames.",
          max(abs(runs$segment_accounting_residual_frames)), max(abs(runs$first_completion_counter_delta))),
  "",
  "At 11.6M, the raw ledger contains 11,144 startup frames, 6,375,592 initial-search frames,",
  "5,182,027 repair-attempt frames, and 116,643 resumed-search frames. The first two sum",
  "to 6,386,736 first-terminal frames; repair plus resumed work is 5,298,670 frames (45.3%).",
  "",
  "Plots: [frame accounting](frame_accounting.png), [segment shares](segment_shares.png),",
  "[post-first-terminal details](post_completion.png), [runtime efficiency](runtime_efficiency.png).",
  "",
  "## Search behavior and search policy",
  "",
  "Counter scopes are distinct:",
  "",
  "- `register improvements`: considered leaves that strictly improve the best-so-far register.",
  "- `tail improvements`: near-tail greedy completions that improve the register.",
  "- `accepted attempt improvements`: budget-telemetry attempts whose outcome marks an accepted improvement.",
  "- These counters are not expected to be equal.",
  "",
  search_table,
  "",
  "The complete definitions are in `metric_dictionary.csv`. Every discovered named scalar",
  "compiler stat, including phase and remaining-contact maps, is in `scalar_metric_values.csv`.",
  "",
  "Plots: [search behavior](search_behavior.png), [search policy](search_policy.png),",
  "[solution diversity](solution_diversity.png).",
  "",
  "## Budget-estimator observations",
  "",
  estimator_table,
  "",
  "The budget-law prior and V1 structural yardstick have different documented roles.",
  "The V1 value is an intentionally stale policy coordinate, not a completion ETA.",
  "",
  "Plot: [estimator prior versus actual](estimator_calibration.png).",
  "",
  "## Cross-budget gap-axis observations",
  "",
  hotspot_table,
  "",
  "This table is ordered by cross-budget RMS error. It is descriptive and does not assign cause.",
  "",
  "Plots: [gap-axis heatmap](gap_error_heatmap.png), [impact target/achieved/bound](impact_diagnostics.png).",
  "",
  "## Machine-readable analysis outputs",
  "",
  "- `sweep_metrics.csv`: one row per run, including derived accounting and rates.",
  "- `run_metric_values.csv` / `run_metric_summary.csv`: long values and descriptive statistics for every numeric run-table field.",
  "- `scalar_metric_values.csv` / `scalar_metric_summary.csv`: dynamically extracted compiler and compile-telemetry scalars.",
  "- `run_score_relationships.csv` / `scalar_score_relationships.csv`: score associations, including >=6M and budget-controlled columns.",
  "- `selected_metric_spearman.csv`: selected-metric Spearman matrix.",
  "- `budget_segments.csv`: raw segment ledger normalized to rows.",
  "- `budget_attempts.csv`: normalized attempt outcomes.",
  "- `budget_observations.csv`: normalized estimator/event observations.",
  "- `axis_gap_values.csv`: all scored values; `gap_axis_metrics.csv`: cross-budget gap aggregates.",
  "- `metric_dictionary.csv`: definitions, units, and provenance for principal fields.",
  "- `preliminary_analysis.json`: compact structured digest intended for programmatic or LLM use.",
  "- `artifact_manifest.csv`: file sizes and checksums.",
  "",
  "## Non-exhaustive follow-up questions",
  "",
  "These are mining directions, not conclusions:",
  "",
  "- How do phase-specific full/duplicate evaluations relate to score after controlling for budget?",
  "- Which estimator observation trajectories precede accepted repair improvements?",
  "- Which remaining-contact tail depths contribute unique versus duplicate terminal outputs?",
  "- How do release-state distributions interact with impact and amplitude error at specific gaps?",
  "- Do track-shape measurements explain score-neutral differences among the 114 unique outputs?",
  "- Can per-gap repair spend be joined to downstream score change to identify high-return restart anchors?",
  "- Which additional relationships are visible in unnamed arrays or raw nested telemetry not covered by scalar extraction?",
  "",
  "The analysis is deliberately preliminary. The raw files and normalized tables are retained so",
  "future human or agent analysis can extend it without rerunning the sweep."
)
writeLines(report_lines, file.path(sweep_dir, "preliminary_report.md"))

source_commit <- text_value(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
preliminary_digest <- list(
  schema = "line.budget-sweep-preliminary-analysis.v1",
  status = "preliminary_non_exhaustive",
  source = list(
    commit = source_commit,
    spec = "scripts/v0/specs/shelter_impact_sync.ts",
    compiler = "handoff",
    engine = "wasm",
    seed = 0
  ),
  scope = list(
    successful_runs = nrow(runs),
    budget_min = min(runs$budget),
    budget_max = max(runs$budget),
    budget_increment = 100000,
    failure_observed = !is.na(failure_budget),
    first_failed_budget = if (is.na(failure_budget)) NA_real_ else failure_budget,
    endpoint_censored = is.na(failure_budget)
  ),
  caveats = list(
    "One spec, one seed, one engine, and one source commit.",
    "Adjacent budgets are deterministic policy variants, not independent random samples.",
    "The analysis is preliminary and non-exhaustive.",
    "Named scalar fields are dynamically summarized; unnamed arrays remain available in raw JSON.",
    "Associations and fitted slopes are descriptive and do not establish causality."
  ),
  row_counts = list(
    runs = nrow(runs),
    axis_gap_values = nrow(axis_values),
    scalar_metric_values = nrow(scalar_values),
    scalar_metrics = nrow(scalar_metric_summary),
    segments = nrow(segment_values),
    attempts = nrow(attempt_values),
    observations = nrow(observation_values)
  ),
  score = list(
    best_budget = best$budget,
    best_score = best$score,
    runner_up_budget = runner_up$budget,
    runner_up_score = runner_up$score,
    all_contract_passed = all(runs$contract_passed),
    selected_runs = selected_runs[, c(
      "budget", "score", "rolling_best", "axis_error_rms", "elapsed_sec", "contract_passed"
    )]
  ),
  accounting_definition = list(
    first_terminal = "Frame counter when the first terminal traversal is considered.",
    post_completion_frames = "total_spent_frames - first_terminal_total_spent_frames",
    post_completion_share = "post_completion_frames / total_spent_frames",
    maximum_segment_accounting_residual_frames = max(abs(runs$segment_accounting_residual_frames)),
    maximum_first_terminal_counter_delta_frames = max(abs(runs$first_completion_counter_delta))
  ),
  selected_accounting = selected_runs[, c(
    "budget", "hard_budget_frames", "total_spent_frames", "hard_overrun_frames",
    "first_terminal_total_spent_frames", "post_completion_frames", "post_completion_share",
    "repair_attempt_count", "accepted_attempt_improvements"
  )],
  selected_search = selected_runs[, c(
    "budget", "policy_candidate_count", "policy_branch_limit", "candidates_sampled",
    "viable_rate", "search_nodes_expanded", "frontier_max_size", "improvements",
    "full_evaluations", "unique_full_evaluations", "duplicate_full_evaluations",
    "tail_completion_attempts", "tail_completion_improvements"
  )],
  best_axis_metrics = best_axis[, c(
    "axis", "mean_abs", "rms", "max_abs", "bias", "squared_error_share"
  )],
  top_gap_axis_rms = head(hardest, 20),
  further_mining_questions = list(
    "Phase-specific evaluation behavior after controlling for budget.",
    "Estimator observation trajectories preceding accepted repair improvements.",
    "Tail depth versus unique and duplicate terminal outputs.",
    "Release-state distributions versus local impact and amplitude errors.",
    "Track-shape measurements versus score-neutral output differences.",
    "Per-gap repair spend versus downstream score change.",
    "Relationships retained only in raw unnamed arrays and nested telemetry."
  )
)
write_json(
  preliminary_digest,
  file.path(sweep_dir, "preliminary_analysis.json"),
  pretty = TRUE, auto_unbox = TRUE, na = "null", digits = 10
)

analysis_manifest <- list(
  schema = "line.budget-sweep-artifacts.v1",
  generated_at_utc = format(Sys.time(), tz = "UTC", usetz = TRUE),
  source_commit = source_commit,
  command = "Rscript scripts/v0/plot_budget_sweep.R <sweep-dir> [first-failed-budget]",
  status = "preliminary_non_exhaustive",
  raw_file_sets = list(report = nrow(runs), stats = nrow(runs), budget_telemetry = nrow(runs), track = nrow(runs)),
  plots = paste0(names(plots), ".png"),
  combined_plot_pdf = "budget_sweep_plots.pdf",
  primary_report = "preliminary_report.md",
  structured_digest = "preliminary_analysis.json"
)
write_json(
  analysis_manifest,
  file.path(sweep_dir, "analysis_manifest.json"),
  pretty = TRUE, auto_unbox = TRUE, na = "null"
)

manifest_paths <- list.files(sweep_dir, full.names = TRUE, recursive = FALSE)
manifest_paths <- manifest_paths[!grepl("\\.zip$|artifact_manifest\\.csv$", manifest_paths)]
manifest_info <- file.info(manifest_paths)
artifact_manifest <- data.frame(
  file = basename(manifest_paths),
  category = ifelse(
    grepl("^b[0-9]+\\.(report|stats|budget-telemetry|track)\\.json$", basename(manifest_paths)),
    "raw_run_artifact",
    ifelse(grepl("\\.(png|pdf)$", basename(manifest_paths)), "plot", "derived_analysis")
  ),
  bytes = manifest_info$size,
  md5 = unname(tools::md5sum(manifest_paths)),
  stringsAsFactors = FALSE
)
artifact_manifest <- artifact_manifest[order(artifact_manifest$category, artifact_manifest$file), ]
write.csv(artifact_manifest, file.path(sweep_dir, "artifact_manifest.csv"), row.names = FALSE)
