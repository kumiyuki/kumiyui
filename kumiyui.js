// named import
import * as ObservedArray from "./modules/observed_array";
import * as Network from "./modules/network";
import * as store from "./modules/store";

// map logger with drop in console
// note: the order is really important
// please import _set_trigger_command_input before _trigger_comand_input
// if the logger module loads after the logger module, the framework won't load and throw error
import { _set_trigger_command_input } from "./modules/logger";
import { trigger_command_input } from "./modules/command";
_set_trigger_command_input(trigger_command_input);

// default module export
export { Command, set_prompt_trigger_input_keys } from "./modules/command";
export { Logger } from "./modules/logger";

// hooking export
import { hook } from "./modules/hook";
import { mask_hook as hook_masker } from "./modules/hook_masker";
export const Hook = { hook, hook_masker };

// export the named import
export { ObservedArray, Network, store };