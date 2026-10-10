import Logger from "./logger"
import _hook from "./hook"

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
const is_json = (str) => {
  if (typeof str !== "string") return false;
  try {
    JSON.parse(str);
    return true;
  } catch { return false; }
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
            logger.error(`[kumiyui] cannot execute hook listener on window.fetch() hook (type: "before"), error:`, e);
          }

          if (typeof modification !== "undefined") {
            // return false to block the network request (feature)
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
          logger.error(`[kumiyui] failed to hook networt request (type: "before"), error:`, e);
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
          logger.log("[kumiyui] failed to send real network request to the server.", net_err);

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
            logger.error(`[kumiyui] cannot execute hook listener on window.fetch() hook (type: "after"), error:`, e);
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
          logger.error(`[kumiyui] error on "after" hook, error:`, e);
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
              logger.error(`[kumiyui] cannot execute hook listener on sendBeacon hook (type: "before"), error:`, e);
            }

            if (
              modification === false ||
              (modification && typeof modification === "object" && modification.status === 204)
            ) {
              is_blocked = true;
              break;
            }
          } catch (e) {
            logger.error(`[kumiyui] error on sendBeacon hook (type: "before"), error:`, e);
          }
        }

        if (is_blocked === true) return true;
        const result = o_send_beacon.apply(window.navigator, context.args);

        for (const hook of hook_registry?.after) {
          try {
            hook(context, result);
          } catch (e) {
            logger.error(`[kumiyui] cannot execute hook listener on sendBeacon hook (type: "after"), error:`, e);
          }
        }

        return result;
      },
      options: { mask_hook: true, block_overwrite: true }
    })
  }

  // xhr hook
  _hook({
    obj: window,
    prop: "XMLHttpRequest",
    new_value: class extends o_xhr {
      constructor() {
        super();
        this._kumiyui_context = { args: ["", null], method: "GET", api: "xhr" };
        this._kumiyui_response = null;
        this._kumiyui_status = null;
        this._kumiyui_finished = false;
      }

      async open(method, url, ...args) {
        this._kumiyui_context.method = method;
        this._kumiyui_context.args[0] = url;

        // xhr "before"
        for (const hook of hook_registry?.before) {
          try {
            const modification = await hook(context);

            if (typeof modification !== "undefined") {
              // return false to block the network request (feature)
              if (modification === false) {
                this._kumiyui_response = undefined;
                this._kumiyui_status = undefined;

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
                this._kumiyui_response = modification?.body !== undefined ? modification.body : null;
              } else if (typeof modification === "string") {
                this._kumiyui_response = modification;
              }

              // only execute the first hook
              // read the documentation for more detail on how to register multiple hooks
              break;
            }
          } catch (e) {
            logger.error(`[kumiyui] cannot execute hook listener on XHR hook (type: "before"), error:`, e);
          }
        }

        // start opening url
        return super.open(method, this._kumiyui_context.args[0], ...args);
      }

      // return the spoofed response or original
      get response() {
        return this._kumiyui_response !== null
          ? this._kumiyui_response
          : super.response
      }

      get responseText() {
        return this._kumiyui_response !== null
          ? this._kumiyui_response
          : super.responseText
      }

      get status() {
        return this._kumiyui_status !== null
          ? this._kumiyui_status
          : super.status
      }

      // avoid client gets data before modified by "after" hooks
      onreadystatechange(...args) {
        super.onreadystatechange(args[0], async (..._o_args) => {
          await new Promise((resolve) => {
            const state_change_watcher = setInterval(() => {
              if (this.readyState === 4 && this._kumiyui_finished === true) {
                clearInterval(state_change_watcher);
                resolve();
              }
            }, 250);
          })

          // so the "after" hook finished, call the requested listener
          if (typeof args[1] === "function")
            args[1](..._o_args);
        });
      }

      set onload(onload_fn) {
        super.onload(async (..._o_args) => {
          await new Promise((resolve) => {
            const state_change_watcher = setInterval(() => {
              if (this._kumiyui_finished === true) {
                clearInterval(state_change_watcher);
                resolve();
              }
            }, 250);
          })

          // so the "after" hook finished, call the requested listener
          if (typeof onload_fn === "function")
            onload_fn(..._o_args);
        });
      }

      addEventListener(...args) {
        // only hook for state watcher event only
        if (args[0] !== "readystatechange" || args[0] !== "load")
          return super.addEventListener(...args);
        
        super.addEventListener(args[0], async (..._o_args) => {
          await new Promise((resolve) => {
            const state_change_watcher = setInterval(() => {
              if (this.readyState === 4 && this._kumiyui_finished === true) {
                clearInterval(state_change_watcher);
                resolve();
              }
            }, 250);
          })

          // so the "after" hook finished, call the requested listener
          if (typeof args[1] === "function")
            args[1](..._o_args);
        })
      }

      // send function (uses for tracking "after" hooks)
      async send(body) {
        this._kumiyui_context.args[1] = body;
        const context = this._kumiyui_context;

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

        if (hook_registry?.after?.length > 0) {
          super.addEventListener("readystatechange", async () => {
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
                    logger.error(`[kumiyui] cannot execute hook listener on XHR hook (type: "before"), error:`, e);
                  }

                  if (typeof mod !== "undefined") {
                    this._kumiyui_response = mod?.body;
                    if (typeof mod?.status !== "undefined")
                      this._kumiyui_status = mod?.status;
                  }

                  this._kumiyui_finished = true;
                } catch (e) {
                  logger.error(`[kumiyui] error on XHR hook (type: "after"), error:`, e);
                }
              }
            }
          })
        }

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
const register_network_hook = (type, callback) => {
  hook_registry[type]?.push(callback);
}

export default {
  is_json,
  register_network_hook
}