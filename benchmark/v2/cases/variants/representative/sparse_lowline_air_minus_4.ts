import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "sparse_lowline_air_minus_4",
  "title": "Sparse Lowline, Lower Omissions",
  "duration": 60,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "A regular supported pulse opens into isolated 1.2-1.9s low-air omissions, with speed and impact preserved through each return. Variant: air is shifted by -0.04 with clamping; rhythm and other authored axes remain fixed."
  },
  "primary_family": "sparse_transition",
  "diagnostic_tags": [
    "sparse",
    "low_air",
    "reentry"
  ],
  "pulse_regions": [
    {
      "start": 0.62,
      "end": 53.94,
      "pulse_seconds": 0.62,
      "intent": "supported pulse with deliberate omissions"
    }
  ],
  "phrases": {
    "grounded": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 0.62,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 1.24,
        "role": "accent",
        "impact": 0.73
      },
      {
        "offset": 1.86,
        "role": "support",
        "impact": 0.33
      },
      {
        "offset": 2.48,
        "role": "primary",
        "impact": 0.54
      },
      {
        "offset": 3.1,
        "role": "support",
        "impact": 0.26
      },
      {
        "offset": 3.72,
        "role": "accent",
        "impact": 0.69
      }
    ],
    "single_open": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.62
      },
      {
        "offset": 0.62,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 1.86,
        "role": "breath_exit",
        "impact": 0.88
      },
      {
        "offset": 2.48,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 3.1,
        "role": "reentry",
        "impact": 0.76
      },
      {
        "offset": 3.72,
        "role": "support",
        "impact": 0.29
      }
    ],
    "double_open": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.78
      },
      {
        "offset": 0.62,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 2.48,
        "role": "breath_exit",
        "impact": 0.92
      },
      {
        "offset": 3.1,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 3.72,
        "role": "reentry",
        "impact": 0.81
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.52
      },
      {
        "offset": 0.62,
        "role": "support",
        "impact": 0.25
      },
      {
        "offset": 1.86,
        "role": "tail",
        "impact": 0.3
      },
      {
        "offset": 3.1,
        "role": "tail",
        "impact": 0.18
      },
      {
        "offset": 4.96,
        "role": "tail",
        "impact": 0.1
      }
    ]
  },
  "placements": [
    {
      "at": 0.62,
      "phrase": "grounded"
    },
    {
      "at": 4.96,
      "phrase": "grounded"
    },
    {
      "at": 9.3,
      "phrase": "single_open"
    },
    {
      "at": 13.64,
      "phrase": "grounded"
    },
    {
      "at": 17.98,
      "phrase": "double_open"
    },
    {
      "at": 22.32,
      "phrase": "grounded"
    },
    {
      "at": 26.66,
      "phrase": "single_open"
    },
    {
      "at": 31,
      "phrase": "grounded"
    },
    {
      "at": 35.34,
      "phrase": "double_open"
    },
    {
      "at": 39.68,
      "phrase": "grounded"
    },
    {
      "at": 44.02,
      "phrase": "single_open"
    },
    {
      "at": 48.36,
      "phrase": "grounded"
    },
    {
      "at": 52.7,
      "phrase": "tail"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.26,
        "ease": "smooth",
        "intent": "supported opening"
      },
      {
        "t": 9.3,
        "v": 0.2,
        "ease": "easeOut",
        "intent": "prepare first omission"
      },
      {
        "t": 11.16,
        "v": 0.06,
        "ease": "smooth",
        "intent": "ride through single opening"
      },
      {
        "t": 13.64,
        "v": 0.3,
        "ease": "smooth",
        "intent": "return"
      },
      {
        "t": 17.98,
        "v": 0.16,
        "ease": "easeOut",
        "intent": "prepare wider omission"
      },
      {
        "t": 20.46,
        "v": 0.02,
        "ease": "smooth",
        "intent": "low-air 1.86s passage"
      },
      {
        "t": 22.32,
        "v": 0.28,
        "ease": "smooth",
        "intent": "supported reentry"
      },
      {
        "t": 35.34,
        "v": 0.14,
        "ease": "easeOut",
        "intent": "second wide omission"
      },
      {
        "t": 37.82,
        "v": 0.01,
        "ease": "smooth",
        "intent": "second low-air passage"
      },
      {
        "t": 39.68,
        "v": 0.32,
        "ease": "smooth",
        "intent": "late return"
      },
      {
        "t": 60,
        "v": 0.24,
        "intent": "tail stays supported"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.54,
        "ease": "smooth",
        "intent": "measured supported pulse"
      },
      {
        "t": 18,
        "v": 0.76,
        "ease": "smooth",
        "intent": "first wide passage carries speed"
      },
      {
        "t": 30,
        "v": 0.68,
        "ease": "smooth",
        "intent": "middle reset"
      },
      {
        "t": 38,
        "v": 0.84,
        "ease": "easeOut",
        "intent": "second passage is faster"
      },
      {
        "t": 60,
        "v": 0.6,
        "intent": "tail release"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "supported_opening",
      "start": 0,
      "end": 9.3,
      "intent": "supported opening"
    },
    {
      "id": "first_omissions",
      "start": 9.3,
      "end": 22.32,
      "intent": "first omissions"
    },
    {
      "id": "middle_support",
      "start": 22.32,
      "end": 35.34,
      "intent": "middle support"
    },
    {
      "id": "second_omissions",
      "start": 35.34,
      "end": 48.36,
      "intent": "second omissions"
    },
    {
      "id": "tail",
      "start": 48.36,
      "end": 60,
      "intent": "tail"
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
    "impact"
  ],
  "diagnosticComponents": [],
  "id": "sparse_lowline_air_minus_4",
  "title": "Sparse Lowline, Lower Omissions",
  "originFamily": "sparse_transition",
  "phases": [
    {
      "id": "supported_opening",
      "start": 0,
      "end": 9.3,
      "intent": "supported opening"
    },
    {
      "id": "first_omissions",
      "start": 9.3,
      "end": 22.32,
      "intent": "first omissions"
    },
    {
      "id": "middle_support",
      "start": 22.32,
      "end": 35.34,
      "intent": "middle support"
    },
    {
      "id": "second_omissions",
      "start": 35.34,
      "end": 48.36,
      "intent": "second omissions"
    },
    {
      "id": "tail",
      "start": 48.36,
      "end": 60,
      "intent": "tail"
    }
  ],
  "variant": {
    "parentId": "sparse_lowline",
    "kind": "axis_offset",
    "rationale": "air is shifted by -0.04 with clamping; rhythm and other authored axes remain fixed.",
    "parameters": {
      "axis": "air",
      "offset": -0.04
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
