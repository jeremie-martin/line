import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "split_signal_impact_relief_12",
  "title": "Split Signal, Softer Impact Contrast",
  "duration": 60,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Primary-pulse hooks alternate with bounded half-pulse answers and a quiet amplitude response. Variant: Impact contrast is scaled by 0.88 around the neutral midpoint without changing rhythm."
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
        "impact": 0.676
      },
      {
        "offset": 0.82,
        "role": "support",
        "impact": 0.3416
      },
      {
        "offset": 1.64,
        "role": "accent",
        "impact": 0.7288
      },
      {
        "offset": 2.46,
        "role": "support",
        "impact": 0.412
      },
      {
        "offset": 3.28,
        "role": "primary",
        "impact": 0.5704
      },
      {
        "offset": 4.1,
        "role": "reentry",
        "impact": 0.7992
      }
    ],
    "dense_a": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.7552
      },
      {
        "offset": 0.41,
        "role": "support",
        "impact": 0.3592
      },
      {
        "offset": 0.82,
        "role": "primary",
        "impact": 0.5968
      },
      {
        "offset": 1.23,
        "role": "support",
        "impact": 0.3152
      },
      {
        "offset": 1.64,
        "role": "accent",
        "impact": 0.6936
      },
      {
        "offset": 2.05,
        "role": "support",
        "impact": 0.3944
      },
      {
        "offset": 2.46,
        "role": "primary",
        "impact": 0.5528
      },
      {
        "offset": 2.87,
        "role": "support",
        "impact": 0.3328
      },
      {
        "offset": 3.28,
        "role": "accent",
        "impact": 0.6584
      },
      {
        "offset": 3.69,
        "role": "breath_exit",
        "impact": 0.8344
      }
    ],
    "primary_b": [
      {
        "offset": 0,
        "role": "reentry",
        "impact": 0.8608
      },
      {
        "offset": 0.82,
        "role": "support",
        "impact": 0.3944
      },
      {
        "offset": 1.64,
        "role": "primary",
        "impact": 0.6232
      },
      {
        "offset": 2.46,
        "role": "accent",
        "impact": 0.7728
      },
      {
        "offset": 3.28,
        "role": "support",
        "impact": 0.4384
      },
      {
        "offset": 4.1,
        "role": "primary",
        "impact": 0.6672
      }
    ],
    "dense_b": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.808
      },
      {
        "offset": 0.41,
        "role": "support",
        "impact": 0.4208
      },
      {
        "offset": 0.82,
        "role": "primary",
        "impact": 0.6408
      },
      {
        "offset": 1.23,
        "role": "support",
        "impact": 0.3504
      },
      {
        "offset": 1.64,
        "role": "fill",
        "impact": 0.544
      },
      {
        "offset": 2.05,
        "role": "accent",
        "impact": 0.72
      },
      {
        "offset": 2.46,
        "role": "support",
        "impact": 0.3856
      },
      {
        "offset": 2.87,
        "role": "primary",
        "impact": 0.6056
      },
      {
        "offset": 3.28,
        "role": "support",
        "impact": 0.368
      },
      {
        "offset": 3.69,
        "role": "reentry",
        "impact": 0.852
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.6056
      },
      {
        "offset": 0.82,
        "role": "support",
        "impact": 0.3504
      },
      {
        "offset": 1.64,
        "role": "tail",
        "impact": 0.2976
      },
      {
        "offset": 2.87,
        "role": "tail",
        "impact": 0.236
      },
      {
        "offset": 4.1,
        "role": "tail",
        "impact": 0.192
      },
      {
        "offset": 5.74,
        "role": "tail",
        "impact": 0.148
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
} satisfies BenchmarkScoreDocument;

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
  "diagnosticComponents": [],
  "id": "split_signal_impact_relief_12",
  "title": "Split Signal, Softer Impact Contrast",
  "originFamily": "subdivision_pickup",
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
  ],
  "variant": {
    "parentId": "split_signal",
    "kind": "impact_contrast",
    "rationale": "Impact contrast is scaled by 0.88 around the neutral midpoint without changing rhythm.",
    "parameters": {
      "contrast": 0.88
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
