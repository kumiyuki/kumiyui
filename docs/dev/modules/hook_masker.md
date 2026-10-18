# hook_masker
> [!NOTE]
> you can take a look at the command module code here: [../../../modules/hook_masker.js](../../../modules/hook_masker.js).

# Hook Masker Module Reference

The `hook_masker` module provides defensive mechanisms to hide modifications made to native JavaScript methods. It prevents target web applications from discovering function overrides by intercepting and modifying stringification checks (`toString`) and property verification checks (`hasOwnProperty`).

---

## Technical Architecture and Core Design

The module hooks the following browser runtime foundations on boot:
* **`Function.prototype.toString.call`**: Intercepts code inspection routines that evaluate functions or classes via indirect calls.
* **`Object.prototype.constructor.toString`**: Masks base object string queries.
* **`Element.prototype.appendChild`**: Monitors the DOM creation cycle for new `HTMLIFrameElement` nodes to immediately force security bypass protections onto freshly generated sub-contexts.

---

## Masking a Hooked Function

To hide a tampered method, call `mask_hook()` only **after** reassigning the target global function. Calling it prematurely will result in validation initialization failure.

```javascript
import { mask_hook } from "kumiyui";

// 1. Override the target native API property
window.fetch = (url, body) => {
  console.log(`Intercepted destination target: ${url}`);
  // Custom tracking logic goes here
};

// 2. Hide the change from anti-tamper tracking engines
mask_hook(window.fetch, "function fetch() { [native code] }");
```

### Configuration Parameters

| Parameter | Type | Required | Default Value | Description |
| :--- | :--- | :--- | :--- | :--- |
| `fn` | `Function` | **Yes** | — | The modified function object reference target. |
| `native_string` | `string` | No | `"function() { [native code] }"` | The simulated native code string returned during verification queries. |

---

## Common Misconceptions and Critical Warnings

### 1. The Execution Lifecycle Order Requirement
Developers frequently apply protection templates prior to mutating native fields. If `mask_hook()` runs before your custom override executes, the original function signature maps to the internal tracking table, rendering the anti-detection layer useless.

```javascript
// ❌ WRONG: Masking before assigning overrides
mask_hook(window.fetch, "function fetch() { [native code] }");
window.fetch = (...args) => { /* ... */ };

//  CORRECT: Overriding the native target first, then masking
window.fetch = (...args) => { /* ... */ };
mask_hook(window.fetch, "function fetch() { [native code] }");
```

### 2. Context Bind Breaks (Arrow Function Failure)
When writing logic inside custom hook patches or overrides, you **must not** substitute standard anonymous declarations (`function (...args) {}`) with arrow function tokens (`() => {}`). 

Arrow functions inherit lexical bindings from their context boundaries rather than the invocation target. Substituting them shifts the internal `this` reference target back to the global `window` object scope, throwing immediate reference faults.

```javascript
// ❌ WRONG: Arrow functions break the internal execution context tracking bindings
Element.prototype.appendChild = (...args) => {
  // "this" points to window instead of the element context node, breaking internal apply calls
  return o_appendc.apply(this, args); 
};

//  CORRECT: Standard anonymous functions retain native functional invocation bindings
Element.prototype.appendChild = function (...args) {
  // "this" correctly points to the host element context node
  return o_appendc.apply(this, args);
};
```

### 3. Sub-Context Metadata Privileges (Iframe Hook Requirements)
To safely track, trap, and override fresh nested browsing domains (`HTMLIFrameElement`) before host page detection systems inspect them, your deployment engine metadata configuration block **must explicitly require execution at the highest privilege state**:

```javascript
// ==UserScript==
// @name         Kumiyui Custom Overrides
// @run-at       document-start
// ==/UserScript==
```
If you omit the `@run-at document-start` configuration directive, the framework injection cycle fires after the underlying page elements initialize, allowing security scripts inside the parent layout to observe unprotected frame bindings.

---

## Internal Overrides Applied by Masking

When a target function passes validation through `mask_hook()`, the engine reconfigures two core methods directly on the target object wrapper:

### 1. `fn.hasOwnProperty`
Modifies property mapping behaviors to deny visibility of tracking alterations.
* Queries checking for `"toString"` or `"hasOwnProperty"` will explicitly evaluate and return `false`, matching authentic engine behavior profiles.

### 2. `fn.toString`
Forces inspection workflows to resolve directly to your customized fake configuration template block (`native_string`).
```javascript
// Verification testing scenario outcome
console.log(window.fetch.toString()); 
// Outputs: function fetch() { [native code] }
```