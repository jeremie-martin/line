import classicRiderBody from './rider-data'
import * as States from './states'
import * as Constraints from './constraints'
import V2 from '../v2'

function createConstraintFromJson (data, initialStateMap) {
  return new Constraints[data.type](data, initialStateMap)
}

function createStateFromJson (data, init) {
  return new States[data.type](data, init)
}

function averageVectors (vecs) {
  return vecs.reduce((avg, v) => avg.add(v), V2({x: 0, y: 0})).div(vecs.length)
}

// The cosmetic scarf is the set of points that live ONLY in parts.SCARF (i.e.
// parts.SCARF minus its shared SHOULDER anchor). Deriving the set from the
// authoritative parts map is more robust than keying on a class type
// ('FlutterPoint'/'DirectedChain'), which would silently mis-handle a rider body
// that implements the scarf differently or reuses those types elsewhere.
function scarfStateIds (body) {
  let parts = body.parts || {}
  let elsewhere = new Set()
  for (let name in parts) {
    if (name === 'SCARF') continue
    for (let id of parts[name]) elsewhere.add(id)
  }
  return new Set((parts.SCARF || []).filter((id) => !elsewhere.has(id)))
}

// All state ids a constraint references (so we can detect any cross-link to a
// removed scarf point regardless of constraint shape).
function constraintStateRefs (c) {
  let refs = []
  for (let key of ['p1', 'p2', 'q1', 'q2', 'binding']) {
    if (c[key] != null) refs.push(c[key])
  }
  if (Array.isArray(c.ps)) refs.push(...c.ps)
  return refs
}

export default class Rider {
  constructor (riderBody = classicRiderBody) {
    // TODO: validate riderBody
    this.body = riderBody
    // Drop the cosmetic scarf from the simulated rider. The scarf is a one-way
    // follower (anchored at SHOULDER) that never feeds back into the body — no
    // kept part or constraint references a scarf point, the chain only *writes*
    // the scarf, the points are non-collidable, and the compiler never reads
    // them. Removing it eliminates the engine's only transcendental math
    // (sin/cos/expm1/pow) and 7 stepped points + a chain resolve every frame,
    // with zero effect on the body trajectory or collisions. (A renderer would
    // need the scarf; this vendored engine is compiler-only.)
    this.scarfIds = scarfStateIds(this.body)
    let constraintData = this.body.constraints.filter(
      (c) => !constraintStateRefs(c).some((id) => this.scarfIds.has(id))
    )
    // Guard the load-bearing invariant that nothing simulated still depends on a
    // removed point — otherwise createConstraintFromJson would resolve against an
    // absent state and diverge silently.
    let keptIds = new Set(this.body.states.filter((s) => !this.scarfIds.has(s.id)).map((s) => s.id))
    for (let c of constraintData) {
      for (let ref of constraintStateRefs(c)) {
        if (!keptIds.has(ref)) {
          throw new Error(`Rider: kept constraint ${c.id} references non-simulated state ${ref}`)
        }
      }
    }
    let initialStateMap = new Map(this.makeStateArray().map((state) => [state.id, state]))
    this.constraints = constraintData.map((data) => createConstraintFromJson(data, initialStateMap))
  }
  makeStateArray (position, velocity) {
    return this.body.states
      .filter((stateData) => !this.scarfIds.has(stateData.id))
      .map((stateData) => createStateFromJson(stateData, {position, velocity}))
  }
  getBody (stateMap) {
    let points = this.body.parts.BODY.map((id) => stateMap.get(id))
    return {
      position: averageVectors(points.map(({pos}) => pos)),
      velocity: averageVectors(points.map(({vel}) => vel)),
      get (id) {
        return stateMap.get(id)
      }
    }
  }
}
