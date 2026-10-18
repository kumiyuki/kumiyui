# kumiyui (dev)
> [!note]
> you are viewing documentation for developer.\
> it means that you are going to use the framework in your project.

welcome to the kumiyui framework's documentation for developers.

## modules
The framework structure organizes across five distinct operational components:

* **[Command](./modules/command.md)**: Manages terminal execution shortcuts, functional feature switches, and keybind listeners to control the interactive user prompt panel.
* **[Hook Masker](./modules/hook_masker.md)**: Supplies background anti-detection overrides (`toString`, `hasOwnProperty`) to disguise tampered objects from host environment verification scripts.
* **[Hook](./modules/hook.md)**: Intercepts and replaces properties or methods directly on runtime targets. Operates over an abstract wrapper system built on top of native [Object.defineProperty](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty) descriptors.
* **[Network Interceptor](./modules/network.md)**: Proxies communication tracks (`fetch`, `sendBeacon`, `XMLHttpRequest`) to block requests or modify response payload bytes mid-transit.
* **[Store](./modules/store.md)**: Handles state data persistence, switching automatically between long-term extension parameters and sandboxed in-memory cache fallbacks based on context rules.

## credits
thank you **Gemini 3 for writing the developer documentation**.\
I'm sorry, I do not have the knowledge to write a good documentation, so I let LLM do it instead.