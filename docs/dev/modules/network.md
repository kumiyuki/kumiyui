# network
> [!NOTE]
> you can take a look at the command module code here: [../../../modules/network.js](../../../modules/network.js).

# Network Interceptor Module Reference

The Network Interceptor module acts as a global hook manager for low-level client-side traffic modification. It proxies `window.fetch`, `window.navigator.sendBeacon`, and `window.XMLHttpRequest` concurrently, providing an unified interface to parse, manipulate, block, or spoof data payloads safely.

---

## Technical Architecture and Core Design

The module wraps underlying communication layers at system start, ensuring that custom listener tracks evaluate before client application scripts gain access to network data.

### Dual Filtering Registry (`register_network_hook`)
Hooks are divided into two distinct operational execution tracks:
* **`before`**: Fires prior to establishing remote server connections. Listeners can mutate body properties, read destinations, or cancel the request entirely.
* **`after`**: Fires immediately following successful server response tracking. Listeners receive cloned byte streams to filter incoming responses before the application process consumes them.

---

## Interceptor Registration Guide

To attach a network hook, pass the execution track designation along with a custom callback payload directly to `register_network_hook()`.

```javascript
import { register_network_hook } from "kumiyui";

// 1. Intercepting outgoing requests before server delivery
register_network_hook("before", async (context) => {
  if (context.args[0].includes("/api/metrics")) {
    console.log(`Suppressing tracking event target: ${context.args[0]}`);
    return false; // Blocks the network transmission entirely
  }
});

// 2. Modifying incoming response streams after execution completes
register_network_hook("after", async (context, response) => {
  if (context.args[0].includes("/api/profile")) {
    const rawData = await response.text();
    const parsed = JSON.parse(rawData);
    
    parsed.accountStatus = "premium"; // Tamper with memory properties
    return JSON.stringify(parsed);
  }
});
```

---

## API Execution Context Objects

Every registered callback receives a structured `context` object populated by the framework engine at runtime:

### Context Structure Layout

| Property | Type | Available APIs | Description |
| :--- | :--- | :--- | :--- |
| `api` | `string` | All | Tracks the underlying origin mechanism (`"fetch"`, `"sendBeacon"`, or `"xhr"`). |
| `args` | `array` | All | Indexed parameters passed to the native call. `args[0]` tracks the URL path; `args[1]` contains the payload body. |
| `method` | `string` | `xhr` | The HTTP request verb tracking parameter (e.g., `"GET"`, `"POST"`). |
| `json` | `getter` \| `setter` | All | Virtual parsing wrapper. Accessing `.json` parses string payloads into script objects on demand; setting `.json` automatically stringifies data back into `args[1]`. |

---

## Common Misconceptions and Critical Warnings

### 1. Connection Drop Mechanics vs. Error Spoofing
A frequent pain point for developers occurs when using short-circuiting filters to discard specific tracking requests. Returning `false` within a `before` callback blocks the request, but **the client site remains waiting for a response indefinitely**.

```javascript
// ⚠️ Operational Side Effect:
register_network_hook("before", (context) => {
  if (context.args[0].includes("/destructive-check")) {
    return false; // Connection dropped. Client script execution pauses indefinitely at this boundary line.
  }
});
```
* **When to use:** Use this freeze strategy intentionally if the host site contains defensive routines that clean memory or break page layouts upon receiving explicit network errors.
* **Alternate route:** If the host application expects standard execution progression, avoid returning `false`. Instead, spoof an empty validation map or mock a broken status code (e.g., returning `{ status: 500, body: "Internal Server Error" }`).

### 2. Multi-Hook Serialization Clones (`after` Pipeline)
When registering multiple `after` listeners, stream cloning is heavily optimized under the hood to preserve system memory boundaries. 

The framework automatically clones network response data streams *only* if additional downstream listeners remain unexecuted inside the array stack. The final indexed callback entry receives the terminal response path directly, eliminating unnecessary secondary buffer allocations.

### 3. Asynchronous Race Interceptions (`XMLHttpRequest`)
Due to the architectural design of `XMLHttpRequest`, web application scripts often listen for data state updates using custom event boundaries (`readystatechange`, `load`). 

To prevent web components from reading server responses *before* your custom `after` modifications finish evaluation, the module reconfigures property bindings using a specialized promise gate pipeline (`await_after_hook`). This forces client scripts to yield layout adjustments until your background modifications complete processing cleanly.

---

## Technical Parameter Matrix for Interceptor Returns

When returning custom objects inside `before` or `after` tracks to override remote endpoints, you can supply these configuration values to reconstruct data parameters:

| Property | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `body` | `string` | `null` | The replacement data data returned back to the application layer. |
| `status` | `number` | `200` | The mock HTTP status code assigned to the simulation object wrapper. |
| `statusText` | `string` | `"OK"` | The text definition corresponding to the status code parameter. |
| `headers` | `Headers` | `new Headers()` | Custom communication tracking markers applied back to the simulated stream. |
| `send_to_server` | `boolean` | `false` | (XHR Only) Explicitly locks transmission loops, forcing instantaneous processing of mock data templates without hitting external networks. |