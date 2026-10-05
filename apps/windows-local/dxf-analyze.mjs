import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

export const MAX_DXF_BYTES = 8 * 1024 * 1024;

export async function analyzeDxf(bytes, timeoutMs = 5000) {
  if (
    !(bytes instanceof Uint8Array) ||
    !bytes.length ||
    bytes.length > MAX_DXF_BYTES
  )
    throw Error("DXF 文件为空或超过 8 MiB。");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const copy = Uint8Array.from(bytes);
  const worker = new Worker(new URL("./dxf-worker.mjs", import.meta.url));
  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("DXF 解析超时，请简化图纸。")),
        timeoutMs,
      );
      const done = (callback) => (value) => {
        clearTimeout(timer);
        callback(value);
      };
      worker.once("message", done(resolve));
      worker.once("error", done(reject));
      worker.once("exit", (code) => {
        if (code !== 0) done(reject)(Error("DXF 解析中断，请检查文件。"));
      });
      worker.postMessage(copy, [copy.buffer]);
    });
    if (result.error) throw Error(result.error);
    return { ...result.data, sha256 };
  } finally {
    await worker.terminate();
  }
}
