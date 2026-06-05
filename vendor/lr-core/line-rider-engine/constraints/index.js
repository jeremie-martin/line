import V2 from '../../v2'

// Shared "no stateMap changes" result. stickResolve mutates point positions in
// place, so the points it touches are already the current frame's own entries —
// there is nothing new to set, and returning a fresh [] every call would be
// ~132 throwaway arrays per frame.
const NO_UPDATES = Object.freeze([])

function stickResolve (p1, p2, diff) {
  // Mutate each point's pos IN PLACE instead of allocating V2 temporaries + new
  // Points. Safe because a point's pos object is freshly allocated every frame
  // by step()/collide() and is owned solely by this frame (its prevPos — the
  // only object shared with the previous frame — is never written here), and p1
  // and p2 are always distinct points (distinct pos objects). This reproduces
  // the original V2 expression order exactly:
  //   delta = (p1.pos - p2.pos) * diff ;  p1.pos -= delta ;  p2.pos += delta
  // (the final `delta.add(p2.pos)` is `delta + p2.pos`, but + is commutative in
  // IEEE-754, so `p2.pos += delta` is bit-identical).
  let a = p1.__state__.pos
  let b = p2.__state__.pos
  let dx = (a.x - b.x) * diff
  let dy = (a.y - b.y) * diff
  a.x -= dx
  a.y -= dy
  b.x += dx
  b.y += dy
  return NO_UPDATES
}

function getDiff (restLength, length) {
  return length === 0 ? 0 : (length - restLength) / length
}

export class Stick {
  get iterating () {
    return true
  }
  constructor ({id, p1, p2, length, lengthFactor = 1}, initialStateMap) {
    length = length != null ? length : V2.dist(initialStateMap.get(p1).pos, initialStateMap.get(p2).pos)
    length *= lengthFactor
    Object.assign(this, {id, p1, p2, length})
  }

  getDiff (length) {
    return getDiff(this.length, length) * 0.5
  }

  resolve (stateMap) {
    let p1 = stateMap.get(this.p1)
    let p2 = stateMap.get(this.p2)
    let length = V2.dist(p1.pos, p2.pos)
    return stickResolve(p1, p2, this.getDiff(length))
  }
}
export class RepelStick extends Stick {
  resolve (stateMap) {
    let p1 = stateMap.get(this.p1)
    let p2 = stateMap.get(this.p2)
    let length = V2.dist(p1.pos, p2.pos)
    if (length >= this.length) {
      return []
    }
    return stickResolve(p1, p2, this.getDiff(length))
  }
}

export class BindStick extends Stick {
  constructor ({id, p1, p2, length, binding, endurance}, initialStateMap) {
    super({id, p1, p2, length}, initialStateMap)
    endurance = endurance * this.length * 0.5
    Object.assign(this, {binding, endurance})
  }
  resolve (stateMap) {
    let binding = stateMap.get(this.binding)
    if (!binding.isBinded()) {
      return []
    }
    let p1 = stateMap.get(this.p1)
    let p2 = stateMap.get(this.p2)
    let length = V2.dist(p1.pos, p2.pos)
    let diff = this.getDiff(length)
    if (diff > this.endurance) {
      return [binding.setBind(false)]
    }
    return stickResolve(p1, p2, diff)
  }
}

export class BindJoint {
  get iterating () {
    return false
  }

  constructor ({id, p1, p2, q1, q2, binding}) {
    Object.assign(this, {id, p1, p2, q1, q2, binding})
  }

  resolve (stateMap) {
    let p1 = stateMap.get(this.p1)
    let p2 = stateMap.get(this.p2)
    let q1 = stateMap.get(this.q1)
    let q2 = stateMap.get(this.q2)
    let binding = stateMap.get(this.binding)
    // allow kramuals
    if (V2.cross(V2(p2.pos).sub(p1.pos), V2(q2.pos).sub(q1.pos)) >= 0) {
      return []
    } else if (binding.isBinded()) {
      return [binding.setBind(false)]
    }
    return []
  }
}
export class DirectedChain {
  get iterating () {
    return false
  }

  constructor ({id, ps}, initialStateMap) {
    let [, ...points] = ps
    let lengths = points.map((id, i) =>
      V2.dist(initialStateMap.get(id).pos, initialStateMap.get(ps[i]).pos)
    )
    Object.assign(this, {id, ps, lengths})
  }

  resolve (stateMap) {
    let points = this.ps.map(id => stateMap.get(id))

    for (let i = 1; i < points.length; i++) {
      let p0 = points[i - 1]
      let p1 = points[i]
      let restLength = this.lengths[i - 1]
      let length = V2.dist(p0.pos, p1.pos)
      let nextPosition = V2(p0.pos).sub(p1.pos).mul(getDiff(restLength, length)).add(p1.pos)

      points[i] = p1.setPosition(nextPosition)
    }

    [, ...points] = points

    return points
  }
}
