import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "amplitude_tides_restrained_10",
  "title": "Amplitude Tides, Restrained Contrast",
  "duration": 62,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Compact pulses repeatedly open into high-amplitude arcs and settle without coupling amplitude to elevation. Variant: amplitude contrast is scaled by 0.9 around the midpoint; timing remains fixed."
  },
  "primary_family": "spacious_amplitude",
  "diagnostic_tags": [
    "high_amplitude",
    "compact_to_spacious",
    "settle"
  ],
  "pulse_regions": [
    {
      "start": 0.52,
      "end": 55.64,
      "pulse_seconds": 0.52,
      "intent": "compact body with deliberate one- and two-pulse openings"
    }
  ],
  "phrases": {
    "compact": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.6
      },
      {
        "offset": 0.52,
        "role": "support",
        "impact": 0.26
      },
      {
        "offset": 1.04,
        "role": "accent",
        "impact": 0.76
      },
      {
        "offset": 1.56,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 2.08,
        "role": "primary",
        "impact": 0.55
      },
      {
        "offset": 2.6,
        "role": "support",
        "impact": 0.24
      },
      {
        "offset": 3.12,
        "role": "accent",
        "impact": 0.69
      },
      {
        "offset": 3.64,
        "role": "support",
        "impact": 0.34
      }
    ],
    "open": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.82
      },
      {
        "offset": 0.52,
        "role": "support",
        "impact": 0.29
      },
      {
        "offset": 1.56,
        "role": "breath_exit",
        "impact": 0.92
      },
      {
        "offset": 2.08,
        "role": "support",
        "impact": 0.36
      },
      {
        "offset": 3.12,
        "role": "reentry",
        "impact": 0.74
      },
      {
        "offset": 3.64,
        "role": "support",
        "impact": 0.28
      }
    ],
    "wide": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.66
      },
      {
        "offset": 1.04,
        "role": "breath_exit",
        "impact": 0.9
      },
      {
        "offset": 1.56,
        "role": "support",
        "impact": 0.32
      },
      {
        "offset": 2.6,
        "role": "accent",
        "impact": 0.84
      },
      {
        "offset": 3.12,
        "role": "reentry",
        "impact": 0.71
      },
      {
        "offset": 3.64,
        "role": "support",
        "impact": 0.3
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.56
      },
      {
        "offset": 0.52,
        "role": "support",
        "impact": 0.25
      },
      {
        "offset": 1.56,
        "role": "tail",
        "impact": 0.34
      },
      {
        "offset": 2.6,
        "role": "tail",
        "impact": 0.21
      },
      {
        "offset": 4.16,
        "role": "tail",
        "impact": 0.12
      }
    ]
  },
  "placements": [
    {
      "at": 0.52,
      "phrase": "compact"
    },
    {
      "at": 4.68,
      "phrase": "compact"
    },
    {
      "at": 8.84,
      "phrase": "open"
    },
    {
      "at": 13,
      "phrase": "compact"
    },
    {
      "at": 17.16,
      "phrase": "wide"
    },
    {
      "at": 21.32,
      "phrase": "compact"
    },
    {
      "at": 25.48,
      "phrase": "open"
    },
    {
      "at": 29.64,
      "phrase": "compact"
    },
    {
      "at": 33.8,
      "phrase": "wide"
    },
    {
      "at": 37.96,
      "phrase": "compact"
    },
    {
      "at": 42.12,
      "phrase": "open"
    },
    {
      "at": 46.28,
      "phrase": "compact"
    },
    {
      "at": 50.44,
      "phrase": "wide"
    },
    {
      "at": 54.6,
      "phrase": "tail"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.42,
        "ease": "smooth",
        "intent": "compact supported opening"
      },
      {
        "t": 12,
        "v": 0.62,
        "ease": "smooth",
        "intent": "first opening"
      },
      {
        "t": 24,
        "v": 0.48,
        "ease": "smooth",
        "intent": "middle compact return"
      },
      {
        "t": 36,
        "v": 0.72,
        "ease": "easeOut",
        "intent": "broad middle tide"
      },
      {
        "t": 48,
        "v": 0.56,
        "ease": "smooth",
        "intent": "late settle"
      },
      {
        "t": 62,
        "v": 0.68,
        "intent": "open tail"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.7,
        "ease": "smooth",
        "intent": "compact pulse moves"
      },
      {
        "t": 18,
        "v": 0.52,
        "ease": "smooth",
        "intent": "first wide arc relaxes"
      },
      {
        "t": 31,
        "v": 0.82,
        "ease": "smooth",
        "intent": "middle drive"
      },
      {
        "t": 45,
        "v": 0.58,
        "ease": "easeOut",
        "intent": "late opening slows"
      },
      {
        "t": 62,
        "v": 0.66,
        "intent": "tail carries"
      }
    ],
    "amplitude": [
      {
        "t": 0,
        "v": 0.14,
        "ease": "hold",
        "intent": "flat compact body"
      },
      {
        "t": 8.84,
        "v": 0.212,
        "ease": "easeOut",
        "intent": "prepare first opening"
      },
      {
        "t": 10.4,
        "v": 0.842,
        "ease": "smooth",
        "intent": "first high arc"
      },
      {
        "t": 13,
        "v": 0.158,
        "ease": "smooth",
        "intent": "settle"
      },
      {
        "t": 17.16,
        "v": 0.23,
        "ease": "easeOut",
        "intent": "prepare wide tide"
      },
      {
        "t": 18.2,
        "v": 0.905,
        "ease": "smooth",
        "intent": "widest first-half arc"
      },
      {
        "t": 21.32,
        "v": 0.176,
        "ease": "smooth",
        "intent": "compact return"
      },
      {
        "t": 33.8,
        "v": 0.248,
        "ease": "easeOut",
        "intent": "second tide prepares"
      },
      {
        "t": 34.84,
        "v": 0.878,
        "ease": "smooth",
        "intent": "second high arc"
      },
      {
        "t": 37.96,
        "v": 0.149,
        "ease": "smooth",
        "intent": "settle again"
      },
      {
        "t": 50.44,
        "v": 0.266,
        "ease": "easeOut",
        "intent": "final tide prepares"
      },
      {
        "t": 51.48,
        "v": 0.86,
        "ease": "smooth",
        "intent": "final high arc"
      },
      {
        "t": 54.6,
        "v": 0.23,
        "ease": "smooth",
        "intent": "tail settles"
      },
      {
        "t": 62,
        "v": 0.464,
        "intent": "tail opens modestly"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "compact_opening",
      "start": 0,
      "end": 8.84,
      "intent": "compact opening"
    },
    {
      "id": "first_tide",
      "start": 8.84,
      "end": 21.32,
      "intent": "first tide"
    },
    {
      "id": "middle_compact",
      "start": 21.32,
      "end": 33.8,
      "intent": "middle compact"
    },
    {
      "id": "second_tide",
      "start": 33.8,
      "end": 46.28,
      "intent": "second tide"
    },
    {
      "id": "final_tide",
      "start": 46.28,
      "end": 62,
      "intent": "final tide"
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
  "id": "amplitude_tides_restrained_10",
  "title": "Amplitude Tides, Restrained Contrast",
  "originFamily": "spacious_amplitude",
  "phases": [
    {
      "id": "compact_opening",
      "start": 0,
      "end": 8.84,
      "intent": "compact opening"
    },
    {
      "id": "first_tide",
      "start": 8.84,
      "end": 21.32,
      "intent": "first tide"
    },
    {
      "id": "middle_compact",
      "start": 21.32,
      "end": 33.8,
      "intent": "middle compact"
    },
    {
      "id": "second_tide",
      "start": 33.8,
      "end": 46.28,
      "intent": "second tide"
    },
    {
      "id": "final_tide",
      "start": 46.28,
      "end": 62,
      "intent": "final tide"
    }
  ],
  "variant": {
    "parentId": "amplitude_tides",
    "kind": "axis_contrast",
    "rationale": "amplitude contrast is scaled by 0.9 around the midpoint; timing remains fixed.",
    "parameters": {
      "axis": "amplitude",
      "contrast": 0.9
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
