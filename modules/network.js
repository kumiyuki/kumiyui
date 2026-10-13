import { Logger } from "./logger"
import { hook as _hook } from "./hook"

const o_fetch = globalThis.fetch || window.fetch;
const o_send_beacon = globalThis?.navigator?.sendBeacon || window?.navigator?.sendBeacon;
const o_xhr = globalThis.XMLHttpRequest || window.XMLHttpRequest;
const logger = new Logger({ name: "kumiyui:hook_masker", level: Logger.LEVELS.info });

/**
 * Check if a string is in JSON format
 * 
 * @param {string} str 
 * @returns {boolean} Whether the given string is in JSON format
 * 
 * @example
 * is_json(`{"a": 0}`) // => true
 * is_json(`[0, 1]`) // => true
 * 
 * is_json({}) // => false
 * is_json(`{`) // => false
 * is_json(true) // => false
 * is_json(0) // => false
 */
export const is_json = (str) => {
  if (typeof str !== "string") return false;
  try {
    JSON.parse(str);
    return true;
  } catch { return false; }
}

// this function is created to avoid the client from getting response before the "after" hook finished assigning value
const await_after_hook = async (env) => {
  // prevent from continue to the watcher to avoid wasting resources
  if (
    (env?.readyState === 4 && env?._kumiyui_finished === true) ||
    env?._kumiyui_blocked === true
  )
    return;
  
  // if already at ready state but "after" hook still haven't finished yet
  if (env?.readyState === 4 && !env._kumiyui_finished) {
    await new Promise((resolve) => {
      // push it into listener queue first
      env?._kumiyui_change_listeners.push(resolve);

      // if it finishes right after pushing or at the moment right before await new Promise(...) and between if check
      // if it's blocked, return normally
      if (env._kumiyui_finished === true || env._kumiyui_blocked === true) {
        // clean up the listener
        const listener_index = env._kumiyui_change_listeners.indexOf(resolve);
        if (listener_index !== -1)
          env._kumiyui_change_listeners.splice(listener_index, 1);

        // resolve it
        return resolve();
      }
    })
  }
}

// this function is heavily engineered by LLM (used gemini)
// i just rewrite this with my understanding and remove most of the thing i found not useful
const hook_registry = { before: [], after: [] };

const _init_network_hook = () => {
  // fetch() hook
  _hook({
    obj: window,
    prop: "fetch",
    new_value: async (...args) => {
      let context = { args, api: "fetch" };
      let short_circuit_response = null;
      let is_execution_blocked = false;

      // for modify body multiple times
      let cached_json_body = [];
      let is_json_parsed = [];
      Object.defineProperty(context, "json", {
        get() {
          if (is_json_parsed) return cached_json_body;

          const options = this?.args[1];
          if (options && options?.body && typeof options?.body === "string") {
            try {
              cached_json_body = JSON.parse(options?.body);
            } catch (e) {
              cached_json_body = null;
            }
          }

          is_json_parsed = true;
          return cached_json_body;
        },
        set(new_value) {
          cached_json_body = new_value;
          is_json_parsed = true;

          if (this?.args[0] instanceof Request) {
            this.args[0] = new Request(this.args[0], {
              method: this.args[0].method,
              headers: this.args[0].headers,
              body: JSON.stringify(new_value)
            })
          } else {
            this.args[1] = { ...this.args[1] }
            this.args[1].body = JSON.stringify(new_value);

            if (!this.args[1].method || this.args[1].method === "GET")
              this.args[1].method = "POST";
          }
        }
      })

      // "before" hook (short-circuiting method)
      for (const hook of hook_registry.before) {
        try {
          let modification = null;
          try {
            modification = await hook(context);
          } catch (e) {
            logger.error(`cannot execute hook listener on window.fetch() hook (type: "before"), error:`, e);
          }

          if (typeof modification !== "undefined") { 
            // return false to drop the network request (feature)
            //
            // note: it only drops connection, the client might wait forever for a response.
            // user should avoid using this method and return response with error instead.
            //
            // only use this when the client perform destructive action, like killing UI
            // elements, ... By making it wait forever, the client will/might not delete
            // the element or any interactive functions.
            if (modification === false) {
              short_circuit_response = undefined;
              is_execution_blocked = true;
              break;
            }

            let _response = { status: 200, statusText: "OK", headers: new Headers() };
            let response_body = null;

            if (modification && typeof modification === "object") {
              // update to the tampered data
              ["status", "statusText", "headers"].forEach((_res_key) => {
                if (typeof modification[_res_key] !== "undefined")
                  _response[_res_key] = modification[_res_key];
              });

              // body can be null, so restrict to only undefined
              response_body = modification?.body !== undefined ? modification.body : null;
            } else if (typeof modification === "string") {
              response_body = modification;
            }

            short_circuit_response = new Response(response_body, _response)

            // only execute the first hook
            // read the documentation for more detail on how to register multiple hooks
            break;
          }

          ;
        } catch (e) {
          logger.error(`failed to hook networt request (type: "before"), error:`, e);
        }
      }

      // network response
      // return short circuit response if exist, or return what the server return
      let response;
      if (short_circuit_response && !is_execution_blocked) {
        response = short_circuit_response;
      } else if (!short_circuit_response && is_execution_blocked === true) {
        // set response to undefined so that the client knows that it failed
        response = undefined;

        // return data back to client since the network is blocked
        // you can't even send the request, so there's no "after" hook
        return undefined;
      } else {
        try {
          response = await o_fetch.apply(window, context?.args);
        } catch (net_err) {
          // network error
          logger.log("failed to send real network request to the server.", net_err);

          // throw error so the website's application code can acknowledge the error
          // it will also crash this hook too...
          throw net_err;
        }
      }

      // "after" hook
      const after_hooks = hook_registry?.after ?? [];
      for (let i = 0; i < after_hooks?.length; i++) {
        try {
          const hook = after_hooks[i];

          // only clone stream if there are more hooks left in the queue
          // the very last hook receives the response directly, eliminate memory allocation.
          const is_last_hook = i === (after_hooks?.length ?? 0) - 1;
          const response_for_hook = is_last_hook ? response : response.clone();
          let modification = null;
          try {
            modification = await hook(context, response_for_hook);
          } catch (e) {
            logger.error(`cannot execute hook listener on window.fetch() hook (type: "after"), error:`, e);
          }

          if (typeof modification !== "undefined") {
            if (modification instanceof Response) {
              response = modification;
            } else {
              let _response = { status: 200, statusText: "OK", headers: new Headers() };

              if (
                modification &&
                typeof modification === "object" &&
                (typeof modification["body"] !== "undefined" || typeof modification["status"] !== "undefined")
              ) {
                // update to the tampered data
                ["status", "statusText", "headers"].forEach((_res_key) => {
                  if (typeof modification[_res_key] !== "undefined")
                    _response[_res_key] = modification[_res_key];
                });
              }

              response = new Response(modification?.body, _response);
            }
          }
        } catch (e) {
          logger.error(`error on "after" hook, error:`, e);
        }
      }

      return response;
    },
    options: { mask_hook: true, block_overwrite: true }
  })

  // send beacon hook
  if (window.navigator && o_send_beacon) {
    _hook({
      obj: window.navigator,
      prop: "sendBeacon",
      new_value: (url, data) => {
        const context = { args: [url, data], api: "sendBeacon" };
        let is_blocked = false;

        Object.defineProperty(context, "json", {
          get() {
            if (typeof this?.args[1] === "string") {
              try {
                return JSON.parse(this.args[1]);
              } catch (e) {}

              return null;
            }
          },
          set(value) { this.args[1] = JSON.stringify(value) }
        })

        for (const hook of hook_registry?.before) {
          try {
            let modification = null;
            try {
              modification = hook(context);
            } catch (e) {
              logger.error(`cannot execute hook listener on sendBeacon hook (type: "before"), error:`, e);
            }

            if (
              modification === false ||
              (modification && typeof modification === "object" && modification.status === 204)
            ) {
              is_blocked = true;
              break;
            }
          } catch (e) {
            logger.error(`error on sendBeacon hook (type: "before"), error:`, e);
          }
        }

        if (is_blocked === true) return true;
        const result = o_send_beacon.apply(window.navigator, context.args);

        for (const hook of hook_registry?.after) {
          try {
            hook(context, result);
          } catch (e) {
            logger.error(`cannot execute hook listener on sendBeacon hook (type: "after"), error:`, e);
          }
        }

        return result;
      },
      options: { mask_hook: true, block_overwrite: true }
    })
  }

  // xhr hook
  const xhr_hook_variables = {
    // basic xhr state
    _kumiyui_queued_headers: [],
    _kumiyui_is_opened: false,

    // basic response data
    _kumiyui_context: { args: ["", null], method: "GET", api: "xhr", before_state: null },
    _kumiyui_response: null,
    _kumiyui_status: null,

    // for dropping connection
    _kumiyui_blocked: false,
    
    // for "after" hook event listener to resolve data
    _kumiyui_change_listeners: [],
    _kumiyui_finished: false
  };

  // define kumiyui_finished with event listener like method
  let finished_state = false;
  Object.defineProperty(xhr_hook_variables, "_kumiyui_finished", {
    configurable: true,
    enumerable: true,
    get() { return finished_state },
    set(new_value) {
      // ignores redundant assignments
      if (finished_state === new_value) return;
      finished_state = new_value;

      // if value turns true, notify all listener
      if (new_value === true) {
        while (xhr_hook_variables?._kumiyui_change_listeners.length > 0) {
          const resolve_hook = xhr_hook_variables._kumiyui_change_listeners.shift();
          if (typeof resolve_hook === "function")
            resolve_hook();
        }
      }
    }
  })

  // start hooking
  _hook({
    obj: window,
    prop: "XMLHttpRequest",
    new_value: class extends o_xhr {
      async open(method, url, ...args) {
        xhr_hook_variables._kumiyui_context.method = method;
        xhr_hook_variables._kumiyui_context.args[0] = url;
        xhr_hook_variables._kumiyui_context.before_state = "url";
        const context = xhr_hook_variables._kumiyui_context;

        // xhr "before" (the first time allows user to modify url or block url)
        for (const hook of hook_registry?.before) {
          try {
            const modification = await hook(context);

            if (typeof modification !== "undefined") {
              // return false to drop the network request (feature)
              //
              // note: it only drops connection, the client might wait forever for a response.
              // user should avoid using this method and return response with error instead.
              //
              // only use this when the client perform destructive action, like killing UI
              // elements, ... By making it wait forever, the client will/might not delete
              // the element or any interactive functions.
              if (modification === false) {
                xhr_hook_variables._kumiyui_response = null;
                xhr_hook_variables._kumiyui_status = null;
                xhr_hook_variables._kumiyui_blocked = true;

                // empty the send function
                _hook({ obj: this, prop: "send", new_value: () => {}, options: { mask_hook: true, block_overwrite: true } });
                break;
              }

              let _response = { status: 200, statusText: "OK", headers: new Headers() };

              if (modification && typeof modification === "object") {
                // update to the tampered data
                ["status", "statusText", "headers"].forEach((_res_key) => {
                  if (typeof modification[_res_key] !== "undefined")
                    _response[_res_key] = modification[_res_key];
                });

                // body can be null, so restrict to only undefined
                xhr_hook_variables._kumiyui_response = modification?.body !== undefined ? modification.body : null;
              } else if (typeof modification === "string") {
                xhr_hook_variables._kumiyui_response = modification;
              }

              // only execute the first hook
              // read the documentation for more detail on how to register multiple hooks
              break;
            }
          } catch (e) {
            logger.error(`cannot execute hook listener on XHR hook (type: "before", first call), error:`, e);
          }
        }

        // start opening url natively
        // open() needs to be called before setRequestHeader() to avoid error
        const open_native = super.open(method, xhr_hook_variables._kumiyui_context.args[0], ...args);
        
        // try to set all queued headers
        xhr_hook_variables._kumiyui_is_opened = true;
        while (xhr_hook_variables._kumiyui_queued_headers.length > 0) {
          // set the header based on the queued header
          super.setRequestHeader(
            ...xhr_hook_variables._kumiyui_queued_headers.shift()
          )
        }

        // return open result
        return open_native;
      }

      // modify setRequestHeader to avoid DOMException error
      setRequestHeader(...args) {
        if (!xhr_hook_variables._kumiyui_is_opened) {
          xhr_hook_variables._kumiyui_queued_headers.push(args);
        } else {
          super.setRequestHeader(...args);
        }
      }

      // return the spoofed response or original
      get response() {
        return xhr_hook_variables._kumiyui_response !== null
          ? xhr_hook_variables._kumiyui_response
          : (!xhr_hook_variables._kumiyui_blocked ? super.response : null) // returns default response if blocked
      }

      get responseText() {
        return xhr_hook_variables._kumiyui_response !== null
          ? xhr_hook_variables._kumiyui_response
          : (!xhr_hook_variables._kumiyui_blocked ? super.responseText : "") // returns default response if blocked
      }

      get status() {
        return xhr_hook_variables._kumiyui_status !== null
          ? xhr_hook_variables._kumiyui_status
          : (!xhr_hook_variables._kumiyui_blocked ? super.status : 0) // returns default response if blocked
      }

      get readyState() {
        return xhr_hook_variables._kumiyui_blocked !== true
          ? super.readyState
          : 3; // make it stuck at loading state (the client waits forever at this stage)
      }

      // avoid client gets data before modified by "after" hooks
      set onreadystatechange(on_state_change_fn) {
        super.onreadystatechange(async (..._o_args) => {
          // avoid client from knowing the reponse before "after" hook assigning response data
          await await_after_hook(xhr_hook_variables);

          // so the "after" hook finished, call the requested listener
          if (typeof on_state_change_fn === "function")
            on_state_change_fn(..._o_args);
        });
      }

      set onload(onload_fn) {
        super.onload(async (..._o_args) => {
          // avoid client from knowing the reponse before "after" hook assigning response data
          await await_after_hook(xhr_hook_variables);

          // so the "after" hook finished, call the requested listener
          if (typeof onload_fn === "function")
            onload_fn(..._o_args);
        });
      }

      addEventListener(...args) {
        // only hook for state watcher event only
        if (args[0] !== "readystatechange" && args[0] !== "load")
          return super.addEventListener(...args);
        
        super.addEventListener(args[0], async (..._o_args) => {
          // avoid client from knowing the reponse before "after" hook assigning response data
          await await_after_hook(xhr_hook_variables);

          // so the "after" hook finished, call the requested listener
          if (typeof args[1] === "function")
            args[1](..._o_args);
        })
      }

      // send function (uses for tracking "after" hooks and body for "before" hooks)
      async send(body) {
        xhr_hook_variables._kumiyui_context.args[1] = body;
        xhr_hook_variables._kumiyui_context.before_state = "body";
        const context = xhr_hook_variables._kumiyui_context;

        Object.defineProperty(this, "json", {
          get() {
            const r_body = xhr_hook_variables?._kumiyui_context?.args[1];
            if (typeof r_body === "string") {
              try {
                return JSON.parse(r_body);
              } catch (e) {}

              return null;
            }
          },
          set(value) { xhr_hook_variables._kumiyui_context.args[1] = JSON.stringify(value) }
        })

        // xhr "before" (the second time allows user to modify body data, but user cannot modify url)
        for (const hook of hook_registry?.before) {
          try {
            const modification = await hook(context);

            if (typeof modification !== "undefined") { 
              // return false to drop the network request (feature)
              //
              // note: it only drops connection, the client might wait forever for a response.
              // user should avoid using this method and return response with error instead.
              //
              // only use this when the client perform destructive action, like killing UI
              // elements, ... By making it wait forever, the client will/might not delete
              // the element or any interactive functions.
              if (modification === false) {
                xhr_hook_variables._kumiyui_response = null;
                xhr_hook_variables._kumiyui_status = null;
                xhr_hook_variables._kumiyui_blocked = true; 
                break;
              }

              let _response = { status: 200, statusText: "OK", headers: new Headers() };

              if (modification && typeof modification === "object") {
                // update to the tampered data
                ["status", "statusText", "headers"].forEach((_res_key) => {
                  if (typeof modification[_res_key] !== "undefined")
                    _response[_res_key] = modification[_res_key];
                });

                // body can be null, so restrict to only undefined
                xhr_hook_variables._kumiyui_response = modification?.body !== undefined ? modification.body : null;
              } else if (typeof modification === "string") {
                xhr_hook_variables._kumiyui_response = modification;
              }

              // only execute the first hook
              // read the documentation for more detail on how to register multiple hooks
              break;
            }
          } catch (e) {
            logger.error(`cannot execute hook listener on XHR hook (type: "before", second call), error:`, e);
          }
        }

        // if the connection is blocked, there's no point to execute the "after" hook
        if (xhr_hook_variables._kumiyui_blocked === true)
          return;

        // "after" hook
        super.addEventListener("readystatechange", async () => {
          // check for hooks (it has to be in the event because registers might not be registered at the start)
          if (hook_registry?.after?.length <= 0)
            return;

          // only run on readyState
          if (this.readyState === 4) {
            let simulated_res = new Response(super.response, {
              status: super.status,
              statusText: super.statusText,
              headers: new Headers((this.getAllResponseHeaders() || "").split("\r\n").reduce((acc, line) => {
                const [k, v] = line.split(": "); if (k) acc[k] = v; return acc;
              }, {}))
            })

            for (const hook of hook_registry?.after) {
              try {
                const clone = simulated_res.clone();
                let mod = null;
                try {
                  mod = await hook(context, clone);
                } catch (e) {
                  logger.error(`cannot execute hook listener on XHR hook (type: "before"), error:`, e);
                }

                if (typeof mod !== "undefined") {
                  xhr_hook_variables._kumiyui_response = mod?.body;
                  if (typeof mod?.status !== "undefined")
                    xhr_hook_variables._kumiyui_status = mod?.status;
                }

                xhr_hook_variables._kumiyui_finished = true;
              } catch (e) {
                logger.error(`error on XHR hook (type: "after"), error:`, e);
              }
            }
          }
        })

        return super.send(context.args[1]);
      }
    },
    options: { mask_hook: true, block_overwrite: true }
  })
}

_init_network_hook();

/**
 * Registers a network interceptor hook.
 * 
 * @param {"before"|"after"} type - when to execute the hook ("before" the request goes out, or "after" it completes)
 * @param {Function} callback - the user-defined function containing manipulation logic.
 * 
 * @example
 * register_network_hook("before", (context) => {});
 * register_network_hook("after", (context, result) => {})
 */
export const register_network_hook = (type, callback) => {
  hook_registry[type]?.push(callback);
}