let g_get;
let g_set;
let tmp_db = undefined;

// i don't know if there's a better way, but i believe this is the fastest way for me
// checks if has built-in function support
if (
  typeof GM_getValue === "function" &&
  typeof GM_setValue === "function"
) {
  g_get = (key, fallback) =>
    (typeof GM_getValue === "function" ? GM_getValue(key, fallback) : fallback);

  g_set = (key, val) =>
    (typeof GM_setValue == "function" ? GM_setValue(key, val) : null)
} else {
  // doesn't have built-in function support
  tmp_db = new Map();
  g_get = (key, fallback) =>
    tmp_db.has(key) ? tmp_db.get(key) : fallback;

  g_set = (key, val) =>
    tmp_db.set(key, val);
}

// export the get() and set() function
export const get = g_get;
export const set = g_set;