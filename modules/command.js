import { Logger } from "./logger";
import { get as store_get, set as store_set } from "./store";

// functions that kumiyui needs
const b64_encode = window.btoa;
const prompt = window.prompt;
const alert = window.alert;

// keys to trigger input prompt
let trigger_keys = new Set(["/", ":"]);

// for storing temporary
const commands = new Map();
const active_toggles = new Map();
const userscript_menu_id = new Map();
const commands_metad = [];

// logger
const logger = new Logger({ name: "kumiyui:command", level: Logger.LEVELS.info });

const trigger_command_input = () => {
  const user_input = prompt("input command:")?.toString();

  // make sure the input is a valid string
  if (
    typeof user_input !== "string" ||
    user_input?.replaceAll(" ", "") === ""
  ) return;

  // getting command and args
  const split_input = user_input.split(" ");
  const command = split_input[0]?.toLowerCase();
  const args = split_input.splice(1);

  // devtool help message
  if (command === "disabledevtoolhelp")
    return store_set("kumiyui_disabledevtoolhelp", true);

  // check for command's existance
  if (!commands.has(command))
    return;

  // get the command data
  const command_obj = commands.get(command);

  // get callback function
  const callback_fn = typeof command_obj === "object"
    ? command_obj?.callback_fn
    : command_obj;

  if (typeof callback_fn !== "function")
    return;

  // main command
  // (get the main command from aliases)
  const main_command = typeof command_obj === "object"
    ? command_obj?.command
    : command;

  // set toggler
  const has_toggle = active_toggles.has(main_command);
  let is_toggled = undefined; // this should not exist or known by default
  if (has_toggle) {
    const toggle_status =
      active_toggles.get(main_command) === true
        ? false
        : true;

    // update status
    active_toggles.set(main_command, toggle_status);
    store_set(`toggle.${b64_encode(main_command)}`, toggle_status);
    is_toggled = toggle_status;

    // update status for userscript menu
    if (userscript_menu_id.has(main_command))
      // trigger rendering userscript menu
      userscript_menu({
        command: main_command,
        is_toggle: has_toggle,
        is_enabled: toggle_status
      })
  }

  // call back with arguments
  try {
    callback_fn(args, is_toggled);
  } catch (e) {
    logger.error("failed to execute callback_fn(), error:", e)
  }
}

const userscript_menu = ({ command, is_toggle, is_enabled }) => {
  // must be a toggle
  if (!is_toggle)
    return;

  // must have support function
  if (
    typeof GM_registerMenuCommand !== "function" ||
    typeof GM_unregisterMenuCommand !== "function"
  ) return;

  // delete old userscript menu if exists
  if (userscript_menu_id.has(command)) {
    const menu_id = userscript_menu_id.get(command);

    // unregister the menu command
    GM_unregisterMenuCommand(menu_id);

    // delete the id from the Map
    userscript_menu_id.delete(command);
  }

  // render
  let userscript_label = `${command}: ${is_enabled ? "enabled" : "disabled"}`
  const new_menu_obj = GM_registerMenuCommand(userscript_label, () => {
    if (!is_toggle)
      return;

    const prev_toggle_status = store_get(`toggle.${b64_encode(command)}`) ?? false;
    const toggle_status = prev_toggle_status === true ? false : true;

    // set toggle state
    active_toggles.set(command, toggle_status);
    store_set(`toggle.${b64_encode(command)}`, toggle_status);
 
    // get the command data
    const command_obj = commands.get(command);

    // get callback function
    const callback_fn = typeof command_obj === "object"
      ? command_obj?.callback_fn
      : command_obj;
   
    // isolate callback_fn from error
    try {
      callback_fn([], toggle_status);
    } catch (e) {
      logger.error("failed to execute callback_fn(), error:", e)
    }

    // return
    return userscript_menu({ command, is_toggle, is_enabled: toggle_status });
  })

  // update userscript menu id
  userscript_menu_id.set(command, new_menu_obj);
}

// listen for user input
window.addEventListener("keydown", (event) => {
  // ignore input if user is typing in an input box
  const active_element = document.activeElement;
  if (
    active_element &&
    (
      active_element.tagName === "INPUT" ||
      active_element.tagName === "TEXTAREA" ||
      active_element.isContentEditable
    )
  ) return;

  // checking keys
  if (trigger_keys.has(event.key.toLowerCase()))
    trigger_command_input();
})

// definition of callback_fn()
/**
 * The callback for callback_fn in Command()
 * 
 * @callback command_callback
 * @param {string[]} [args] - the parsed arguments passed to the command (from user input).
 * @param {boolean} [is_toggled] - the current toggle state. (undefined means no toggle status)
 * @param {...*} extra - any additional arguments (this is optional), this is useful if your program needs custom logic for callback function.
 * @returns {*} the result of the execution.
 * 
 * @example
 * // for command has is_toggle: true
 * const callback_fn = (args, is_toggled) => {}
 * 
 * // for command has is_toggle: false
 * const callback_fn = (args) => {}
 */

/**
 * Registers a new command
 * 
 * @param {Object} options
 * @param {string} options.command - the primary command (e.g. "kirakira").
 * @param {string[]} options.aliases - an array of alternative aliases or shortcuts for the command.
 * @param {string} [options.command_name=options.aliases] - the name of the command (optional).
 * @param {string} options.description - explain the purpose of the command.
 * @param {boolean} [options.is_toggle=false] - whether the command behaves as a toggle switch.
 * @param {command_callback} options.callback_fn - the function executed when user run the command.
 * 
 * @example
 * Command({
 *  command: "konnichiwa",
 *  aliases: ["hello", "hi"],
 *  command_name: "Konnichiwa (say hello)" // (optional) the name appear on the "help" command page
 *  description: "say hello", // (optional)
 *  is_toggle: false, // (optional) you don't need to toggle on/off for a command to say "hello"
 *  callback_fn: () => { logger.log("hello") } // calls everytime when user triggers
 * })
 */
export const Command = ({ command, aliases, command_name, description, is_toggle, callback_fn }) => {
  // check for correct type
  if (
    typeof command !== "string" ||
    typeof aliases !== "object" ||
    typeof description !== "string" ||
    typeof callback_fn !== "function" ||
    !Array.isArray(aliases)
  ) return;

  // add command to the map
  command = command?.toString()?.toLowerCase();

  if (!commands.has(command))
    commands.set(command, callback_fn);
  else
    return `the command ${command} has already been defined.`;

  // add command metadata
  commands_metad.push({
    command_name: (typeof command_name === "string" && command_name?.toString().replaceAll(" ") !== "")
      ? command_name 
      : command,
    command,
    aliases,
    description,
    is_toggle
  });

  // for toggler
  const command_enabled = store_get(`toggle.${b64_encode(command)}`, false);
  if (is_toggle === true)
    active_toggles.set(
      command,
      command_enabled
    );

  // i have heard that define this first will save memory since Map store the reference of the value
  const aliases_obj = { command, callback_fn };

  // add alternative command
  // it's not really a good practice to do this, but it can avoid command duplication
  // and the Map stores pointers for the function, so it should be fine to add them
  // into the map.
  aliases.forEach(
    (_alt) => {
      const alt = _alt?.toString()?.toLowerCase();

      // make sure they are not duplicated
      // use object here to store the main command, this way it saves more space
      if (!commands.has(alt))
        commands.set(alt, aliases_obj);
      else
        return `failed to define alternative command because the command ${command} has already been defined.`;
    }
  )

  // render userscript menu (if the command has applied for toggle functionality)
  if (is_toggle === true)
    userscript_menu({
      command,
      is_toggle,
      is_enabled: command_enabled
    });

  // run the command if enabled
  if (command_enabled) {
    try {
      callback_fn([], command_enabled)
    } catch (e) {
      logger.error("failed to execute callback_fn(), error:", e)
    }
  }
}

// register useful function
Command({
  command: "help",
  aliases: ["h", "tasukete", "cmd", "cmds"],
  command_name: "help",
  description: "get a list of commands",
  is_toggle: false, // help command shouldn't be a toggle
  callback_fn: () => {
    // always show this popup, i know this is annoying, but it's crucial
    if (store_get("kumiyui_disabledevtoolhelp") !== true) {
      alert("please open devtool to see output of the commands (you can either use F12 or Ctrl + Shift + I to open devtool)");
      alert("to disable this popup, you need to use the `disabledevtoolhelp` command so that the next time you run the `help` command, there will be no popup like this.");
    }

    // output all commands
    console.table(commands_metad);
  }
})

/**
 * Set the keys for triggering command input prompt
 * 
 * @param {Set} input_keys_set 
 * 
 * @example
 * // user has to press "/", ":", or ";" to trigger the input prompt
 * set_trigger_input_keys( new Set(["/", ":", ";"]) );
 * 
 * // doing these will result in errors
 * set_trigger_input_keys();
 * set_trigger_input_keys(new Set([]));
 */
export const set_prompt_trigger_input_keys = (input_keys_set) => {
  // make sure the sent data is a set
  if (!(input_keys_set instanceof Set))
    return logger.debug(`your new trigger keys is not a Set. please pass to the function: new Set([keybind, keybind_1])`);

  // make sure the data is not empty
  if (input_keys_set.size <= 0)
    return logger.debug(
      "you can't set empty keybinds for triggering input prompt!! current trigger_keys:", trigger_keys, "; your new trigger_keys:", input_keys_set
    )

  // set the new data
  trigger_keys = input_keys_set;
}