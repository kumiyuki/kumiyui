#!/usr/bin/env bun
import Bun from "bun";
import fs from "node:fs";
import path from "node:path";

const MAX_PADDING_LEN = 50;
const FRAMEWORK_CDN = "https://cdn.jsdelivr.net/gh/kumiyuki/kumiyui@HEAD/cdn_build/dist/kumiyui.min.js";
const gen_header = (config, bundle_kumiyui) => {
  let header = "// ==UserScript==\n";
  let padding_len = 20;

  // hardcoded headers
  // it's required because user might break the framework if missing these changes
  // so even if you do something, please don't try to remove those permissions
  const required_grants = [
    "GM_setValue",
    "GM_getValue",
    "GM_registerMenuCommand",
    "GM_unregisterMenuCommand"
  ]

  // make sure grant array exist
  if (
    typeof config?.grant !== "object" ||
    !Array.isArray(config?.grant)
  ) config.grant = [];

  // applying required grants
  required_grants.forEach((perm) => {
    const index = config.grant.findIndex((el) => el === perm) ?? -1;
    if (index === -1)
      config.grant.push(perm);
  })

  // for kumiyui framework import
  if (!bundle_kumiyui) {
    if (
      typeof config?.require !== "object" ||
      !Array.isArray(config?.require)
    ) {
      config.require = [FRAMEWORK_CDN];
    } else {
      if (!config.require.includes(FRAMEWORK_CDN))
        config.require.push(FRAMEWORK_CDN);
    }
  }

  // must run at document-start for hooking at higher privilege
  config["run-at"] = "document-start";

  // get metadata keys and calculate padding length
  const metadata_keys = Object.keys(config);
  const keys_maxlen = Math.max(...metadata_keys.map(str => str.length));

  // only update the padding length if it's longer than the current padding length
  if (keys_maxlen >= padding_len) {
    padding_len = Math.max(
      Math.min(keys_maxlen + 4, MAX_PADDING_LEN),
      20 // default padding length
    );
  }

  // render header
  for (const metad_key of metadata_keys) {
    // check if data is valid
    const data = config[metad_key];
    if (typeof data === "undefined")
      continue;

    // this header is advanced? they can add multiple times?
    if (Array.isArray(data)) {
      data.forEach((content) => {
        // a bit of overhead to avoid removing all permissions.
        // avoid remove all "grants" (permissions) by using "none"
        // sorry, but this is required, or else some functions in the framework might break and malfunction
        // if you plan to edit them, make sure to know what you are doing
        if (
          metad_key === "grant" &&
          content?.toString().toLowerCase().replaceAll(" ", "") === "none"
        ) return;

        // adding header
        header += `// @${metad_key}`.padEnd(padding_len, " ") + `${content}\n`
      })
    } else {
      // render basic header
      header += `// @${metad_key}`.padEnd(padding_len, " ") + `${data}\n`;
    }
  }

  // return header
  header += "// ==/UserScript==\n\n";
  return header;
}

const buildScript = async ({ bundle_kumiyui, external_package, minify, ignore_use_strict, config, entry_file, outp_path }) => {
  console.log("build project based on kumiyui");

  // make the __require() function by Bun.build() load the banner
  /* original code
  const require = (module_name) => {
    if (module_name === "kumiyui") return window.Kumiyui;
    throw new Error("Dynamic require of " + moduleName + " is not supported.");
  };
  */
  const kumiyui_require_banner = `const require=r=>{if("kumiyui"===r)return window.Kumiyui;throw new Error("Dynamic require of "+moduleName+" is not supported.")};`;

  // using bun's build api
  const result = await Bun.build({
    entrypoints: [entry_file],
    target: "browser",
    minify: minify,
    external: !bundle_kumiyui ? ["kumiyui"] : [],

    // leaves undefined so it makes Bun.build uses the default value
    packages: external_package ? "external" : undefined,
    format: !bundle_kumiyui ? "iife" : undefined,
    banner: (!bundle_kumiyui && !minify) ? kumiyui_require_banner : undefined
  })

  if (!result.success) {
    console.log(`build failed:`, result.logs);
    return;
  }

  // bundle header + code
  const bundled_code = await result.outputs[0].text();
  const use_strict_text = !ignore_use_strict ? `"use strict";\n` : "";
  const require_banner_build = minify ? kumiyui_require_banner : "";
  const bundled_outp = gen_header(config, bundle_kumiyui) + use_strict_text + require_banner_build + bundled_code;

  // create dist if doesn't exist
  // avoid toctou stuff by doing this
  try {
    fs.mkdirSync(path.dirname(outp_path))
  } catch {}

  // write output into file
  fs.writeFileSync(outp_path, bundled_outp);

  // build finished
  console.log("build finished!")
}

const main = async () => {
  const args = process.argv.slice(2);

  // flags for building
  const help = process.argv.includes("-h") || process.argv.includes("--help");
  const minify = process.argv.includes("-m") || process.argv.includes("--minify");
  const build_both = process.argv.includes("-b") || process.argv.includes("--both");
  const ignore_use_strict = process.argv.includes("--ignore-use-strict");
  const bundle_kumiyui = process.argv.includes("--bundle-kumiyui");
  const external_package = process.argv.includes("--packages=external")

  // for help flag
  if (help) {
    console.log(`usage: kumiyui build [options]
    
    Options:
      -h, --help                Show this help message and exit
      -m, --minify              Build with code minification
      -b, --both                Output both minified and unminified userscripts
          --ignore-use-strict   Remove "use strict" directives from the build 
          --packages=external   Do not bundle npm dependencies (leaves import external)
          --bundle-kumiyui      Bundle the Kumiyui framework code into the userscript.
                                [warn]: static bundling might trigger GPLv3 copyleft.
                                I don't recommend bundling the framework unless your
                                project uses GPLv3 or a compatible license.
    `)
    return;
  }

  // only build command
  if (args[0] !== "build")
    return console.log("unknown command, try: kumiyui build");

  // the project uses this framework
  const project_root = process.cwd();
  const pkg_path = path.join(project_root, "package.json");

  if (!fs.existsSync(pkg_path))
    return console.error("no package.json found in the current directory.");

  const pkg = JSON.parse(fs.readFileSync(pkg_path, "utf-8"));
  const config = pkg.kumiyui || {};
  const entry_file = config.entry || "./index.js";
  const outp_path = config.output || "./dist/kumiyui.user.js";
  const minified_output_path = config.minified_output_path || outp_path;

  if (!fs.existsSync( path.join(project_root, entry_file) ))
    return console.error(`entry file not found, file name: ${entry_file}`);

  // bundle-kumiyui flag warns (i feel like adding 2 warnings)
  console.warn("[warning]:")
  console.warn(`
  static bundling might trigger GPLv3 copyleft.
  I don't recommend bundling the framework unless your
  project uses GPLv3 or a compatible license.
  `);

  // building
  if (build_both === true) {
    console.log(`building ${entry_file} (both minified and non-minified)...`);
    
    // minified build first
    await buildScript({
      bundle_kumiyui,
      external_package,
      minify: true,
      ignore_use_strict,
      config: config?.headers || {},
      entry_file,
      outp_path: minified_output_path
    });

    // non-minified build
    await buildScript({
      bundle_kumiyui,
      external_package,
      minify: false,
      ignore_use_strict,
      config: config?.headers || {},
      entry_file,
      outp_path
    });
  } else {
    console.log(`building ${entry_file} (${minify ? "minified" : "normal"})...`);
    await buildScript({
      bundle_kumiyui,
      external_package,
      minify,
      ignore_use_strict,
      config: config?.headers || {},
      entry_file,
      outp_path: minify
        ? minified_output_path
        : outp_path
    });
  }
}

main();