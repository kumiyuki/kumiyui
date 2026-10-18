# command
> [!NOTE]
> you can take a look at the command module code here: [../../../modules/command.js](../../../modules/command.js).

# Command Module Reference

The `Command` module manages keyboard shortcut registration, user interaction prompts, and option state verification within the application framework. It provides automated linkages to grease-monkey standard environment menus when available.

---

## Input Prompt Activation Mechanics

The framework maintains a global keyboard listener to open the primary command evaluation prompt.

* **Default Shortcut Key Combination:** `Shift + :` (Colon key output).
* **Automated Form Suppression:** Input capture rules bypass execution if the current focused element matches an `<input>` tag, a `<textarea>` tag, or any document node containing the `isContentEditable` boolean flag.

---

## Standard Command Registration

To instantiate a command string tracking pipeline, pass a configuration object directly to the `Command` function entry point.

```javascript
import { Command } from "kumiyui";

Command({
  command: "hello",
  aliases: ["hi", "greet"],
  command_name: "Friendly Greeter",
  description: "Outputs an alert dialog box back to the interface.",
  is_toggle: false,
  
  callback_fn: (args) => {
    alert("Application initialization notice.");
  }
});
```

### Distinguishing Command Identifiers

Developers frequently confuse the structural differences between `command`, `aliases`, and `command_name`. Each property serves a distinct purpose within the lookup and rendering pipelines:

```javascript
Command({
  command: "hello",
  aliases: ["hi", "greet"],
  command_name: "Friendly Greeter",
  description: "Outputs an alert box.",
  // ...
})
```

* **`command` (The Primary System Key):** This is the main identifier string used to trigger the callback function. It must be a single string and is case-insensitive. The user types this text directly into the command prompt window (e.g., `:hello`).
* **`aliases` (Alternative Shortcut Keys):** This is an array of strings representing fallback keywords that trigger the exact same code block. It is optimized to map references back to the primary key without wasting execution memory. In this configuration, typing `:hi` or `:greet` yields the identical result as typing `:hello`.
* **`command_name` (The Display Label):** This property does **not** act as a trigger or a keyboard input keyword. It is strictly a user-facing presentation string used when rendering metadata tables. Typing `:Friendly Greeter` into the prompt will fail. Instead, this string appears cleanly inside the list columns generated when an operator calls the global `:help` utility command.

### Argument Array Processing (`args`)
Text entered by an operator trailing the matching command string automatically undergoes space-delimited splitting. The resulting string segments populate the sequential array passed into the first parameter position of your defined callback function.

For example, given an evaluation prompt containing: `:greet option1 option2`
The internal variables compile as: `args = ["option1", "option2"]`

```javascript
Command({
  command: "shout",
  aliases: ["echo"],
  description: "Capitalizes and displays user string arrays.",
  callback_fn: (args) => {
    const message = args.join(" "); 
    alert(message.toUpperCase());
  }
});
```

---

## State Toggle Configurations (`is_toggle: true`)

Setting the `is_toggle` key configuration value to `true` switches the registration sequence from single-execution behavior to a stateful boolean loop. Choice state parameters save down to internal persistence keys under format paths (`toggle.<base64_command_name>`), enabling preference retention across session reloads.

```javascript
Command({
  command: "rainbow",
  aliases: ["rgb"],
  description: "Controls development visibility rendering styles.",
  is_toggle: true,
  
  callback_fn: (args, is_toggled) => {
    if (is_toggled) {
      console.log("Toggle state active.");
    } else {
      console.log("Toggle state inactive.");
    }
  }
});
```

### Userscript Menu Integration
If execution environments expose standard extensions API variables (`GM_registerMenuCommand` and `GM_unregisterMenuCommand`), toggle elements dynamically register selection rows into the browser script host extension panel interface using text patterns: `<command>: enabled` or `<command>: disabled`.

---

## Runtime Modification of Prompt Key Registries

Developers can add or purge active string targets configured to trigger the interface text input prompt window.

### Appending Hotkey Registries
To append a new character monitor tracking sequence, assign the trigger key value along with all modifier state requirements (`ctrlKey`, `shiftKey`, and `altKey`) using boolean designations.

```javascript
import { add_prompt_trigger_input_key } from "kumiyui";

add_prompt_trigger_input_key("/", {
  ctrlKey: false,
  shiftKey: false,
  altKey: false
});

add_prompt_trigger_input_key("s", {
  ctrlKey: false,
  shiftKey: true,
  altKey: false
});
```

> [!NOTE]
> Character key targets track raw layout results passed directly by browser event objects. Binding actions to commands that require alternate symbol modifications (such as combinations outputting a colon on standard keyboards) must specify the final character output target string (`":"`) alongside a `true` status modifier for the `shiftKey` property parameter tracking path.

### Purging Hotkey Registries
To disconnect existing character entries or drop default settings from the monitoring cycle list, invoke the clear command option:

```javascript
import { remove_prompt_trigger_input_keys } from "kumiyui";

remove_prompt_trigger_input_keys(":");
```

---

## Embedded Core System Commands

The framework initializes two native utilities inside the execution memory map baseline:

1. **`help`** (Alternative routes: `h`, `kumiyui!h`)
   * **Operation:** Evaluates historical configuration records to output a structured index array map schema directly back into devtool layout terminals using your framework `logger.table` module engine properties.
   * *Notice:* Triggers execution tracking browser warning alerts until the operator runs the clear flag option `:kumiyui.disabledevtoolhelp`.

2. **`kumiyui.console`** (Alternative routes: `kumiyui!c`)
   * **Operation:** Changes the deployment layout visibility profile state properties of the on-screen execution logging component wrapper by calling `ui_console.toggle()`.