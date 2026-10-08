#!/usr/bin/env bun
import Bun from "bun";
import fs from "node:fs";
import path from "node:path";

const gen_header = (config) => {
  let header = "// ==UserScript==\n";
  let padding_len = 20;
  const advanced_metadata_keys = ["match", "include", "exclude", "exclude-match", "grant", "connect", "tag", "require", "resource"];

  // render basic header
  const metadata_keys = Object.keys(config);
  for (const metad_key of metadata_keys) {
    // make sure the metadata is not advanced
    if (advanced_metadata_keys.includes(metad_key))
      continue;

    // check if data is valid
    const data = config[metad_key];
    if (typeof data === "undefined")
      continue;

    // render it
    header += `// @${metad_key}`.padEnd(padding_len, " ") + `${data}\n`;
  }

  // for headers that can be defined multiple times
  for (const advanced_metad_key of advanced_metadata_keys) {
    // check if data is valid
    const data = config[advanced_metad_key];

    // only continue if metadata key exists
    if (typeof data !== "object")
      continue;

    // make sure it's an array
    if (!Array.isArray(data))
      continue;

    // render metadata for the header
    data.forEach(
      content => header += `// @${advanced_metad_key}`.padEnd(padding_len, " ") + `${content}\n`
    )
  }

  // return header
  header += "// ==/UserScript==\n\n";
  return header;
}

const buildScript = async ({ minify, config, entry_file, outp_file }) => {
  console.log("build project based on kumiyui");

  // using bun's build api
  const result = await Bun.build({
    entrypoints: [entry_file],
    target: "browser",
    minify: minify
  })

  if (!result.success) {
    console.log(`build failed:`, result.logs);
    return;
  }

  // bundle header + code
  const bundled_code = await result.outputs[0].text();
  const bundled_outp = gen_header(config) + bundled_code;

  // write output into file
  fs.writeFileSync(outp_file, bundled_outp);

  // build finished
  console.log("build finished!")
}

const main = async () => {
  const args = process.argv.slice(2);

  // a flag for minify build
  const minify = process.argv.includes("--minify");

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
  const outp_file = config.output || "./dist/kumiyui.user.js";

  if (!fs.existsSync( path.join(project_root, entry_file) ))
    return console.error(`entry file not found, file name: ${entry_file}`);

  // building
  console.log(`building ${entry_file}...`);
  await buildScript({
    minify,
    config: config?.headers || {},
    entry_file,
    outp_file
  });
}

main();