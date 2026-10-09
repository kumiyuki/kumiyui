const o_fetch = window.fetch;
const o_send_beacon = window.navigator.sendBeacon;
const o_xhr = window.XMLHttpRequest;

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
  // fetch() hook
  window.fetch = async (...args) => {
    let context = { args, api: "fetch" };
    let short_circuit_response = null;

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

        this.args[1] = this.args[1] || {};
        this.args[1].body = JSON.stringify(new_value);
      }
    })

    // "before" hook (short-circuiting method)
    for (const hook of hook_registry.before) {
      try {
        const modification = await hook(context);

        if (typeof modification !== "undefined") {
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

          short_circuit_response = new Response(modification?.body, _response)


          // only execute the first hook
          // read the documentation for more detail on how to register multiple hooks
          break;
        }

        ;
      } catch (e) {
        console.error(`[kumiyui] failed to hook networt request (type: "before"), error:`, e);
      }
    }

    // network response
    // return short circuit response if exist, or return what the server return
    let response;
    if (short_circuit_response) {
      response = short_circuit_response;
    } else {
      try {
        response = await o_fetch.apply(window, context?.args);
      } catch (net_err) {
        // network error
        console.log("[kumiyui] failed to send real network request to the server.", net_err);

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
        const modification = await hook(context, response_for_hook);

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
        console.error(`[kumiyui] error on "after" hook, error:`, e);
      }

      return response;
    }
  }

  // send beacon hook
  if (window.navigator && o_send_beacon) {
    window.navigator.sendBeacon = (url, data) => {
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
          const modification = hook(context);
          if (
            modification === false ||
            (modification && typeof modification === "object" && modification.status === 204)
          ) {
            is_blocked = true;
            break;
          }
        } catch (e) {
          console.error(`[kumiyui] error on sendBeacon hook (type: "before"), error:`, e);
        }

        if (is_blocked === true) return true;
        const result = o_send_beacon.apply(window.navigator, context.args);

        for (const hook of hook_registry?.after) {
          try {
            hook(context, result);
          } catch (e) {
            console.error(`[kumiyui] error on sendBeacon hook (type: "after", error:`, e);
          }
        }

        return result;
      }
    }
  }

  // xhr hook
  window.XMLHttpRequest = class extends o_xhr {
    constructor() {
      super();
      this._kumiyui_context = { args: ["", null], method: "GET", api: "xhr" };
    }

    open(method, url, ...args) {
      this._kumiyui_context.method = method;
      this._kumiyui_context.args[0] = url;
      return super.send(method, url, ...args);
    }

    send(body) {
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

      // xhr "before"
      for (const hook of hook_registry?.before) {
        try {
          hook(context); 
        } catch (e) {
          console.error(`[kumiyui] error on XHR hook (type: "before"), error:`, e);
        }
      }

      if (hook_registry?.after?.length > 0) {
        this.addEventListener("readystatechange", async () => {
          if (this.readyState === 4) {
            let simulated_res = new Response(this.response, {
              status: this?.status,
              statusText: this?.statusText,
              headers: new Headers(this.getAllResponseHeaders().split("\r\n").reduce((acc, line) => {
                const [k, v] = line.split(": "); if (k) acc[k] = v; return acc;
              }, {}))
            })

            for (const hook of hook_registry?.after) {
              try {
                const clone = simulated_res.clone();
                const mod = await hook(context, clone);

                if (typeof mod !== "undefined") {
                  Object.defineProperty(this, "response", { value: mod?.body, configurable: true });
                  Object.defineProperty(this, "responseText", { value: mod?.body, configurable: true });

                  if (typeof mod?.status !== "undefined")
                    Object.defineProperty(this, "status", { value: mod?.status, configurable: true });
                }
              } catch (e) {
                console.error(`[kumiyui] error on XHR hook (type: "after"), error:`, e);
              }
            }
          }
        })
      }

      return super.send(context.args[1]);
    }
  }

  hook_registry[type]?.push(callback);
}

export default {
  is_json,
  register_network_hook
}