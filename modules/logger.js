// for O(1) check with .has()
const VALID_LEVELS = new Set([10, 20, 30, 40, 50, Infinity]);
const LEVELS_INT = new Map([
  [10, "TRACE"],
  [20, "DEBUG"],
  [30, "INFO"],
  [40, "WARN"],
  [50, "ERROR"]
]);

class Logger {
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
      : ""

    console?.[method](`${timestamp_output}%c${LEVELS_INT.get(weight ?? 30)}`, ...output_styles, prefix, ...args);
  }

  // logging functions
  trace(...args) { this._log("debug", 10, args); } // browser lacks "trace" color
  debug(...args) { this._log("debug", 20, args); }
  info(...args)  { this._log("info", 30, args); }
  warn(...args)  { this._log("warn", 40, args); }
  error(...args) { this._log("error", 50, args); }
}

export default Logger;