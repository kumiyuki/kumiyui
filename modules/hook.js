import hook_masker from "./hook_masker"

const o_fn_c = window?.Function?.prototype?.toString?.call?.bind(
  window?.Function?.prototype?.toString
);

const apply_raw_hook = ({ obj, prop, new_value, options, native_str }) => {
  // perform hooking
  Object.defineProperty(obj, prop, {
    value: new_value,
    writable: options?.block_overwrite === true ? false : true
  })

  // call hook_masker if user allows to
  // only call if obj[prop] is a function (we know it through native_str being passed from the hook function)
  if (options?.mask_hook === true && native_str)
    return hook_masker.mask_hook(obj[prop], native_str);
}

/**
 * Hooks a method or property on a given object to intercept or modify its behavior.
 * 
 * @param {Object} options - the configuration options for the hook.
 * @param {Object} options.obj - the target object containing the property to hook.
 * @param {string|symbol} options.prop - the name of the method or property to hook.
 * @param {any} options.new_value - the new function/class/logic to apply.
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
 *  new_value: (url, data) => { console.log(url) },
 *  options: { mask_hook: true, block_overwrite: true }
 * })
 */
const hook = ({
  obj,
  prop,
  new_value,
  options = {
    mask_hook: false,
    block_overwrite: false
  }
}) => {
  // get some data
  // native string only extract data from functions and classes only
  const native_str = (typeof obj?.[prop] === "function")
    ? o_fn_c(obj?.[prop])?.toString()
    : null;
  
  // the "window" variable on userscript extension might behave differently
  if (obj === window)
    obj = (typeof unsafeWindow !== "undefined") ? unsafeWindow : (globalThis || window);

  // apply the hook
  apply_raw_hook({ obj, prop, new_value, options, native_str });
}

export default hook;