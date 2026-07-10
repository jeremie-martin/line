import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "wide_breaths_air_plus_5",
  "title": "Wide Breaths, Higher Air",
  "duration": 62,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "A spacious ordinary pulse uses selective one- and two-beat omissions for visible arcs, without low-air capability targets. Variant: air is shifted by 0.05 with clamping; rhythm and other authored axes remain fixed."
  },
  "primary_family": "spacious_amplitude",
  "diagnostic_tags": [
    "spacious",
    "amplitude",
    "ordinary_arc"
  ],
  "pulse_regions": [
    {
      "start": 0.69,
      "end": 55.2,
      "pulse_seconds": 0.69,
      "intent": "spacious pulse with phrase-level omissions"
    }
  ],
  "phrases": {
    "groove": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.62
      },
      {
        "offset": 0.69,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 1.38,
        "role": "accent",
        "impact": 0.71
      },
      {
        "offset": 2.07,
        "role": "support",
        "impact": 0.35
      },
      {
        "offset": 2.76,
        "role": "primary",
        "impact": 0.57
      },
      {
        "offset": 3.45,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 4.14,
        "role": "accent",
        "impact": 0.68
      },
      {
        "offset": 4.83,
        "role": "support",
        "impact": 0.32
      }
    ],
    "single_breath": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.74
      },
      {
        "offset": 0.69,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 1.38,
        "role": "primary",
        "impact": 0.59
      },
      {
        "offset": 2.76,
        "role": "breath_exit",
        "impact": 0.86
      },
      {
        "offset": 3.45,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 4.14,
        "role": "reentry",
        "impact": 0.7
      }
    ],
    "double_breath": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 0.69,
        "role": "support",
        "impact": 0.29
      },
      {
        "offset": 2.07,
        "role": "breath_exit",
        "impact": 0.9
      },
      {
        "offset": 2.76,
        "role": "support",
        "impact": 0.36
      },
      {
        "offset": 4.14,
        "role": "accent",
        "impact": 0.78
      },
      {
        "offset": 4.83,
        "role": "reentry",
        "impact": 0.72
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 0.69,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 1.38,
        "role": "tail",
        "impact": 0.24
      },
      {
        "offset": 2.76,
        "role": "tail",
        "impact": 0.19
      },
      {
        "offset": 4.14,
        "role": "tail",
        "impact": 0.14
      },
      {
        "offset": 5.52,
        "role": "tail",
        "impact": 0.09
      }
    ]
  },
  "placements": [
    {
      "at": 0.69,
      "phrase": "groove"
    },
    {
      "at": 6.21,
      "phrase": "groove"
    },
    {
      "at": 11.73,
      "phrase": "groove"
    },
    {
      "at": 17.25,
      "phrase": "single_breath"
    },
    {
      "at": 22.08,
      "phrase": "groove"
    },
    {
      "at": 27.6,
      "phrase": "groove"
    },
    {
      "at": 33.12,
      "phrase": "groove"
    },
    {
      "at": 38.64,
      "phrase": "double_breath"
    },
    {
      "at": 44.16,
      "phrase": "groove"
    },
    {
      "at": 49.68,
      "phrase": "groove"
    },
    {
      "at": 55.2,
      "phrase": "tail"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.49,
        "ease": "smooth",
        "intent": "ordinary supported pulse"
      },
      {
        "t": 16,
        "v": 0.63,
        "ease": "smooth",
        "intent": "first breath opens"
      },
      {
        "t": 31,
        "v": 0.71,
        "ease": "smooth",
        "intent": "middle groove has room"
      },
      {
        "t": 43,
        "v": 0.67,
        "ease": "smooth",
        "intent": "double breath remains an arc"
      },
      {
        "t": 55,
        "v": 0.77,
        "ease": "smooth",
        "intent": "tail floats"
      },
      {
        "t": 62,
        "v": 0.59,
        "intent": "finish"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.62,
        "ease": "smooth",
        "intent": "spacious opening already moves"
      },
      {
        "t": 15,
        "v": 0.48,
        "ease": "smooth",
        "intent": "first breath relaxes"
      },
      {
        "t": 31,
        "v": 0.74,
        "ease": "smooth",
        "intent": "middle body"
      },
      {
        "t": 45,
        "v": 0.6,
        "ease": "easeOut",
        "intent": "double breath slows"
      },
      {
        "t": 62,
        "v": 0.52,
        "intent": "release"
      }
    ],
    "amplitude": [
      {
        "t": 0,
        "v": 0.18,
        "ease": "smooth",
        "intent": "groove restrained"
      },
      {
        "t": 16.5,
        "v": 0.2,
        "ease": "easeOut",
        "intent": "prepare first breath"
      },
      {
        "t": 20.01,
        "v": 0.62,
        "ease": "smooth",
        "intent": "first breath arc"
      },
      {
        "t": 22.08,
        "v": 0.16,
        "ease": "smooth",
        "intent": "return to groove"
      },
      {
        "t": 38.64,
        "v": 0.22,
        "ease": "easeOut",
        "intent": "prepare double breath"
      },
      {
        "t": 42.78,
        "v": 0.78,
        "ease": "smooth",
        "intent": "widest ordinary arc"
      },
      {
        "t": 44.16,
        "v": 0.17,
        "ease": "smooth",
        "intent": "late groove restrained"
      },
      {
        "t": 57.96,
        "v": 0.56,
        "ease": "smooth",
        "intent": "tail opening"
      },
      {
        "t": 62,
        "v": 0.3,
        "intent": "finish"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "opening_groove",
      "start": 0,
      "end": 17.25,
      "intent": "opening groove"
    },
    {
      "id": "single_breath",
      "start": 17.25,
      "end": 22.08,
      "intent": "single breath"
    },
    {
      "id": "middle_groove",
      "start": 22.08,
      "end": 38.64,
      "intent": "middle groove"
    },
    {
      "id": "double_breath",
      "start": 38.64,
      "end": 44.16,
      "intent": "double breath"
    },
    {
      "id": "late_groove",
      "start": 44.16,
      "end": 62,
      "intent": "late groove"
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
  "id": "wide_breaths_air_plus_5",
  "title": "Wide Breaths, Higher Air",
  "originFamily": "spacious_amplitude",
  "phases": [
    {
      "id": "opening_groove",
      "start": 0,
      "end": 17.25,
      "intent": "opening groove"
    },
    {
      "id": "single_breath",
      "start": 17.25,
      "end": 22.08,
      "intent": "single breath"
    },
    {
      "id": "middle_groove",
      "start": 22.08,
      "end": 38.64,
      "intent": "middle groove"
    },
    {
      "id": "double_breath",
      "start": 38.64,
      "end": 44.16,
      "intent": "double breath"
    },
    {
      "id": "late_groove",
      "start": 44.16,
      "end": 62,
      "intent": "late groove"
    }
  ],
  "variant": {
    "parentId": "wide_breaths",
    "kind": "axis_offset",
    "rationale": "air is shifted by 0.05 with clamping; rhythm and other authored axes remain fixed.",
    "parameters": {
      "axis": "air",
      "offset": 0.05
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
