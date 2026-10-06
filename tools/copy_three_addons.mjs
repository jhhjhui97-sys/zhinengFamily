import { readdir, readFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, dirname, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";

const imports = (text) =>
  [...text.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
const decoderFiles = [
  "libs/draco/gltf/draco_decoder.js",
  "libs/draco/gltf/draco_wasm_wrapper.js",
  "libs/draco/gltf/draco_decoder.wasm",
  "libs/draco/README.md",
  "libs/basis/basis_transcoder.js",
  "libs/basis/basis_transcoder.wasm",
  "libs/basis/README.md",
];

export async function copyThreeAddons({
  publicDirectory,
  vendorDirectory,
  destination,
}) {
  const addonRoot = resolve(vendorDirectory, "examples/jsm"),
    files = new Set(),
    queue = [];
  for (const entry of await readdir(publicDirectory, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
    const text = await readFile(resolve(entry.parentPath, entry.name), "utf8");
    for (const specifier of imports(text)) {
      if (specifier.startsWith("three/addons/"))
        queue.push(resolve(addonRoot, specifier.slice("three/addons/".length)));
    }
  }
  while (queue.length) {
    const file = queue.pop();
    if (!file.startsWith(addonRoot + sep) || extname(file) !== ".js")
      throw Error(
        "Three.js addon import is outside the supported local module directory.",
      );
    if (files.has(file)) continue;
    files.add(file);
    const text = await readFile(file, "utf8");
    for (const specifier of imports(text)) {
      if (specifier.startsWith("."))
        queue.push(resolve(dirname(file), specifier));
    }
  }
  for (const relative of decoderFiles) files.add(resolve(addonRoot, relative));
  for (const file of [...files].sort()) {
    const output = resolve(
      destination,
      "examples/jsm",
      file.slice(addonRoot.length + 1),
    );
    await mkdir(dirname(output), { recursive: true });
    await copyFile(file, output);
  }
  return [...files]
    .map((file) => file.slice(addonRoot.length + 1).replaceAll(sep, "/"))
    .sort();
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [publicDirectory, vendorDirectory, destination] = process.argv.slice(2);
  if (!publicDirectory || !vendorDirectory || !destination)
    throw Error("Specify public, Three.js and output directories.");
  const files = await copyThreeAddons({
    publicDirectory,
    vendorDirectory,
    destination,
  });
  console.log(`Copied ${files.length} local Three.js addon and decoder files.`);
}
