import Bun from "bun";
import fs from "node:fs";

// get data for header
const year = new Date().getFullYear();
const author = JSON.parse(fs.readFileSync("./package.json", "utf-8"))?.author?.name;

// gplv3 header
const gpl_v3_notice = `/**
 * <one line to give the program's name and a brief idea of what it does.>
 * Copyright (C) ${year} ${author}
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
`

// build the framework for browser
// unminified build
await Bun.build({
  entrypoints: ["./kumiyui.bundle.js"],
  outdir: "./cdn_build/dist",
  naming: "kumiyui.js",
  target: "browser",
  format: "iife",
  minify: false,
  banner: gpl_v3_notice
})

// minify build
await Bun.build({
  entrypoints: ["./kumiyui.bundle.js"],
  outdir: "./cdn_build/dist",
  naming: "kumiyui.min.js",
  target: "browser",
  format: "iife",
  minify: true,
  banner: gpl_v3_notice
})