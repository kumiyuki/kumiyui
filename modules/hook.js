import { mask_hook } from "./hook_masker"

const o_fn_c = window?.Function?.prototype?.toString?.call?.bind(
  window?.Function?.prototype?.toString
);

const apply_raw_hook = ({ obj, prop, new_fn, options, native_str }) => {
  // perform hooking
  if (options?.block_overwrite === true) {
    Object.defineProperty(obj, prop, {
      value: new_fn,
      set: () => new_fn,
      writable: true,
      // "writable": false // avoid doing this, it might break some websites
    })
  } else {
    Object.defineProperty(obj, prop, {
      "value": new_fn,
      "writable": true
    })
  }

  // call hook_masker if user allows to
  if (options?.mask_hook === true && native_str)
    mask_hook(obj[prop], native_str)
}

/**
 * Hooks a method or property on a given object to intercept or modify its behavior.
 * 
 * @param {Object} options - the configuration options for the hook.
 * @param {Object} options.obj - the target object containing the property to hook.
 * @param {string|symbol} options.prop - the name of the method or property to hook.
 * @param {Function} options.new_fn - the new function/logic to apply.
 * @param {Object} [options.options] - optional settings to modify hook behavior.
 * @param {boolean} [options.options.mask_hook=false] - if true, hides/masks the modified function.
 * @param {boolean} [options.options.block_overwrite=false] - if true, prevents future overwrites on this hook.
 * @returns {void}
 * 
 * @example
 * // this hook will make every call on window.fetch() print out the url, and then do nothing
 * hook({
 *  obj: window,
 *  prop: "fetch",
 *  new_fn: (url, data) => { console.log(url) },
 *  options: { mask_hook: true, block_overwrite: true }
 * })
 */
const hook = ({
  obj,
  prop,
  new_fn,
  options = {
    mask_hook: false,
    block_overwrite: false
  }
}) => {
  // get some data
  const native_str = obj?.[prop] ? o_fn_c(obj?.[prop])?.toString() : null;

  // apply the hook
  apply_raw_hook({ obj, prop, new_fn, options, native_str });
}

export default hook;