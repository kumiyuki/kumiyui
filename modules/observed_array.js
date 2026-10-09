// this file is written by LLM
/**
 * @typedef {Object} ArrayEventDetail
 * @property {number} index - The array index where the modification occurred.
 * @property {*} value - The item that was added or removed.
 */

/**
 * @typedef {CustomEvent<ArrayEventDetail>} ArrayMutationEvent
 */

/**
 * An extended Array proxy that supports native event listeners for modifications.
 * 
 * @template T
 * @typedef {Array<T> & {
 *   addEventListener: (type: 'add' | 'remove', listener: (event: ArrayMutationEvent) => void) => void,
 *   removeEventListener: (type: 'add' | 'remove', listener: (event: ArrayMutationEvent) => void) => void
 * }} ObservedArray
 */

/**
 * Creates an observable array proxy wrapped with an EventTarget.
 * This allows you to listen to 'add' and 'remove' events using standard `.addEventListener()`.
 *
 * @template T
 * @param {Array<T>} [targetArray=[]] - The base array to observe. Defaults to an empty array.
 * @returns {ObservedArray<T>} A proxy wrapping the target array with event listener methods.
 * 
 * @example
 * const a = create_observed_arr([]);
 * 
 * a.addEventListener('add', (e) => {
 *   console.log('Added:', e.detail.value);
 * });
 * 
 * a.push({ id: 1 }); // Logs: Added: { id: 1 }
 */

const create_observed_array = (target_arr = []) => {
  const event_bus = new EventTarget();

  return new Proxy(target_arr, {
    get(target, property, receiver) {
      if (property === "addEventListener")
        return event_bus.addEventListener.bind(event_bus);

      if (property === "removeEventListener")
        return event_bus.removeEventListener.bind(event_bus);

      return Reflect.get(target, property, receiver);
    },

    set(target, property, value, receiver) {
      const isIndex = !isNaN(Number(property));
      const isNewKey = !(property in target);

      // Reflect the change to the actual array first
      const success = Reflect.set(target, property, value, receiver);

      // Only dispatch if it's a valid array index assignment
      if (success && isIndex && isNewKey && value !== undefined) {
        eventBus.dispatchEvent(
          new CustomEvent('add', { detail: { index: Number(property), value } })
        );
      }
      return success;
    },

    deleteProperty(target, property) {
      const isIndex = !isNaN(Number(property));
      const oldValue = target[property];

      const success = Reflect.deleteProperty(target, property);

      if (success && isIndex && oldValue !== undefined) {
        eventBus.dispatchEvent(
          new CustomEvent('remove', { detail: { index: Number(property), value: oldValue } })
        );
      }
      return success;
    }
  })
}

export default create_observed_array;