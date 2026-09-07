"""Build a compiler-only cached-prefix fork of the accepted simulation code.

The benchmark engine is untouched. Only Clone implementations and a cache-copy
ABI are added to an isolated copy of the accepted sources. Physical stepping,
collision detection, history invalidation, and metering remain unchanged.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument("--out", required=True)
args = parser.parse_args()
out = Path(args.out).resolve()
out.mkdir(parents=True, exist_ok=True)
if (out / "manifest.json").exists():
    raise ValueError("completed backend exists")
digest = lambda b: hashlib.sha256(b).hexdigest()
archive = Path("benchmark/v2/runs/value-ranked-startup-expiration-compiler-snapshot.tar.gz")
assert digest(archive.read_bytes()) == "cf13ddbeca760f54c60a25e1eb9a8dc235b4c63d5c39bb2f597c82f2fda67a5a"
sources = {}
with tarfile.open(archive) as tar:
    for member in tar.getmembers():
        if member.name.startswith("engine-rs/") and (member.name.endswith(".rs") or member.name.endswith(("Cargo.toml", "Cargo.lock"))):
            relative = member.name.removeprefix("engine-rs/")
            data = tar.extractfile(member).read()
            path = out / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            sources[relative] = digest(data)
for name, declarations in {
    "engine.rs": ["struct Cache {"], "grid.rs": ["pub(crate) struct FlatIntMap<V> {"],
    "frame.rs": ["pub(crate) struct SnapNode {", "pub(crate) struct ActiveCellCache {"],
    "kernel.rs": ["pub(crate) struct LineCellCache {"],
}.items():
    path = out / "src" / name
    source = path.read_text()
    for declaration in declarations:
        assert source.count(declaration) == 1
        source = source.replace(declaration, "#[derive(Clone)]\n" + declaration)
    path.write_text(source)
path = out / "src/engine.rs"
with path.open("a") as stream:
    stream.write('''
/// Copy an already-computed immutable prefix into an independent cache.
/// No call to compute_to or step_state, and no new initial state is supplied.
pub(crate) fn detach(h: u32) -> u32 {
    update_computed(h);
    let (cache, start, start_gen) = {
        let v = ver(h as i32);
        (holders()[v.holder as usize].as_ref().unwrap().cache.clone(), v.start, v.start_gen)
    };
    let holder = if let Some(id) = free_holders().pop() { id } else {
        holders().push(None); (holders().len() - 1) as u32
    };
    let vid = alloc_version(Version { holder, parent: -1, depth: 0,
        patch: Patch::Root, start, start_gen, freed: false });
    holders()[holder as usize] = Some(Holder { cache, current: vid as i32,
        live: 1, version_ids: vec![vid] });
    vid
}
''')
with (out / "src/abi.rs").open("a") as stream:
    stream.write('''
#[no_mangle]
pub extern "C" fn detach_engine(h: u32) -> u32 { engine::detach(h) }
''')
subprocess.run(["cargo", "build", "--release", "--target", "wasm32-unknown-unknown", "--manifest-path", str(out / "Cargo.toml")], check=True)
wrapper_path = Path("scripts/lib/_lr_engine_wasm.ts")
wrapper = wrapper_path.read_text()
wrapper = wrapper.replace('../../engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm', './target/wasm32-unknown-unknown/release/lr_engine.wasm')
wrapper = wrapper.replace("  private h: number;", '''  private h: number;
  detach(): LineRiderEngine { return new LineRiderEngine(ex.detach_engine(this.h)); }
  static retainOnly(engines: readonly LineRiderEngine[]): void {
    const keep = new Set(engines.map(e => e.h));
    for (const registration of LIVE_ENGINES) if (!keep.has(registration.handle)) {
      FINALIZER.unregister(registration); ex.free_engine(registration.handle);
      LIVE_ENGINES.delete(registration);
    }
  }''')
(out / "engine.ts").write_text(wrapper)
generated = {str(p.relative_to(out)): digest(p.read_bytes()) for p in [*sorted((out / "src").glob("*.rs")), out / "engine.ts", out / "target/wasm32-unknown-unknown/release/lr_engine.wasm"]}
manifest = dict(schema="line.planner-cache-backend.v1", researchOnly=True,
    implementation=digest(Path(__file__).read_bytes()), acceptedSources=sources,
    wrapperSource=digest(wrapper_path.read_bytes()), generated=generated,
    note="Exact computed-cache copies only. Final judging uses the unchanged benchmark engine.")
body = json.dumps(manifest, separators=(",", ":")) + "\n"
(out / "manifest.json").write_text(body)
(out / "manifest.json.sha256").write_text(digest(body.encode()) + "\n")
print(json.dumps(manifest))
