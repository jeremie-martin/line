import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "offgrid_conversation_answer_early_25ms",
  "title": "Off-grid Conversation, Earlier Answer",
  "duration": 56,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Two asymmetric phrases answer one another around changing implied pulses without becoming arbitrary timestamp noise. Variant: Only answer phrase placements move by -0.025s; the rest of the musical grid is unchanged."
  },
  "primary_family": "irregular_microtimed",
  "diagnostic_tags": [
    "asymmetric_phrase",
    "offgrid",
    "call_response"
  ],
  "pulse_regions": [
    {
      "start": 0.46,
      "end": 26.4,
      "pulse_seconds": 0.62,
      "intent": "first conversational pocket"
    },
    {
      "start": 26.4,
      "end": 52.8,
      "pulse_seconds": 0.58,
      "intent": "answer tightens without a fixed grid"
    }
  ],
  "phrases": {
    "question": [
      {
        "offset": 0,
        "role": "support",
        "impact": 0.2
      },
      {
        "offset": 0.46,
        "role": "primary",
        "impact": 0.54
      },
      {
        "offset": 1.08,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 1.71,
        "role": "accent",
        "impact": 0.7
      },
      {
        "offset": 2.27,
        "role": "support",
        "impact": 0.32
      },
      {
        "offset": 3.05,
        "role": "primary",
        "impact": 0.6
      },
      {
        "offset": 3.58,
        "role": "pickup",
        "impact": 0.35
      }
    ],
    "answer": [
      {
        "offset": 0,
        "role": "reentry",
        "impact": 0.82
      },
      {
        "offset": 0.71,
        "role": "support",
        "impact": 0.36
      },
      {
        "offset": 1.15,
        "role": "fill",
        "impact": 0.46
      },
      {
        "offset": 1.91,
        "role": "accent",
        "impact": 0.76
      },
      {
        "offset": 2.54,
        "role": "support",
        "impact": 0.39
      },
      {
        "offset": 3.08,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 3.77,
        "role": "support",
        "impact": 0.3
      }
    ],
    "overlap": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.88
      },
      {
        "offset": 0.52,
        "role": "support",
        "impact": 0.33
      },
      {
        "offset": 1.19,
        "role": "primary",
        "impact": 0.59
      },
      {
        "offset": 1.63,
        "role": "pickup",
        "impact": 0.31
      },
      {
        "offset": 2.22,
        "role": "reentry",
        "impact": 0.84
      },
      {
        "offset": 2.97,
        "role": "support",
        "impact": 0.42
      },
      {
        "offset": 3.61,
        "role": "breath_exit",
        "impact": 0.72
      }
    ]
  },
  "placements": [
    {
      "at": 0.46,
      "phrase": "question"
    },
    {
      "at": 4.835,
      "phrase": "answer"
    },
    {
      "at": 9.26,
      "phrase": "question"
    },
    {
      "at": 13.66,
      "phrase": "overlap"
    },
    {
      "at": 18.035,
      "phrase": "answer"
    },
    {
      "at": 22.46,
      "phrase": "question"
    },
    {
      "at": 26.86,
      "phrase": "overlap"
    },
    {
      "at": 31.235,
      "phrase": "answer"
    },
    {
      "at": 35.66,
      "phrase": "question"
    },
    {
      "at": 40.06,
      "phrase": "overlap"
    },
    {
      "at": 44.435,
      "phrase": "answer"
    },
    {
      "at": 48.86,
      "phrase": "question"
    }
  ],
  "events": [
    {
      "t": 53.3,
      "role": "tail",
      "phrase": "closing_reply",
      "impact": 0.42
    },
    {
      "t": 54.18,
      "role": "tail",
      "phrase": "closing_reply",
      "impact": 0.24
    },
    {
      "t": 55.32,
      "role": "tail",
      "phrase": "closing_reply",
      "impact": 0.12
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.5,
        "ease": "smooth",
        "intent": "conversation begins neutral"
      },
      {
        "t": 13,
        "v": 0.62,
        "ease": "smooth",
        "intent": "answers gain room"
      },
      {
        "t": 27,
        "v": 0.48,
        "ease": "smooth",
        "intent": "overlap stays close"
      },
      {
        "t": 42,
        "v": 0.72,
        "ease": "smooth",
        "intent": "late response opens"
      },
      {
        "t": 56,
        "v": 0.54,
        "intent": "closing reply"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.62,
        "ease": "smooth",
        "intent": "question arrives in motion"
      },
      {
        "t": 12,
        "v": 0.46,
        "ease": "smooth",
        "intent": "first answer withdraws"
      },
      {
        "t": 28,
        "v": 0.82,
        "ease": "easeOut",
        "intent": "overlapping exchange"
      },
      {
        "t": 43,
        "v": 0.58,
        "ease": "smooth",
        "intent": "late reply leaves room"
      },
      {
        "t": 56,
        "v": 0.72,
        "intent": "closing reply moves forward"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "question_answer",
      "start": 0,
      "end": 13.66,
      "intent": "question answer"
    },
    {
      "id": "first_overlap",
      "start": 13.66,
      "end": 26.4,
      "intent": "first overlap"
    },
    {
      "id": "tightened_answer",
      "start": 26.4,
      "end": 40.06,
      "intent": "tightened answer"
    },
    {
      "id": "late_overlap",
      "start": 40.06,
      "end": 56,
      "intent": "late overlap"
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
  "id": "offgrid_conversation_answer_early_25ms",
  "title": "Off-grid Conversation, Earlier Answer",
  "originFamily": "irregular_microtimed",
  "phases": [
    {
      "id": "question_answer",
      "start": 0,
      "end": 13.66,
      "intent": "question answer"
    },
    {
      "id": "first_overlap",
      "start": 13.66,
      "end": 26.4,
      "intent": "first overlap"
    },
    {
      "id": "tightened_answer",
      "start": 26.4,
      "end": 40.06,
      "intent": "tightened answer"
    },
    {
      "id": "late_overlap",
      "start": 40.06,
      "end": 56,
      "intent": "late overlap"
    }
  ],
  "variant": {
    "parentId": "offgrid_conversation",
    "kind": "phrase_microtiming",
    "rationale": "Only answer phrase placements move by -0.025s; the rest of the musical grid is unchanged.",
    "parameters": {
      "phrase": "answer",
      "seconds": -0.025
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
