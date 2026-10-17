import { Logger } from "./logger";
import { get as store_get, set as store_set } from "./store";

// functions that kumiyui needs
const b64_encode = window.btoa;
const prompt = window.prompt;
const alert = window.alert;

// keys to trigger input prompt
const required_props = ["altKey", "ctrlKey", "shiftKey"]
let trigger_keys = new Map([
  [
    ":",
    {
      altKey: false,
      ctrlKey: false,
      shiftKey: true,
    }
  ]
]);

// for storing temporary
const commands = new Map();
const active_toggles = new Map();
const userscript_menu_id = new Map();
const commands_metad = [];

// logger
const logger = new Logger({ name: "kumiyui:command", level: Logger.LEVELS.info });

/**
 * 
 * @param {string} command_str - (optional) you don't need to pass this, and only pass it if you want to call specific command
 * @returns 
 */
export const trigger_command_input = (command_str) => {
  const user_input = typeof command_str !== "string"
    ? prompt("input command:")?.toString()
    : command_str;

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
  if (command === "kumiyui.disabledevtoolhelp")
    return store_set("kumiyui_internal_set__disabledevtoolhelp", true);

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
  const e_key = event.key.toLowerCase();
  if (trigger_keys.has(e_key)) {
    const requirements = trigger_keys.get(e_key);

    // check if matches all requirements
    for (const require_key of Object.keys(requirements)) {
      // this is already checked so just ignore it
      if (require_key === "key") continue;

      /// check for requirement
      if (event[require_key] !== requirements[require_key])
        return;
    }

    // the triggered key is valid, needs to prevent browser and web's default behavior
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // run the command
    trigger_command_input();
  }
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

  // special command must not be registered
  if (command === "kumiyui.disabledevtoolhelp")
    return logger.debug("you cannot register kumiyui.disabledevtoolhelp because it's a framework command.")

  // check if command already exist
  if (!commands.has(command))
    commands.set(command, callback_fn);
  else
    return logger.debug(`the command ${command} has already been defined.`);

  // add command metadata
  commands_metad.push({
    command_name: (typeof command_name === "string" && command_name?.toString().replaceAll(" ") !== "")
      ? command_name 
      : command,
    command,
    aliases: aliases.join("; "),
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
        return logger.debug(`failed to define alternative command because the command ${command} has already been defined.`);
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

// register useful commands
Command({
  command: "help",
  aliases: ["h", "tasukete", "cmd", "cmds", "kumiyui:cmd", "kumiyui::cmd", "kumiyui:cmds", "kumiyui::cmds"],
  command_name: "help",
  description: "get a list of commands",
  is_toggle: false, // help command shouldn't be a toggle
  callback_fn: () => {
    // always show this popup, i know this is annoying, but it's crucial
    if (store_get("kumiyui_internal_set__disabledevtoolhelp") !== true) {
      alert(`please open console by using "kumiyui!c" command or use devtool's console (from browser).`);
      alert(`to disable this popup before "help" command, you need to use the "kumiyui.disabledevtoolhelp" command.`);
    }

    // output all commands
    logger.table(commands_metad);
  }
})

let ui_console = null;
export const _set_drop_in_console = (drop_in_console) =>
  ui_console = drop_in_console;

Command({
  command: "kumiyui.console",
  aliases: ["kumiyui.c", "kumiyui!console", "kumiyui!c", "kumiyui:console", "kumiyui:c", "kumiyui::console", "kumiyui::c"],
  command_name: "kumiyui.console",
  description: "toggle DropInConsole module",
  is_toggle: false, // help command shouldn't be a toggle
  callback_fn: () => {
    // make sure ui_console.toggle is a function
    if (typeof ui_console.toggle === "function")
      ui_console.toggle();
  }
})

/**
 * Add the key for triggering command input prompt
 *
 * @param {string} key - the trigger key, it resembles InputEvent's "code" property (InputEvent.code) (e.g. "/", ";") 
 * @param {Object} input_event_obj - resembles InputEvent's property (for example: InputEvent has ctrlKey, shiftKey, and altKey, you have to define input_event_obj to has those properties)
 * 
 * @example
 * // user has to press "/", or ";" to trigger the input prompt
 * add_prompt_trigger_input_key("/", {
 *  ctrlKey: false,
 *  shiftKey: false,
 *  altKey: false
 * })
 * 
 * // for example: user has to press ":" to trigger the input prompt
 * // note: you need to make shiftKey: true so that the input prompt
 * // can be triggered.
 * add_prompt_trigger_input_key(":", {
 *  ctrlKey: false,
 *  shiftKey: true,
 *  altKey: false
 * })
 * 
 * // note: you can't do register Shift + ";" because InputEvent's "key" property
 * // will turn Shift + ":" to ":" with shiftKey property being `true` (in boolean)
 * // if you want user to press Shift + ";" trigger, you will have to set ":" with
 * // shiftKey property as `true`.
 * add_prompt_trigger_input_key(";", { // you have to use ":" here
 *  ctrlKey: false,
 *  shiftKey: true,
 *  altKey: false
 * })
 * 
 * // if you miss one property, the trigger key won't be registered
 * add_prompt_trigger_input_key("/", {
 *  ctrlKey: false,
 *  altKey: false
 * })
 */
export const add_prompt_trigger_input_key = (key, input_event_obj) => {
  // key must be in string type
  if (typeof key !== "string")
    return;
  const input_key = key?.toString().toLowerCase().replaceAll(" ", "");

  // reject if already in the trigger_keys
  if (trigger_keys.has(input_key))
    return logger.debug(`the trigger key "${key}" already in the database.`);

  // must be an Object before continue
  if (!(input_key_obj instanceof Object))
    return;

  // must have the required props
  for (const prop of required_props) {
    if (typeof input_key_obj[prop] !== "undefined")
      return logger.debug(`missing property ${prop} in input_event_obj, note: input_event_obj resembles the InputEvent's properties (if you think about it, isn't ${prop} in InputEvent too?).`)
  }

  // add to trigger keys
  trigger_keys.set(input_key, input_event_obj)
}

/**
 * Remove the key for triggering command input prompt
 *
 * @param {string} key - the trigger key, it resembles InputEvent's "code" property (InputEvent.code) (e.g. "/", ";")
 * 
 * @example
 * // note: you are allowed to removed the default ":" trigger key.
 * 
 * // remove the key ":" from trigger keys
 * remove_prompt_trigger_input_key(":")
 */
export const remove_prompt_trigger_input_keys = (key) => {
  // key must be in string type
  if (typeof key !== "string")
    return;
  const input_key = key?.toString().toLowerCase().replaceAll(" ", "");

  // reject if already in the trigger_keys
  if (trigger_keys.has(input_key))
    return logger.debug(`the trigger key "${key}" already in the database.`);

  // remove it
  trigger_keys.delete(input_key);
}

/**
 * Check whether the key for triggering command input prompt exist
 *
 * @param {string} key - the trigger key, it resembles InputEvent's "code" property (InputEvent.code) (e.g. "/", ";") 
 * 
 * @example
 * has_prompt_trigger_input_key(":") // return true
 * has_prompt_trigger_input_key(false) // return undefined (because not in string type)
 */
export const has_prompt_trigger_input_key = (key) => {
  // key must be in string type
  if (typeof key !== "string")
    return;

  // return status
  return trigger_keys.has(key?.toString().toLowerCase().replaceAll(" ", ""))
    ? true
    : false;
}