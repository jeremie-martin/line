import Immy from 'immy'

class CellFrame {
  constructor (index, entity) {
    this.index = index
    this.entities = [entity]
  }
  add (entity) {
    this.entities.push(entity)
  }
  hasCollisionWith (line) {
    return this.entities.some((entity) => line.collidesWith(entity))
  }
}

function snapshotVector (v) {
  return { x: v.x, y: v.y }
}

function snapshotEntity (entity) {
  // Frame.grid is historical invalidation data: later addLine() calls replay
  // line.collidesWith() against these records to decide how far to truncate the
  // frame cache. The live stateMap points are intentionally mutable in the hot
  // solver, so grid entries must keep their own immutable coordinate snapshot.
  return {
    id: entity.id,
    friction: entity.friction,
    airFriction: entity.airFriction,
    collidable: entity.collidable,
    steppable: entity.steppable,
    pos: snapshotVector(entity.pos),
    prevPos: snapshotVector(entity.prevPos),
    vel: snapshotVector(entity.vel)
  }
}

class CellFrameList {
  constructor (cellFrame, parent = null) {
    this.cellFrame = cellFrame
    this.parent = parent
    this.length = parent ? parent.length + 1 : 1
    this.array = null
  }
  size () {
    return this.length
  }
  last () {
    return this.cellFrame
  }
  get (index) {
    if (!this.array) {
      let array = new Array(this.length)
      let node = this
      for (let i = this.length - 1; i >= 0; i--) {
        array[i] = node.cellFrame
        node = node.parent
      }
      this.array = array
    }
    return this.array[index]
  }
  push (cellFrame) {
    return new CellFrameList(cellFrame, this)
  }
}

class IndexList {
  constructor (index, parent = null) {
    this.index = index
    this.parent = parent
    this.length = parent ? parent.length + 1 : 1
    this.first = parent ? parent.first : index
    this.array = null
  }
  size () {
    return this.length
  }
  get (index) {
    if (index === 0) return this.first
    if (index === this.length - 1) return this.index
    if (!this.array) {
      let array = new Array(this.length)
      let node = this
      for (let i = this.length - 1; i >= 0; i--) {
        array[i] = node.index
        node = node.parent
      }
      this.array = array
    }
    return this.array[index]
  }
  push (index) {
    return new IndexList(index, this)
  }
}

function makeCellFrames (index, entity) {
  return new CellFrameList(new CellFrame(index, entity))
}

function addEntityToCellFrames (cellFrames, index, entity) {
  let cellFrame = cellFrames.last()
  if (index === cellFrame.index) {
    cellFrame.add(entity)
    return cellFrames
  } else {
    return cellFrames.push(new CellFrame(index, entity))
  }
}

export default class Frame {
  constructor (stateMap = new Map(), grid = new Immy.Map(), collisions = new Immy.Map(), updates = []) {
    this.stateMap = stateMap
    this.grid = grid
    this.collisions = collisions
    this.updates = updates
  }

  clone () {
    return new Frame(new Map(this.stateMap), this.grid, this.collisions)
  }

  getIndexOfCollisionInCell (cell, line) {
    if (!this.grid.has(cell)) return
    let cellFrames = this.grid.get(cell)
    for (let i = 0; i < cellFrames.size(); i++) {
      let cellFrame = cellFrames.get(i)
      if (cellFrame.hasCollisionWith(line)) {
        return cellFrame.index
      }
    }
  }

  getIndexOfCollisionWithLine (line) {
    let lineCollisions = this.collisions.get(line.id)
    if (lineCollisions) {
      return lineCollisions.get(0)
    }
  }

  // Write an array of updated entities into the stateMap. Single source of the
  // "index by entity.id" convention, shared by updateStateMap and the engine's
  // constraint pass.
  setStates (entities) {
    for (let i = 0; i < entities.length; i++) {
      let e = entities[i]
      this.stateMap.set(e.id, e)
    }
  }

  updateStateMap (stateUpdate) {
    if (!stateUpdate) return
    if (stateUpdate instanceof Array) {
      return stateUpdate.forEach((update) => this.updateStateMap(update))
    }
    this.updates.push(stateUpdate)
    this.setStates(stateUpdate.updated)
  }

  addToGrid (lineGrid, entity, index, cells) {
    // cells may be precomputed by the caller (getCellsNearEntity is identical for
    // addToGrid + getLinesNearEntity on the same entity — compute it once).
    if (!cells) cells = lineGrid.getCellsNearEntity(entity)
    let snapshot = snapshotEntity(entity)
    for (let cell of cells) {
      let prev = this.grid.get(cell)
      let next = prev
        ? addEntityToCellFrames(prev, index, snapshot)
        : makeCellFrames(index, snapshot)
      // addEntityToCellFrames mutates the existing CellFrame in place and returns
      // the SAME list when another entity lands in a cell already touched this
      // frame (the common case — rider points cluster, so their 3x3 cells
      // overlap heavily). The grid value is then unchanged, so creating a new
      // persistent version + its reverse patch would be pure overhead. Only
      // re-version when the value actually changed.
      if (next !== prev) {
        this.grid = this.grid.withKeySetToValue(cell, next)
      }
    }
  }

  addToCollisions (line, index) {
    let lineCollisions = this.collisions.get(line.id)
    if (!lineCollisions) {
      lineCollisions = new IndexList(index)
    } else if (lineCollisions.get(lineCollisions.size() - 1) !== index) {
      lineCollisions = lineCollisions.push(index)
    } else {
      return
    }
    this.collisions = this.collisions.withKeySetToValue(line.id, lineCollisions)
  }
}
