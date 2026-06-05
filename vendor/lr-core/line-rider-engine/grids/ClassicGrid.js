import {classicCells as getCellsFromLine} from './getCellsFromLine.js'
import {SubclassableMap} from '../../subclassable/index.js'
import OrderedObjectArray from '../../ordered-object-array/index.js'

const GRID_SIZE = 14

function encodeIntForHash (n) {
  return n >= 0 ? 2 * n : -2 * n - 1
}

function hashEncodedIntPair (a, b) {
  let c = (a >= b) ? (a * a + a + b) : (b * b + a)
  return (c & 1) ? -(c - 1) / 2 - 1 : c / 2
}

class LineCellsMap extends SubclassableMap {
  add (line, cells) {
    this.set(line.id, cells)
  }
  remove (line) {
    let cells = this.get(line.id)
    if (!cells) return []
    this.delete(line.id)
    return cells
  }
}

class CellLinesMap extends SubclassableMap {
  add (line, cells) {
    for (let cell of cells) {
      let cellLines = this.get(cell)
      if (!cellLines) {
        cellLines = new OrderedObjectArray('id', true)
        this.set(cell, cellLines)
      }
      cellLines.add(line)
    }
  }
  remove (line, cells) {
    for (let cell of cells) {
      let cellLines = this.get(cell)
      cellLines.remove(line)
      if (cellLines.length === 0) {
        this.delete(cell)
      }
    }
  }
}

// handles collidable lines in 6.2 physics
export default class ClassicGrid {

  constructor (getCellFn = getCellsFromLine) {
    this.getCellsFromLine = getCellFn
    this.lineCellsMap = new LineCellsMap()
    this.cellLinesMap = new CellLinesMap()
  }

  add (line) {
    if (!line.collidable) return []
    let cells = this.getCellsFromLine(line, GRID_SIZE)
    this.lineCellsMap.add(line, cells)
    this.cellLinesMap.add(line, cells)
    return cells
  }
  remove (line) {
    let cells = this.lineCellsMap.remove(line)
    this.cellLinesMap.remove(line, cells)
  }

  // 3x3 grid around entity
  getCellsNearEntity (entity) {
    let gx = Math.floor(entity.pos.x / GRID_SIZE)
    let gy = Math.floor(entity.pos.y / GRID_SIZE)
    let x0 = encodeIntForHash(gx - 1)
    let x1 = encodeIntForHash(gx)
    let x2 = encodeIntForHash(gx + 1)
    let y0 = encodeIntForHash(gy - 1)
    let y1 = encodeIntForHash(gy)
    let y2 = encodeIntForHash(gy + 1)
    return [
      hashEncodedIntPair(x0, y0),
      hashEncodedIntPair(x0, y1),
      hashEncodedIntPair(x0, y2),
      hashEncodedIntPair(x1, y0),
      hashEncodedIntPair(x1, y1),
      hashEncodedIntPair(x1, y2),
      hashEncodedIntPair(x2, y0),
      hashEncodedIntPair(x2, y1),
      hashEncodedIntPair(x2, y2)
    ]
  }

  // the lines in the 3x3 grid around entity, with duplicates
  getLinesNearEntity (entity, cells) {
    let lines = []
    if (!cells) cells = this.getCellsNearEntity(entity)
    for (let cell of cells) {
      let cellLines = this.getCellLines(cell)
      if (!cellLines) continue
      for (let line of cellLines) {
        lines.push(line)
      }
    }
    return lines
  }

  getCellLines (cell) {
    return this.cellLinesMap.get(cell)
  }
}
