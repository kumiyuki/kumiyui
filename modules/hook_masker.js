import Logger from "./logger"
const logger = new Logger({ name: "kumiyui:hook_masker", level: Logger.LEVELS.info });

// mask some hooks
const _hooks = new Map();

const bypass_detection_hook = (hook_env) => {
  if (!hook_env || !hook_env?.Function?.prototype)
    return;

  // hook to return native code (Function.prototype.toString)
  const o_fn_c = hook_env?.Function?.prototype?.toString?.call?.bind(
    hook_env.Function.prototype.toString
  );

  try {
    const new_tostring_hook = (...args) => {
      for (const _obj of args) {
        if (typeof _obj !== "function")
          // stop here because this only work with function and classes
          return;
      }

      if (args.length <= 0)
        return o_fn_c(...args);

      if (_hooks.has(args[0]))
        return _hooks.get(args[0]) || "[native code]";

      return o_fn_c(...args);
    }

    Object.defineProperty(hook_env.Function.prototype.toString, "call", {
      get: () => new_tostring_hook,
      set: () => new_tostring_hook,
      configurable: true
    })

    _hooks.set(hook_env.Function.prototype.toString, "function toString() { [native code] }");
  } catch (e) {
    logger.error(`[kumiyui] failed to mask Function.prototype.call()`, e);
  }

  // hook to return native code (Object method)
  try {
    const obj_fn_c = hook_env?.Object?.prototype?.constructor?.toString;
    const new_obj_tostring_hook = (...args) => {
      if (args.length <= 0)
        return obj_fn_c(...args);

      if (_hooks.has(args[0]))
        return _hooks.get(args[0]) ?? "[native code]";

      return obj_fn_c(...args);
    }

    Object.defineProperty(hook_env.Object.prototype.constructor, "toString", {
      get: () => new_obj_tostring_hook,
      set: () => new_obj_tostring_hook,
      configurable: true
    })
  } catch (e) {
    logger.error(`[kumiyui] failed to mask Function.prototype.constructor.toString()`, e);
  }
}

// for standard window
bypass_detection_hook(window);

// iframe hook
// to hook iframe, you are REQUIRED to use "@run-at document-start"
// by giving it "document-start", you are at higher privilege
const o_appendc = Element?.prototype?.appendChild;

// note: do not change "function (..args)" to "() => {}", or it will break the code
// by doing that, it will point the "this" variable to "window" and breaks the code
// just keep as it is!!
Element.prototype.appendChild = function (...args) {
  if ((args.length ?? 0) <= 0)
    return o_appendc.apply(this, args);

  const child = args[0];
  const result = o_appendc.apply(this, args);

  if (child instanceof HTMLIFrameElement) {
    if (child?.contentWindow)
      bypass_detection_hook(child?.contentWindow);

    child?.addEventListener("load", () => {
      if (child?.contentWindow)
        bypass_detection_hook(child?.contentWindow);
    })

    try {
      Object.defineProperty(child, 'contentWindow', {
        get: function() {
          const win = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get.call(this);
          if (win && !win.Function.prototype.toString.toString().includes("[native code]")) {
             bypass_detection_hook(win);
          }
          return win;
        },
        configurable: true
      });
    } catch(e) {
      logger.error(`[kumiyui] cross context navigation reset watcher threw error:`, e);
    }
  }

  return result;
}

/**
 * Mask a hooked function so that the web application cannot detect that the function has been tampered with.
 * YOU SHOULD CALL mask_hook() AFTER HOOKING THE FUNCTION. Calling mask_hook() before that will not work and will cause a malfunction.
 * 
 * @param {Function} fn 
 * @param {string} native_string
 * 
 * @example
 * window.fetch = (url, body) => {
 *  console.log(url, body);
 *  // more things here
 * }
 * 
 * // only call mask_hook() after hooking a function
 * mask_hook(window.fetch, "function fetch() { [native code] }");
 */
const mask_hook = (fn, native_string) => {
  if (typeof fn !== "function") return;
  if (_hooks.has(fn)) return;

  // add hook
  const hook_native = typeof native_string === "string"
    ? native_string
    : "function() { [native code] }";

  _hooks.set(fn, hook_native);

  // simple patching
  const o_hasprop = fn?.hasOwnProperty;

  // hasOwnProperty() hook
  try {
    if (typeof o_hasprop === "function") {
      // like the iframe hook above, use "function (..args)" here
      const modified_hasOwnProperty = function (...args) {
        if ((args.length ?? 0) <= 0)
          return o_hasprop.apply(this, args);

        if (args[0] === "toString" || args[0] === "hasOwnProperty")
          return false;

        return o_hasprop.apply(this, args);
      }

      Object.defineProperty(fn, "hasOwnProperty",{
        get: () => modified_hasOwnProperty,
        set: () => modified_hasOwnProperty,
        configurable: true
      })

      _hooks.set(fn.hasOwnProperty, "function hasOwnProperty() { [native code] }");
    }
  } catch (e) {
    logger.error(`[kumiyui] failed to mask fn.hasOwnProperty()`, e);
  }

  // toString() hook
  try {
    // same as the iframe above, use "function()" here
    const modified_toString = function() { return hook_native };

    Object.defineProperty(fn, "toString",{
      get: () => modified_toString,
      set: () => modified_toString,
      configurable: true
    })
    _hooks.set(fn.toString, "function toString() { [native code] }");
  } catch (e) {
    logger.error(`[kumiyui] failed to mask fn.toString()`, e);
  }
}

export default {
  mask_hook
}