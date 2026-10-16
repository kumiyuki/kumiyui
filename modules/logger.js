import { DropInConsole } from "./utils/dropin_console";

// native console obj
const console = window.console;
let ui_console = null;

// for O(1) check with .has()
const VALID_LEVELS = new Set([10, 20, 30, 40, 50, Infinity]);
const LEVELS_INT = new Map([
  [10, "TRACE"],
  [20, "DEBUG"],
  [30, "INFO"],
  [40, "WARN"],
  [50, "ERROR"]
]);

export class Logger {
  static LEVELS = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    silent: Infinity
  }

  // from LLM
  static COLORS = {
    10: 'color: #888888;',                     // Dim Gray
    20: 'color: #06b6d4;',                     // Cyan
    30: 'color: #10b981; font-weight: bold;',  // Green
    40: 'color: #f59e0b; font-weight: bold;',  // Yellow
    50: 'color: #ef4444; font-weight: bold;'   // Red
  };

  /**
   * Create a logger for application log
   * 
   * @param {Object} options
   * @param {string} [options.name="kumiyui"] - the logger name
   * @param {string|Logger.LEVELS} [options.level="info"] - the logging level (default: info)
   * @param {bool} [options.output_timestamp=false] - (optional) output timestamp next to the log output
   * 
   * @example
   * // register with "info" logger
   * const logger = Logger({ name: "kumiyui", level: "info" });
   * 
   * // you can also do the same but with enum
   * const logger = Logger({ name: "kumiyuki_logger", level: Logger.LEVELS.info });
   * 
   * // timestampt log
   * const logger = Logger({ name: "yoshino", level: Logger.LEVELS.info, output_timestamp: true });
   * logger.info("hi"); // output: 
   * 
   */
  constructor({ name = "kumiyui", level = "info", output_timestamp = false }) {
    this.name = name;
    this.output_timestamp = output_timestamp;

    if (typeof level === "number") {
      this.level_weight = VALID_LEVELS.has(level) ? level : 30;
    } else if (typeof level === "string") {
      this.level_weight = Logger.LEVELS[level] ?? 30;
    } else {
      this.level_weight = 30;
    }
  }

  set level(new_level) {
    if (typeof new_level === "number") {
      this.level_weight = VALID_LEVELS.has(new_level) ? new_level : 30;
    } else if (typeof new_level === "string") {
      this.level_weight = Logger.LEVELS[new_level] ?? 30;
    } else {
      this.level_weight = 30;
    }
  }

  /**
   * Create a child logger
   * 
   * @param {string} child_name 
   * @returns {Logger}
   * 
   * @example
   * const logger = Logger({ name: "hello", level: Logger.LEVELS.info });
   * logger.info("hello"); // output: "[hello] hello"
   * 
   * const child_logger = logger.child("API");
   * child_logger.info("establishing API for hello"); // output: "[hello:API] establishing API for hello"
   */
  child(child_name) {
    return new Logger({
      name: `${this?.name}:${child_name}`,
      level: this.level_weight
    })
  }

  /**
   * internal logging function, you should use functions like: info, warn, error, ...
   * this function shouldn't be used by default
   * 
   * @param {string} method - the method in console object
   * @param {Logger.LEVELS} weight - the weight of output level
   * @param {*} args - the arguments for output
   */
  _log(method, weight, args) {
    if (weight < this.level_weight) return;

    // console color
    const prefix = `[${this?.name}]`;
    const allow_timestamp = this.output_timestamp; // prevent race condition
    const output_styles = [];

    // render styles
    // must be in the following order, changing the order will break styling!!
    
    // adding timestamp color (order: 1st)
    // use "trace" color to avoid distraction
    if (allow_timestamp === true)
      output_styles.push(Logger.COLORS[10])

    // output level color (order: 2nd)
    output_styles.push(Logger.COLORS[weight ?? 30]);

    // make timestamp output
    const timestamp_output = allow_timestamp === true
      ? `%c[${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(11, 23)}]` + " " // add a space at the end for more beautiful output
      : "";

    const rendered_output = [`${timestamp_output}%c${LEVELS_INT.get(weight ?? 30)}`, ...output_styles, prefix];

    // for "table" method
    if (method === "table") {
      // output using devtool's console
      console.log(...rendered_output);
      console.table(...args);

      // output on the UI interface
      if (typeof ui_console.log !== "function" && typeof ui_console.table !== "function")
        return;

      ui_console.log(...rendered_output);
      ui_console.table(...args);

      // do not execute non-table methods
      return;
    }

    // output using devtool's console
    console?.[method](...rendered_output, ...args);

    // output on the UI interface
    if (typeof ui_console?.[method] === "function")
      ui_console[method](...rendered_output, ...args);
  }

  // logging functions
  trace(...args) { this._log("debug", 10, args); } // browser lacks "trace" color
  debug(...args) { this._log("debug", 20, args); }
  info(...args)  { this._log("info", 30, args); }
  table(...args) { this._log("table", 30, args); }
  warn(...args)  { this._log("warn", 40, args); }
  error(...args) { this._log("error", 50, args); }
}

// below this is not related to any function that framework will expose.
// it will be UI interaction and event listeners for UI.
// if you are reading for framework's API, you don't need to read the part below
// of course, i'm not going to stop you if you want to.

// note:
// the DropInConsole class is written by LLM
// i'm sorry, I'm not good at designing so i let LLM do it instead

export const _set_trigger_command_input = (trigger_command_input) =>
  ui_console = new DropInConsole(trigger_command_input);

// on mobile, we can't use triggers to open the command prompt.
// so, we need to add a button for it
// create the outer host container
const host = document.createElement("div");
// apply css for host
/* the code below is original, I need to minify so that Bun can build without leaving the string unminified
host.style.cssText = `
  position: fixed !important;
  bottom 20px !important;
  right: 20px !important;
  z-index: 2147483647 !important;
  width: 40px !important;
  height: 40px !important;
  pointer-events: none !important;
`
*/
host.style.cssText = "position:fixed!important;bottom:20px!important;right:20px!important;z-index:2147483647!important;width:40px!important;height:40px!important;pointer-events:none!important;";

// create shadow root for host
const shadow_root = host.attachShadow({ mode: "closed" });

// create trigger divs
const trigger_div = document.createElement("div");
// sorry, i don't know how to make a good design, so i asked LLM
/* the code below is original, I need to minify so that Bun can build without leaving the string unminified
trigger_div.style.cssText = `
  display: none !important;
  pointer-events: auto !important;
  cursor: pointer !important;
  width: 40px !important;
  height: 40px !important;
  padding: 8px !important;
  background-color: #000000 !important;
  opacity: 0.25 !important;
  position: fixed !important;
  border-radius: 10px !important;
  box-sizing: border-box !important;
  transition: opacity 0.2s ease !important;
  user-select: none !important;
  touch-action: none;
`
*/
trigger_div.style.cssText = "display:none!important;pointer-events:auto!important;cursor:pointer!important;width:40px!important;height:40px!important;padding:8px!important;background-color:#000!important;opacity:.25!important;position:fixed!important;border-radius:10px!important;box-sizing:border-box!important;transition:opacity .2s ease!important;user-select:none!important;touch-action:none!important;";

// dragging
let is_dragging = false;
let offset_x;
let offset_y;

// dragging events
const start_drag = (e) => {
  is_dragging = true;

  const client_x = e.touches ? e.touches[0].clientX : e.clientX;
  const client_y = e.touches ? e.touches[0].clientY : e.clientY;

  offset_x = client_x - trigger_div.offsetLeft;
  offset_y = client_y - trigger_div.offsetTop;
}

const move_drag = (e) => {
  if (!is_dragging) return;

  const client_x = e.touches ? e.touches[0].clientX : e.clientX;
  const client_y = e.touches ? e.touches[0].clientY : e.clientY;

  trigger_div.style.left = `${client_x - offset_x}px`;
  trigger_div.style.top = `${client_y - offset_y}px`;
}

const stop_drag = () =>
  is_dragging = false;

// dragging event listeners
trigger_div.addEventListener("touchstart", start_drag, { passive: true });
document.addEventListener("touchmove", move_drag, { passive: false });
document.addEventListener("touchend", stop_drag);

// though desktop is not supported, i also need to add support for dragging on desktop?
// i don't know if in the future it might have some issues, so I thought it's not a bad
// idea to add support for desktop
trigger_div.addEventListener("mousedown", start_drag);
document.addEventListener("mousemove", move_drag);
document.addEventListener("mouseup", stop_drag);

// hover behavior
trigger_div.addEventListener("mouseenter", () => trigger_div.style.opacity = "0.8");
trigger_div.addEventListener("mouseleave", () => trigger_div.style.opacity = "0.25");

// icon from Google Fonts
trigger_div.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="100%" viewBox="0 -960 960 960" width="100%" fill="#e3e3e3"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>`;

// trigger on click
trigger_div.addEventListener("click", () => {
  if (ui_console)
    ui_console.toggle();
});

// add trigger div to the shadow root
shadow_root.appendChild(trigger_div);

// add the host to body
(document.documentElement || document.body).appendChild(host);

// change visibility or enable/disable trigger_div
// enable on mobile/touch event
// disable on desktop
let curr_input_mode = null;
window.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== curr_input_mode) {
    curr_input_mode = e.pointerType;
    trigger_div.style.display = curr_input_mode === "touch"
      ? "block"
      : "none";
  }
})