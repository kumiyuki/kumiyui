# store
> [!NOTE]
> you can take a look at the command module code here: [../../../modules/store.js](../../../modules/store.js).

# Store Module Reference

The `store` module provides a unified data persistence interface across different browser runtime environments. It serves as an abstraction layer for storing and retrieving configuration flags, toggle choices, and module states.

---

## Technical Architecture and Persistence Fallbacks

The module evaluates the availability of environment storage contexts at boot to determine its data persistence strategy.

```javascript
// Internal framework boot evaluation structure:
if (
  typeof GM_getValue === "function" &&
  typeof GM_setValue === "function"
) {
  // Production-grade persistent storage tier (Userscript Environment)
} else {
  // Session-isolated temporary memory storage tier (Sandbox/Iframe Fallback)
}
```

### Storage Persistence Matrix

| Environment Context | Storage API Utilized | Persistence Type | Scope Lifespan |
| :--- | :--- | :--- | :--- |
| **Userscript Engines** (Tampermonkey, Violentmonkey, etc.) | `GM_getValue` / `GM_setValue` | Persistent | Permanent across sessions, page reloads, and browser restarts. |
| **Standard Browser Contexts** (Iframes, Sandboxes, Native console injections) | Internal `Map` cache structure | Volatile (In-Memory) | Transient. Wiped completely upon page reload or navigation change. |

---

## Storing and Retrieving Values

The module exports two core functional entry points: `get` and `set`.

```javascript
import { get, set } from "kumiyui";

// 1. Storing data configurations into the persistent database layer
set("user_preference_darkmode", true);

// 2. Retrieving configuration parameters with fallback guards
const isDarkModeEnabled = get("user_preference_darkmode", false);
```

### 📋 API Reference

#### `set(key, val)`
Writes or overwrites a value inside the active database layer.
* **`key`** (`string`): The precise lookup address descriptor key.
* **`val`** (`any`): The data payload to commit to storage.

#### `get(key, fallback)`
Reads a value from the active database layer.
* **`key`** (`string`): The target lookup address descriptor key.
* **`fallback`** (`any`): The default backup value returned if the specified key does not exist within the storage cache database.

---

## Common Misconceptions and Critical Warnings

### 1. Volatile Memory Loss inside Sandbox Containers
A frequent configuration trap for developers involves utilizing storage logic inside sandboxed frames or cross-origin context environments where the extension manager fails to inject Grease-monkey standard functions (`GM_getValue` / `GM_setValue`).

The module prevents system crashes by automatically falling back to an internal volatile cache memory map (`tmp_db`). However, **any data committed while the runtime is forced into this fallback state will disappear permanently upon page refresh**. 

### 2. Synchronization Boundaries with `is_toggle` Framework Targets
When constructing functional tools via the `Command` module and specifying `is_toggle: true`, the framework internally maps your configurations straight to this module under explicit key tracks matching the pattern: `toggle.<base64_encoded_command>`. 

If your execution context runs inside an environment where the volatile memory backup is active, toggled feature parameters will fail to auto-boot or persist across user navigation loops.