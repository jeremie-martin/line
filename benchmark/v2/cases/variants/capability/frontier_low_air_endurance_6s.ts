import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "frontier_low_air_endurance_6s",
  "title": "Frontier Low-Air Endurance, 6 Second Boundary",
  "duration": 63,
  "provenance": {
    "kind": "capability_manual",
    "authoring_brief": "Ordinary supported riding surrounds progressive 2s, 3s, and 5s omissions whose explicit intent is low-air endurance rather than a large jump. Variant: A 6-second supported rideout extends the duration frontier while preserving its surrounding groove and axis progression."
  },
  "primary_family": "low_air_frontier",
  "diagnostic_tags": [
    "capability",
    "low_air",
    "rideout"
  ],
  "pulse_regions": [
    {
      "start": 0.55,
      "end": 60.4,
      "pulse_seconds": 0.55,
      "intent": "ordinary groove frames progressive low-air rideouts"
    }
  ],
  "phases": [
    {
      "id": "control",
      "start": 0,
      "end": 9,
      "intent": "supported ordinary cadence"
    },
    {
      "id": "rideout_2s",
      "start": 9,
      "end": 20,
      "intent": "2s low-air rideout and recovery"
    },
    {
      "id": "rideout_3s",
      "start": 20,
      "end": 34,
      "intent": "3s low-air rideout and recovery"
    },
    {
      "id": "rideout_6s",
      "start": 34,
      "end": 50,
      "intent": "6s low-air rideout and recovery"
    },
    {
      "id": "final_control",
      "start": 50,
      "end": 63,
      "intent": "ordinary cadence after the frontier"
    }
  ],
  "phrases": {
    "groove": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 0.55,
        "role": "support",
        "impact": 0.29
      },
      {
        "offset": 1.1,
        "role": "accent",
        "impact": 0.72
      },
      {
        "offset": 1.65,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 2.2,
        "role": "primary",
        "impact": 0.55
      },
      {
        "offset": 2.75,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 3.3,
        "role": "accent",
        "impact": 0.68
      },
      {
        "offset": 3.85,
        "role": "support",
        "impact": 0.3
      }
    ],
    "ride2": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.62
      },
      {
        "offset": 0.55,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 1.1,
        "role": "accent",
        "impact": 0.76
      },
      {
        "offset": 3.1,
        "role": "breath_exit",
        "impact": 0.88
      },
      {
        "offset": 3.65,
        "role": "reentry",
        "impact": 0.72
      },
      {
        "offset": 4.2,
        "role": "support",
        "impact": 0.31
      }
    ],
    "ride3": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 0.55,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 1.1,
        "role": "accent",
        "impact": 0.78
      },
      {
        "offset": 4.1,
        "role": "breath_exit",
        "impact": 0.9
      },
      {
        "offset": 4.65,
        "role": "reentry",
        "impact": 0.75
      },
      {
        "offset": 5.2,
        "role": "support",
        "impact": 0.32
      }
    ],
    "ride5": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.66
      },
      {
        "offset": 0.55,
        "role": "support",
        "impact": 0.26
      },
      {
        "offset": 1.1,
        "role": "accent",
        "impact": 0.8
      },
      {
        "offset": 7.1,
        "role": "breath_exit",
        "impact": 0.94
      },
      {
        "offset": 7.65,
        "role": "reentry",
        "impact": 0.78
      },
      {
        "offset": 8.2,
        "role": "support",
        "impact": 0.34
      }
    ]
  },
  "placements": [
    {
      "at": 0.55,
      "phrase": "groove"
    },
    {
      "at": 4.95,
      "phrase": "groove"
    },
    {
      "at": 9.35,
      "phrase": "ride2"
    },
    {
      "at": 14.1,
      "phrase": "groove"
    },
    {
      "at": 18.5,
      "phrase": "ride3"
    },
    {
      "at": 24.25,
      "phrase": "groove"
    },
    {
      "at": 28.65,
      "phrase": "groove"
    },
    {
      "at": 33.05,
      "phrase": "ride5"
    },
    {
      "at": 41.8,
      "phrase": "groove"
    },
    {
      "at": 46.2,
      "phrase": "groove"
    },
    {
      "at": 50.6,
      "phrase": "groove"
    },
    {
      "at": 55,
      "phrase": "groove"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.28,
        "ease": "hold",
        "intent": "supported control"
      },
      {
        "t": 10.45,
        "v": 0.05,
        "ease": "hold",
        "intent": "2s rideout stays on line"
      },
      {
        "t": 12.45,
        "v": 0.3,
        "ease": "smooth",
        "intent": "2s recovery"
      },
      {
        "t": 19.6,
        "v": 0.04,
        "ease": "hold",
        "intent": "3s rideout stays on line"
      },
      {
        "t": 22.6,
        "v": 0.31,
        "ease": "smooth",
        "intent": "3s recovery"
      },
      {
        "t": 34.15,
        "v": 0.02,
        "ease": "hold",
        "intent": "6s endurance boundary"
      },
      {
        "t": 40.15,
        "v": 0.32,
        "ease": "smooth",
        "intent": "6s recovery"
      },
      {
        "t": 63,
        "v": 0.34,
        "intent": "ordinary finish"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.62,
        "ease": "smooth",
        "intent": "control"
      },
      {
        "t": 12,
        "v": 0.7,
        "ease": "smooth",
        "intent": "2s rideout"
      },
      {
        "t": 22,
        "v": 0.78,
        "ease": "smooth",
        "intent": "3s rideout"
      },
      {
        "t": 37.57,
        "v": 0.86,
        "ease": "easeOut",
        "intent": "6s rideout at high speed"
      },
      {
        "t": 50,
        "v": 0.68,
        "ease": "smooth",
        "intent": "recovery"
      },
      {
        "t": 63,
        "v": 0.6,
        "intent": "finish"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0
} satisfies BenchmarkScoreDocument;

export const benchmarkCase = defineScoreCase({
  metadata: {
  "cohort": "capability",
  "musicBacked": false,
  "eligibleComponents": [
    "sync",
    "survival",
    "air",
    "speed",
    "impact"
  ],
  "diagnosticComponents": [],
  "id": "frontier_low_air_endurance_6s",
  "title": "Frontier Low-Air Endurance, 6 Second Boundary",
  "originFamily": "low_air_frontier",
  "phases": [
    {
      "id": "control",
      "start": 0,
      "end": 9,
      "intent": "supported ordinary cadence"
    },
    {
      "id": "rideout_2s",
      "start": 9,
      "end": 20,
      "intent": "2s low-air rideout and recovery"
    },
    {
      "id": "rideout_3s",
      "start": 20,
      "end": 34,
      "intent": "3s low-air rideout and recovery"
    },
    {
      "id": "rideout_6s",
      "start": 34,
      "end": 50,
      "intent": "6s low-air rideout and recovery"
    },
    {
      "id": "final_control",
      "start": 50,
      "end": 63,
      "intent": "ordinary cadence after the frontier"
    }
  ],
  "variant": {
    "parentId": "frontier_low_air_endurance",
    "kind": "rideout_duration",
    "rationale": "A 6-second supported rideout extends the duration frontier while preserving its surrounding groove and axis progression.",
    "parameters": {
      "rideout_seconds": 6
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
