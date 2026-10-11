export const get = (key, fallback) =>
  (typeof GM_getValue === "function" ? GM_getValue(key, fallback) : fallback);

export const set = (key, val) =>
  (typeof GM_setValue == "function" ? GM_setValue(key, val) : null)