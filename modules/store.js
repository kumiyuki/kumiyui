export default {
  get: (key, fallback) =>
    (typeof GM_getValue !== "undefined" ? GM_getValue(key, fallback) : fallback),
  set: (key, val) =>
    (typeof GM_setValue !== "undefined" ? GM_setValue(key, val) : null)
}