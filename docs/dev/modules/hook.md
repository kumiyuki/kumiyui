# hook
> [!NOTE]
> you can take a look at the command module code here: [../../../modules/hook.js](../../../modules/hook.js).

# Hook Module Reference

The `hook` module provides a high-level API to intercept, modify, or completely override methods and properties on runtime objects. It automates global context translation for browser extension environments and coordinates directly with the [hook_masker](./hook_masker.md) module to conceal tracking tampering.

---

## Technical Architecture and Core Design

The module wraps target reassignments using `Object.defineProperty()`. This structural choice enables features beyond standard property reassignments, such as making specific hooks permanently unalterable by client-side anti-tamper logic.

### Automated Context Resolution (`unsafeWindow`)
When a developer sets the target object parameter (`obj`) to the global `window` reference, the framework evaluates the environment properties automatically:
* If running inside a userscript manager container exposing `unsafeWindow`, the framework rebinds the target pointer context to `unsafeWindow`.
* If `unsafeWindow` is missing, it falls back to `globalThis` or the local standard browser `window` instance.
This abstraction ensures hooks affect the real application window context rather than the extension's isolated sandboxed namespace.

---

## Method and Property Interception

To attach an interceptor configuration payload, invoke the `hook()` builder function.

```javascript
import { hook } from "kumiyui";

hook({
  obj: window,
  prop: "fetch",
  new_value: (url, data) => { 
    console.log(`Fetch target intercepted: ${url}`); 
  },
  options: { 
    mask_hook: true, 
    block_overwrite: true 
  }
});
```

### Configuration Parameters

| Parameter | Type | Required | Default Value | Description |
| :--- | :--- | :--- | :--- | :--- |
| `obj` | `Object` | **Yes** | — | The target container object hosting the property or method. |
| `prop` | `string` \| `symbol` | **Yes** | — | The property accessor key name or symbol targeting modification. |
| `new_value` | `any` | **Yes** | — | The new function, class template, or scalar primitive data value to apply. |
| `options` | `Object` | No | See below | Nested behavior modifier option configuration object block. |

### Options Object Matrix (`options`)

| Property | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `mask_hook` | `boolean` | `false` | When `true`, automatically passes the hook stringification structure to `hook_masker` to disguise tamper states. Only applies if the original target is a function or class. |
| `block_overwrite` | `boolean` | `false` | When `true`, configures the property descriptor as `writable: false`. This locks your custom hook definition, preventing scripts on the host page from overwriting it. |

---

## Common Misconceptions and Critical Warnings

### 1. The Automatic String Extraction Lifecycle
A common point of confusion for developers is how the `mask_hook` integration determines the exact original method layout name (e.g., hiding a modified `window.fetch` by outputting `"function fetch() { [native code] }"`).

The module solves this by reading the method property **before** the new override logic applies. It extracts the authentic signature via an immutable pointer reference to `Function.prototype.toString`. If the property does not evaluate to a function type at initialization, the tracking variable maps to a `null` value, and masking procedures are safely bypassed.

```javascript
// Internal lifecycle sequence handled automatically by hook():
// 1. Reads target: window.fetch -> extracts string signature: "function fetch() { [native code] }"
// 2. Overwrites property: descriptor re-points to your custom code execution value
// 3. Invokes anti-detection layer: passes the original extracted string directly to mask_hook()
```

### 2. Destruction of Original Method Functionality
When passing a new logic block to `new_value`, you replace the underlying property completely. If you still need the original browser implementation to process background requests, you must store a reference to the un-tampered function *prior* to executing the hook macro wrapper:

```javascript
// ❌ WRONG: Calling fetch inside the interceptor triggers infinite recursive stack overflows
hook({
  obj: window,
  prop: "fetch",
  new_value: (url, options) => {
    return window.fetch(url, options); // Infinite recursion loop error
  }
});

//  CORRECT: Caching the original native function pointer before hook invocation
const originalFetch = window.fetch;

hook({
  obj: window,
  prop: "fetch",
  new_value: function (url, options) {
    console.log(`Processing request path: ${url}`);
    // Native context pipeline execution occurs safely via original cache reference
    return originalFetch.apply(this, arguments); 
  }
});
```