/**
 * Immo: Immutable Manually Managed Object
 *
 * props: immutable properties. these stay the same
 * state: immutable state. these get updated via updateState()
 * computed: mutable derived data. make them up to date via updateComputed()
 * update: object mapping computed props to update fns
 *
 * usage:
 * - @setupImmo
 * - class MyClass extends Immo {}
 * - // setupImmo(MyClass) if you dont have decorators
 *
 * instance = new MyClass(props, state, computed)
 * nextInstance = instance.updateState(nextState)
 *
 * you can also subclass your Immo subclass.
 * just remember to @setupImmo the subsubclass if you want to add more immo properties
 *
 */

export default class Immo {
  static __props__ () {
    return {}
  }
  static __state__ () {
    return {}
  }
  static __computed__ () {
    return {}
  }
  static get __update__ () {
    return {}
  }
  // __current__ tracks the latest version of an object across updateState()s. It
  // lives in a shared one-slot holder rather than a per-instance closure so that
  // every version can carry it as a plain own property (see updateState) without
  // forcing a distinct hidden class.
  get __current__ () { return this.__holder__.current }
  set __current__ (next) { this.__holder__.current = next }

  constructor ({props, state, computed} = {}) {
    setImmoSlots(
      this,
      Object.assign(this.constructor.__props__.call(this), props),
      Object.assign(this.constructor.__state__.call(this), state),
      Object.assign(this.constructor.__computed__.call(this), computed),
      { current: this }
    )
  }
  updateState (updated) {
    // Built off the same (class) prototype with the same slots in the same order
    // as the constructor → same hidden class (see setImmoSlots).
    // __props__/__computed__/__holder__ are shared by reference (matching the old
    // prototype-inheritance semantics: props immutable, computed shared mutable
    // derived data); only __state__ is a fresh copy.
    let next = setImmoSlots(
      Object.create(Object.getPrototypeOf(this)),
      this.__props__,
      Object.assign({}, this.__state__, updated),
      this.__computed__,
      this.__holder__
    )
    this.__holder__.current = next
    return next
  }
  updateComputed () {
    if (this !== this.__current__) {
      let updateFns = this.constructor.__update__
      let current = this.__current__
      this.__current__ = this
      for (let stateKey in updateFns) {
        let targetState = this[stateKey]
        let currentState = current[stateKey]
        if (currentState !== targetState) {
          updateFns[stateKey].call(this, targetState, currentState, current)
        }
      }
    }
  }
}

// Single source of truth for the immo own-property set AND its assignment order.
// The constructor and updateState both go through here, so a version object can
// never drift into a different hidden class from the original (or from another
// instance of the same class). That shared hidden class is what keeps the hot
// accessors (entity.pos/.vel/.prevPos/.friction) MONOMORPHIC — the previous
// Object.create(this.__init__, …) gave each logical entity its own prototype, so
// the ~12 rider points produced ~12 hidden classes → megamorphic loads (~20% of
// engine time). If you add/reorder a slot, do it ONLY here.
//
// NOTE: these are engine-internal slots, and __holder__ ↔ version forms a cycle;
// do not JSON.stringify()/structuredClone()/spread an immo entity.
function setImmoSlots (target, props, state, computed, holder) {
  target.__props__ = props
  target.__state__ = state
  target.__computed__ = computed
  target.__holder__ = holder
  return target
}

export function setupImmo (Subclass) {
  makeImmoStaticProps(Subclass)
  makeImmoAccessors(Subclass)
}

function defineAccessors (obj, keys, getPropsKey, setPropsKey) {
  if (!keys) return
  for (let key of keys) {
    Object.defineProperty(obj, key, {
      get: getPropsKey(key),
      set: setPropsKey && setPropsKey(key)
    })
  }
}

function makeImmoAccessors (Subclass) {
  let defineImmoAccessors = (getObj, getPropsKey, setPropsKey) =>
    !getObj ? null
    : defineAccessors(Subclass.prototype, Object.keys(getObj.call(Subclass.prototype)), getPropsKey, setPropsKey)

  defineImmoAccessors(Subclass.__props__, (key) => function () { return this.__props__[key] })
  defineImmoAccessors(Subclass.__state__, (key) => function () { return this.__state__[key] })
  defineImmoAccessors(Subclass.__computed__,
    (key) => function () { return this.__computed__[key] },
    (key) => function (value) { this.__computed__[key] = value }
  )
}

function makeImmoStaticProps (Subclass) {
  let Superclass = Object.getPrototypeOf(Subclass)
  let propObj = {}
  if (Subclass.prototype.__props__) {
    propObj.__props__ = {
      value () {
        return Object.assign(Superclass.__props__.call(this), Subclass.prototype.__props__.call(this))
      }
    }
  }
  if (Subclass.prototype.__state__) {
    propObj.__state__ = {
      value () {
        return Object.assign(Superclass.__state__.call(this), Subclass.prototype.__state__.call(this))
      }
    }
  }
  if (Subclass.prototype.__computed__) {
    propObj.__computed__ = {
      value () {
        return Object.assign(Superclass.__computed__.call(this), Subclass.prototype.__computed__.call(this))
      }
    }
  }
  if (Subclass.prototype.__update__) {
    propObj.__update__ = {
      value: Object.assign({}, Superclass.__update__, Subclass.prototype.__update__())
    }
  }
  Object.defineProperties(Subclass, propObj)
}
