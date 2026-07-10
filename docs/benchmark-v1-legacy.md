# Benchmark V1 Legacy Workflow

Benchmark V1 is retained for historical reproduction only. It is not the default,
does not share V2 membership or score identity, and must not be mixed into V2 candidate
decisions.

```bash
npm run benchmark:v1 -- --probe
npm run benchmark:v1 -- --full
```

`npm run golden:v1` is an equivalent explicit alias. The historical 40-case inventory
and audit are preserved under `benchmark/v1-audit/`; V2 regression cases reuse only
manually recomposed mechanisms, never V1 membership or weight.
