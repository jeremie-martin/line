import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "split_signal",
  "title": "Split Signal",
  "duration": 60,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Primary-pulse hooks alternate with bounded half-pulse answers and a quiet amplitude response."
  },
  "primary_family": "subdivision_pickup",
  "diagnostic_tags": [
    "half_pulse",
    "density_change",
    "amplitude"
  ],
  "pulse_regions": [
    {
      "start": 0,
      "end": 10.66,
      "pulse_seconds": 0.82,
      "intent": "primary signal"
    },
    {
      "start": 10.66,
      "end": 18.86,
      "pulse_seconds": 0.41,
      "intent": "bounded half-pulse answer"
    },
    {
      "start": 18.86,
      "end": 28.7,
      "pulse_seconds": 0.82,
      "intent": "primary hook returns"
    },
    {
      "start": 28.7,
      "end": 36.9,
      "pulse_seconds": 0.41,
      "intent": "second dense answer"
    },
    {
      "start": 36.9,
      "end": 46.74,
      "pulse_seconds": 0.82,
      "intent": "open primary signal"
    },
    {
      "start": 46.74,
      "end": 51.25,
      "pulse_seconds": 0.41,
      "intent": "final compact answer"
    }
  ],
  "phrases": {
    "primary_a": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.7
      },
      {
        "offset": 0.82,
        "role": "support",
        "impact": 0.32
      },
      {
        "offset": 1.64,
        "role": "accent",
        "impact": 0.76
      },
      {
        "offset": 2.46,
        "role": "support",
        "impact": 0.4
      },
      {
        "offset": 3.28,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 4.1,
        "role": "reentry",
        "impact": 0.84
      }
    ],
    "dense_a": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.79
      },
      {
        "offset": 0.41,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 0.82,
        "role": "primary",
        "impact": 0.61
      },
      {
        "offset": 1.23,
        "role": "support",
        "impact": 0.29
      },
      {
        "offset": 1.64,
        "role": "accent",
        "impact": 0.72
      },
      {
        "offset": 2.05,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 2.46,
        "role": "primary",
        "impact": 0.56
      },
      {
        "offset": 2.87,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 3.28,
        "role": "accent",
        "impact": 0.68
      },
      {
        "offset": 3.69,
        "role": "breath_exit",
        "impact": 0.88
      }
    ],
    "primary_b": [
      {
        "offset": 0,
        "role": "reentry",
        "impact": 0.91
      },
      {
        "offset": 0.82,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 1.64,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 2.46,
        "role": "accent",
        "impact": 0.81
      },
      {
        "offset": 3.28,
        "role": "support",
        "impact": 0.43
      },
      {
        "offset": 4.1,
        "role": "primary",
        "impact": 0.69
      }
    ],
    "dense_b": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.85
      },
      {
        "offset": 0.41,
        "role": "support",
        "impact": 0.41
      },
      {
        "offset": 0.82,
        "role": "primary",
        "impact": 0.66
      },
      {
        "offset": 1.23,
        "role": "support",
        "impact": 0.33
      },
      {
        "offset": 1.64,
        "role": "fill",
        "impact": 0.55
      },
      {
        "offset": 2.05,
        "role": "accent",
        "impact": 0.75
      },
      {
        "offset": 2.46,
        "role": "support",
        "impact": 0.37
      },
      {
        "offset": 2.87,
        "role": "primary",
        "impact": 0.62
      },
      {
        "offset": 3.28,
        "role": "support",
        "impact": 0.35
      },
      {
        "offset": 3.69,
        "role": "reentry",
        "impact": 0.9
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.62
      },
      {
        "offset": 0.82,
        "role": "support",
        "impact": 0.33
      },
      {
        "offset": 1.64,
        "role": "tail",
        "impact": 0.27
      },
      {
        "offset": 2.87,
        "role": "tail",
        "impact": 0.2
      },
      {
        "offset": 4.1,
        "role": "tail",
        "impact": 0.15
      },
      {
        "offset": 5.74,
        "role": "tail",
        "impact": 0.1
      }
    ]
  },
  "placements": [
    {
      "at": 0.82,
      "phrase": "primary_a"
    },
    {
      "at": 5.74,
      "phrase": "primary_a"
    },
    {
      "at": 10.66,
      "phrase": "dense_a"
    },
    {
      "at": 14.76,
      "phrase": "dense_a"
    },
    {
      "at": 18.86,
      "phrase": "primary_b"
    },
    {
      "at": 23.78,
      "phrase": "primary_b"
    },
    {
      "at": 28.7,
      "phrase": "dense_b"
    },
    {
      "at": 32.8,
      "phrase": "dense_b"
    },
    {
      "at": 36.9,
      "phrase": "primary_b"
    },
    {
      "at": 41.82,
      "phrase": "primary_b"
    },
    {
      "at": 46.74,
      "phrase": "dense_b"
    },
    {
      "at": 51.25,
      "phrase": "tail"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.42,
        "ease": "smooth",
        "intent": "primary signal begins supported"
      },
      {
        "t": 10.66,
        "v": 0.6,
        "ease": "smooth",
        "intent": "dense answer has moderate air"
      },
      {
        "t": 18.86,
        "v": 0.7,
        "ease": "smooth",
        "intent": "open hook"
      },
      {
        "t": 32.8,
        "v": 0.58,
        "ease": "smooth",
        "intent": "second dense answer controlled"
      },
      {
        "t": 44,
        "v": 0.74,
        "ease": "smooth",
        "intent": "last hook opens"
      },
      {
        "t": 60,
        "v": 0.5,
        "intent": "tail settles"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.66,
        "ease": "smooth",
        "intent": "confident primary"
      },
      {
        "t": 12,
        "v": 0.58,
        "ease": "smooth",
        "intent": "first dense answer tightens"
      },
      {
        "t": 25,
        "v": 0.82,
        "ease": "smooth",
        "intent": "middle hook surges"
      },
      {
        "t": 36,
        "v": 0.68,
        "ease": "easeOut",
        "intent": "density crest stays controlled"
      },
      {
        "t": 48,
        "v": 0.8,
        "ease": "smooth",
        "intent": "final answer regains pace"
      },
      {
        "t": 60,
        "v": 0.54,
        "intent": "release"
      }
    ],
    "amplitude": [
      {
        "t": 0,
        "v": 0.36,
        "ease": "smooth",
        "intent": "primary beats have visible room"
      },
      {
        "t": 10.66,
        "v": 0.1,
        "ease": "smooth",
        "intent": "dense answer stays compact"
      },
      {
        "t": 18.86,
        "v": 0.5,
        "ease": "smooth",
        "intent": "hook opens"
      },
      {
        "t": 28.7,
        "v": 0.09,
        "ease": "smooth",
        "intent": "second answer compact"
      },
      {
        "t": 36.9,
        "v": 0.58,
        "ease": "smooth",
        "intent": "final hook widest"
      },
      {
        "t": 46.74,
        "v": 0.12,
        "ease": "smooth",
        "intent": "last dense phrase"
      },
      {
        "t": 60,
        "v": 0.28,
        "intent": "tail"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "primary_open",
      "start": 0,
      "end": 10.66,
      "intent": "primary open"
    },
    {
      "id": "dense_answer_one",
      "start": 10.66,
      "end": 18.86,
      "intent": "dense answer one"
    },
    {
      "id": "primary_return",
      "start": 18.86,
      "end": 28.7,
      "intent": "primary return"
    },
    {
      "id": "dense_answer_two",
      "start": 28.7,
      "end": 36.9,
      "intent": "dense answer two"
    },
    {
      "id": "open_signal",
      "start": 36.9,
      "end": 46.74,
      "intent": "open signal"
    },
    {
      "id": "tail_answer",
      "start": 46.74,
      "end": 60,
      "intent": "tail answer"
    }
  ]
} as const satisfies BenchmarkScoreDocument;

export const benchmarkCase = defineScoreCase({
  metadata: {
  "cohort": "representative",
  "musicBacked": false,
  "eligibleComponents": [
    "sync",
    "survival",
    "air",
    "speed",
    "amplitude",
    "impact"
  ],
  "diagnosticComponents": []
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
