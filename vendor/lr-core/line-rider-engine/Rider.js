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

export default class Rider {
  constructor (riderBody = classicRiderBody) {
    // TODO: validate riderBody
    this.body = riderBody
    // Drop the cosmetic scarf from the simulated rider. The scarf is a set of
    // FlutterPoints driven by a one-way DirectedChain: it follows the body
    // (anchored at SHOULDER) but never feeds back into it (no body part or
    // constraint references a SCARF point, and the chain only *writes* the
    // scarf), it is non-collidable, and the compiler never reads it. Removing
    // it eliminates the engine's only transcendental math (sin/cos/expm1/pow)
    // and 7 stepped points + a chain resolve every frame, with zero effect on
    // the body trajectory or collisions. (A renderer would need the scarf; this
    // vendored engine is compiler-only.) Identified structurally: the scarf
    // points are the FlutterPoints, driven by the DirectedChain.
    this.stateData = this.body.states.filter((s) => s.type !== 'FlutterPoint')
    let constraintData = this.body.constraints.filter((c) => c.type !== 'DirectedChain')
    let initialStateMap = new Map(this.makeStateArray().map((state) => [state.id, state]))
    this.constraints = constraintData.map((data) => createConstraintFromJson(data, initialStateMap))
  }
  makeStateArray (position, velocity) {
    return this.stateData.map((stateData) =>
      createStateFromJson(stateData, {position, velocity})
    )
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
