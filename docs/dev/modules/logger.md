# logger
> [!NOTE]
> you can take a look at the command module code here: [../../../modules/logger.js](../../../modules/logger.js).

# Logger Module Reference

The `Logger` module provides a structured logging interface featuring severity weights, nested child instantiations, color-coded terminal parsing, and dual-output routing. Logs are broadcast simultaneously to the browser's developer tools console and Kumiyui's on-screen `DropInConsole` runtime UI layer.

> [!WARNING]
> **Why would I have to use the Logger Module Instead of `console.log`?**
>
> When writing framework scripts, always use the `Logger` module methods (`logger.info`, `logger.error`, `logger.table`) instead of the standard browser `console.log`.
>
> * **The Core Reason:** The built-in on-screen terminal overlay (`DropInConsole`) can *only* capture and display text processed directly through Kumiyui's internal logging pipeline. 
> * **The Side Effect:** If you use standard `console.log`, your messages will still print to the browser's native F12 developer console, but they will completely skip the on-screen UI console, making them invisible to users on devices without native developer tools (like mobile browsers).

---

## Technical Architecture and Core Design

The log engine matches runtime weight levels against a defined configuration threshold to prevent background processing degradation. If a dispatch weight falls below the active threshold value, execution drops immediately before string concatenation or styling arrays compile.

### Log Severity Levels (`Logger.LEVELS`)

The engine processes strict numeric weights to control log visibility:

| Enum Property | Numeric Weight | Output Label | Output Terminal Style |
| :--- | :--- | :--- | :--- |
| `Logger.LEVELS.trace` | `10` | `TRACE` | Dim Gray text (`#888888`) |
| `Logger.LEVELS.debug` | `20` | `DEBUG` | Cyan text (`#06b6d4`) |
| `Logger.LEVELS.info` | `30` | `INFO` | Bold Green text (`#10b981`) |
| `Logger.LEVELS.warn` | `40` | `WARN` | Bold Yellow text (`#f59e0b`) |
| `Logger.LEVELS.error` | `50` | `ERROR` | Bold Red text (`#ef4444`) |
| `Logger.LEVELS.silent` | `Infinity` | — | Suppresses all logging outputs entirely |

---

## Instantiating a Logger

Invoke the `Logger` constructor using a configuration object payload.

```javascript
import { Logger } from "kumiyui";

const logger = new Logger({
  name: "network",
  level: "debug",
  output_timestamp: true
});

logger.info("Connection initialized.");
```

### Configuration Parameters

| Parameter | Type | Required | Default Value | Description |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | No | `"kumiyui"` | Namespace tracker prepended to log prefixes (e.g., `[network]`). |
| `level` | `string` \| `number` | No | `"info"` | Active threshold parameter. Accepts string names or explicit enum numbers. Invalid parameters default to `30` (`info`). |
| `output_timestamp` | `boolean` | No | `false` | When `true`, inserts an ISO local-time string segment at the front of messages. |

---

## Advanced Logging Capabilities

### 1. Generating Child Loggers (`child`)
To track isolated sub-modules without re-declaring primary configuration values, call `child()`. The child engine inherits the parent threshold tier automatically while cleanly appending its string tag to the existing namespace.

```javascript
const parent = new Logger({ name: "auth", level: "info" });
const client = parent.child("session");

client.info("Token verified."); 
// Terminal Output: INFO [auth:session] Token verified.
```

### 2. Dynamically Adjusting Thresholds
Threshold priorities can be altered at runtime after object creation via a standard setter variable:

```javascript
const logger = new Logger({ name: "core", level: "info" });
logger.debug("Test tracking trace."); // Bypassed: weight 20 is less than 30

// Lower the target threshold weight dynamically
logger.level = "debug";
logger.debug("Test tracking trace."); // Processes successfully
```

### 3. Rendering Structures via Tables (`table`)
The `table` method forwards parameters directly to specialized matrix parsers. It cleanly outputs log metadata directly above arrays or object groups.

```javascript
const records = [
  { item: "Patch A", state: active },
  { item: "Patch B", state: disabled }
];

logger.table(records);
```

---

## Common Misconceptions and Critical Warnings

### 1. Browser Limitations and the Trace Method Redirection
Developers frequently assume that invoking `logger.trace()` maps internally to the browser’s native `console.trace()` asset stack tracker. 

Because many browsers lack standard color-rendering capabilities for raw trace layouts, Kumiyui routes `logger.trace(...)` parameters directly through `console.debug()` with a weight designation of `10`. If you require a true error execution boundary trace trace-back stack, write a direct explicit debug block instead.

```javascript
// Internal framework routing mapping logic:
trace(...args) { this._log("debug", 10, args); } // Redirects parameters directly to console.debug
```

### 2. Precision Style Injection Order Constraints
When compiling custom logging profiles internally, CSS array structures follow a strict sequence. Altering the source order will immediately detach intended layouts, causing scrambled or broken console logs.

```javascript
// Internal layout execution order constraint tracking path:
// 1st Layer: Timestamp styling parameters applied (defaults to dim gray text attributes)
// 2nd Layer: Target Level severity style blocks injected (color definitions matching active weight)
// 3rd Layer: Namespace prefix strings appended to the argument array array index
```

---

## Core UI Layer Injections and Event Management

In environments where keyboard shortcuts are unavailable (such as mobile devices or touchscreen tablets), the module automatically injects a floating UI trigger button into the DOM. This button serves as a graphical overlay to open and close the custom terminal interface (`DropInConsole`).

### Encapsulation and CSS Isolation
To guarantee that styles from the target web application do not overflow or deform the framework's interactive assets, Kumiyui isolates the floating button using a closed Web Component layout:
* **The Root Host Element:** Appended directly to `document.documentElement` or `document.body`.
* **The Shadow DOM Wrapper:** Created using `{ mode: "closed" }`. This blocks host page scripts from reading, modifying, or querying the inner trigger element nodes via traditional DOM scraping methods.

---

## Dynamic Input Mode Tracing

The module features a dynamic hardware tracking loop that monitors system pointer states to determine visibility constraints.

```javascript
let curr_input_mode = null;
window.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== curr_input_mode) {
    curr_input_mode = e.pointerType;
    trigger_div.style.display = curr_input_mode === "touch"
      ? "block"
      : "none";
  }
});
```

### Display Behavior Rules
* **Touch Interactions (`e.pointerType === "touch"`):** Displays the floating settings button (`display: block`).
* **Desktop/Mouse Interactions (`e.pointerType === "mouse"`):** Hides the overlay (`display: none`), defaulting to standard hotkey shortcuts like `Shift + :`.

---

## Drag-and-Drop Engineering Profiles

To keep the UI accessible, the framework features dual-mode drag-and-drop listener mappings that allow the button to be moved across both mobile and desktop views.

```javascript
// Mobile touch tracking configuration
trigger_div.addEventListener("touchstart", start_drag, { passive: true });
document.addEventListener("touchmove", move_drag, { passive: false });
document.addEventListener("touchend", stop_drag);

// Desktop mouse tracking fallback configuration
trigger_div.addEventListener("mousedown", start_drag);
document.addEventListener("mousemove", move_drag);
document.addEventListener("mouseup", stop_drag);
```

---

## Common Misconceptions and Critical Warnings

### 1. Touch Event Coordination Conflict (`passive: false`)
A common issue during mobile reverse-engineering setups occurs when the floating button gets stuck during touch dragging, or drags the background page with it. 

To prevent the browser from prioritizing native page scrolling over interface movement, the document-level tracking link must explicitly specify `{ passive: false }`. This configuration parameter allows `move_drag` to intercept and safely cancel structural host scrolling artifacts during active dragging sequences.

### 2. Desktop Event Fallback Redundancies
Developers often wonder why desktop listeners (`mousedown`, `mousemove`) exist if the `pointerdown` tracking rule hides the button on desktop systems. 

These configurations act as an essential fallback mechanism. In combined environments (such as touchscreen laptops or devices swapping peripherals between mouse and touch profiles), this setup ensures layout repositioning functions continue to execute normally with zero boundary crashes.