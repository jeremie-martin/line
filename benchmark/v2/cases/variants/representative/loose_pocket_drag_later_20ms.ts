import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "loose_pocket_drag_later_20ms",
  "title": "Loose Pocket, Later Drag",
  "duration": 56,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Played timing moves around a stable pocket in recurring phrases whose offsets remain intentional after frame quantization. Variant: Only drag phrase placements move by 0.02s; the rest of the musical grid is unchanged."
  },
  "primary_family": "irregular_microtimed",
  "diagnostic_tags": [
    "microtiming",
    "pocket",
    "frame_quantization"
  ],
  "pulse_regions": [
    {
      "start": 0.53,
      "end": 55.27,
      "pulse_seconds": 0.53,
      "intent": "played pocket with phrase-specific push and drag"
    }
  ],
  "phrases": {
    "push": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.66
      },
      {
        "offset": 0.548,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 1.046,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 1.598,
        "role": "support",
        "impact": 0.39
      },
      {
        "offset": 2.102,
        "role": "accent",
        "impact": 0.8
      },
      {
        "offset": 2.648,
        "role": "support",
        "impact": 0.42
      },
      {
        "offset": 3.154,
        "role": "primary",
        "impact": 0.61
      },
      {
        "offset": 3.722,
        "role": "support",
        "impact": 0.36
      }
    ],
    "drag": [
      {
        "offset": 0,
        "role": "reentry",
        "impact": 0.78
      },
      {
        "offset": 0.506,
        "role": "support",
        "impact": 0.37
      },
      {
        "offset": 1.072,
        "role": "primary",
        "impact": 0.63
      },
      {
        "offset": 1.574,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 2.128,
        "role": "accent",
        "impact": 0.84
      },
      {
        "offset": 2.632,
        "role": "support",
        "impact": 0.45
      },
      {
        "offset": 3.188,
        "role": "primary",
        "impact": 0.57
      },
      {
        "offset": 3.714,
        "role": "support",
        "impact": 0.33
      }
    ],
    "turn": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.86
      },
      {
        "offset": 0.522,
        "role": "support",
        "impact": 0.4
      },
      {
        "offset": 1.084,
        "role": "fill",
        "impact": 0.54
      },
      {
        "offset": 1.576,
        "role": "support",
        "impact": 0.35
      },
      {
        "offset": 2.116,
        "role": "primary",
        "impact": 0.67
      },
      {
        "offset": 2.674,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 3.166,
        "role": "accent",
        "impact": 0.74
      },
      {
        "offset": 3.734,
        "role": "breath_exit",
        "impact": 0.9
      }
    ]
  },
  "placements": [
    {
      "at": 0.53,
      "phrase": "push"
    },
    {
      "at": 4.8,
      "phrase": "drag"
    },
    {
      "at": 9.03,
      "phrase": "push"
    },
    {
      "at": 13.28,
      "phrase": "turn"
    },
    {
      "at": 17.55,
      "phrase": "drag"
    },
    {
      "at": 21.78,
      "phrase": "push"
    },
    {
      "at": 26.03,
      "phrase": "turn"
    },
    {
      "at": 30.28,
      "phrase": "push"
    },
    {
      "at": 34.55,
      "phrase": "drag"
    },
    {
      "at": 38.78,
      "phrase": "turn"
    },
    {
      "at": 43.05,
      "phrase": "drag"
    },
    {
      "at": 47.28,
      "phrase": "push"
    },
    {
      "at": 51.53,
      "phrase": "turn"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.44,
        "ease": "smooth",
        "intent": "pocket begins close"
      },
      {
        "t": 11,
        "v": 0.6,
        "ease": "smooth",
        "intent": "phrases gain air slowly"
      },
      {
        "t": 25,
        "v": 0.54,
        "ease": "smooth",
        "intent": "middle turn controlled"
      },
      {
        "t": 39,
        "v": 0.7,
        "ease": "smooth",
        "intent": "late pocket opens"
      },
      {
        "t": 56,
        "v": 0.5,
        "intent": "finish supported"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.68,
        "ease": "smooth",
        "intent": "enter inside the pocket"
      },
      {
        "t": 10,
        "v": 0.56,
        "ease": "smooth",
        "intent": "first drag relaxes"
      },
      {
        "t": 24,
        "v": 0.78,
        "ease": "smooth",
        "intent": "middle drive"
      },
      {
        "t": 38,
        "v": 0.64,
        "ease": "easeOut",
        "intent": "late drag settles"
      },
      {
        "t": 48,
        "v": 0.8,
        "ease": "smooth",
        "intent": "last push"
      },
      {
        "t": 56,
        "v": 0.58,
        "intent": "finish"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "push_drag_one",
      "start": 0,
      "end": 13.28,
      "intent": "push drag one"
    },
    {
      "id": "turn_one",
      "start": 13.28,
      "end": 26.03,
      "intent": "turn one"
    },
    {
      "id": "middle_pocket",
      "start": 26.03,
      "end": 38.78,
      "intent": "middle pocket"
    },
    {
      "id": "late_turn",
      "start": 38.78,
      "end": 51.53,
      "intent": "late turn"
    },
    {
      "id": "release",
      "start": 51.53,
      "end": 56,
      "intent": "release"
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
  "id": "loose_pocket_drag_later_20ms",
  "title": "Loose Pocket, Later Drag",
  "originFamily": "irregular_microtimed",
  "phases": [
    {
      "id": "push_drag_one",
      "start": 0,
      "end": 13.28,
      "intent": "push drag one"
    },
    {
      "id": "turn_one",
      "start": 13.28,
      "end": 26.03,
      "intent": "turn one"
    },
    {
      "id": "middle_pocket",
      "start": 26.03,
      "end": 38.78,
      "intent": "middle pocket"
    },
    {
      "id": "late_turn",
      "start": 38.78,
      "end": 51.53,
      "intent": "late turn"
    },
    {
      "id": "release",
      "start": 51.53,
      "end": 56,
      "intent": "release"
    }
  ],
  "variant": {
    "parentId": "loose_pocket",
    "kind": "phrase_microtiming",
    "rationale": "Only drag phrase placements move by 0.02s; the rest of the musical grid is unchanged.",
    "parameters": {
      "phrase": "drag",
      "seconds": 0.02
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
