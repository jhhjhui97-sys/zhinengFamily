import http from "node:http";
import { randomBytes, createHash } from "node:crypto";
import {
  readFile,
  writeFile,
  mkdir,
  open,
  rename,
  unlink,
} from "node:fs/promises";
import { join, resolve, sep, extname } from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateGlb } from "./glb.mjs";
import { analyzeDxf, MAX_DXF_BYTES } from "./dxf-analyze.mjs";
const here = import.meta.dirname;
const BODY_LIMIT = 1024 * 1024;
const MODEL_LIMIT = 30 * 1024 * 1024;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const uploadPattern = new RegExp(`^/api/product-models/(${UUID})$`, "i");
const modelPattern = new RegExp(`^/local-models/(${UUID})\\.glb$`, "i");
const types = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
};
function finite(value) {
  if (typeof value === "number" && !Number.isFinite(value)) return false;
  if (value && typeof value === "object")
    return Object.values(value).every(finite);
  return true;
}
function bridge(config, body) {
  return new Promise((resolveReply) => {
    const child = execFile(
      config.bridgePath,
      [
        join(config.dataDirectory, "scenes.sqlite"),
        join(config.protocolDirectory, "scene.schema.json"),
        join(config.protocolDirectory, "two-bedroom.json"),
        join(config.publicDirectory, "catalog.json"),
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 32 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          resolveReply({
            status: 503,
            error: "本地资料服务暂时无法使用，请检查安装后重试。",
          });
          return;
        }
        try {
          const result = JSON.parse(stdout.replace(/^\uFEFF/, ""));
          if (
            !Number.isInteger(result.status) ||
            result.status < 200 ||
            result.status > 599
          )
            throw Error();
          resolveReply(result);
        } catch {
          resolveReply({
            status: 503,
            error: "本地资料服务暂时无法使用，请重试。",
          });
        }
      },
    );
    child.stdin.on("error", () => {});
    child.stdin.end(body);
  });
}
export function createLocalServer(options) {
  const config = {
    publicDirectory: join(here, "public"),
    protocolDirectory: join(here, "protocol"),
    vendorDirectory: join(here, "node_modules/three"),
    ...options,
  };
  const token = randomBytes(32).toString("hex"),
    nonce = randomBytes(18).toString("base64");
  return http.createServer(async (req, res) => {
    const port = res.socket.localPort,
      origin = `http://127.0.0.1:${port}`;
    const reply = (status, data) => {
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    const authorized = (write) =>
      (!write || req.headers.origin === origin) &&
      (req.headers.cookie ?? "")
        .split(";")
        .map((x) => x.trim())
        .includes(`local_session=${token}`);
    if (req.headers.host !== `127.0.0.1:${port}`) {
      reply(403, { error: "此服务仅允许本机访问。" });
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, origin).pathname);
    } catch {
      reply(404, { error: "找不到该页面。" });
      return;
    }
    const upload = pathname.match(uploadPattern);
    if (pathname === "/api/dxf/analyze" || pathname === "/api/dxf/archive") {
      if (req.method !== "POST")
        return reply(405, { error: "请求方式不支持。" });
      if (!authorized(true))
        return reply(403, { error: "请求来源无效，请重新打开本地软件。" });
      if (!/^application\/dxf(?:;|$)/i.test(req.headers["content-type"] ?? ""))
        return reply(415, { error: "请选择 DXF 户型文件。" });
      if (Number(req.headers["content-length"] ?? 0) > MAX_DXF_BYTES)
        return reply(413, { error: "DXF 文件不能超过 8 MiB。" });
      const timer = setTimeout(() => req.destroy(), 30000);
      req.setTimeout(15000, () => req.destroy());
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req.iterator({ destroyOnReturn: false })) {
          size += chunk.length;
          if (size > MAX_DXF_BYTES) {
            req.resume();
            return reply(413, { error: "DXF 文件不能超过 8 MiB。" });
          }
          chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        const analysis = await analyzeDxf(bytes);
        if (pathname === "/api/dxf/analyze")
          return reply(200, { data: analysis });
        const directory = join(config.dataDirectory, "floorplans");
        const temporary = join(
          directory,
          `.upload-${randomBytes(16).toString("hex")}`,
        );
        try {
          await mkdir(directory, { recursive: true });
          await writeFile(temporary, bytes, { flag: "wx" });
          await rename(temporary, join(directory, `${analysis.sha256}.dxf`));
        } finally {
          await unlink(temporary).catch(() => {});
        }
        return reply(200, { data: { sha256: analysis.sha256 } });
      } catch (error) {
        if (error.message?.includes("8 MiB"))
          return reply(413, { error: "DXF 文件不能超过 8 MiB。" });
        if (error.message?.includes("DXF"))
          return reply(422, { error: error.message });
        return reply(422, { error: "DXF 文件无法处理，请检查文件后重试。" });
      } finally {
        clearTimeout(timer);
        req.setTimeout(0);
      }
    }
    if (upload) {
      if (req.method !== "POST")
        return reply(405, { error: "请求方式不支持。" });
      if (!authorized(true))
        return reply(403, { error: "请求来源无效，请重新打开本地软件。" });
      if (
        !/^model\/gltf-binary(?:;|$)/i.test(req.headers["content-type"] ?? "")
      )
        return reply(415, { error: "请选择 GLB 格式的家具模型。" });
      const revision = req.headers["x-base-revision"];
      if (!/^[1-9]\d{0,14}$/.test(revision ?? ""))
        return reply(422, { error: "商品版本无效，请重新打开商品。" });
      if (Number(req.headers["content-length"] ?? 0) > MODEL_LIMIT)
        return reply(413, { error: "GLB 模型不能超过 30 MiB。" });
      const directory = join(config.dataDirectory, "models");
      const temporary = join(
        directory,
        `.upload-${randomBytes(16).toString("hex")}`,
      );
      const uploadTimeout = setTimeout(
        () => req.destroy(new Error("model upload timeout")),
        config.modelUploadTotalMs ?? 60000,
      );
      req.setTimeout(config.modelUploadIdleMs ?? 15000, () =>
        req.destroy(new Error("model upload idle timeout")),
      );
      let handle;
      try {
        await mkdir(directory, { recursive: true });
        handle = await open(temporary, "wx");
        let size = 0;
        const digest = createHash("sha256");
        for await (const chunk of req.iterator({ destroyOnReturn: false })) {
          size += chunk.length;
          if (size > MODEL_LIMIT) {
            req.resume();
            return reply(413, { error: "GLB 模型不能超过 30 MiB。" });
          }
          digest.update(chunk);
          for (let cursor = 0; cursor < chunk.length; ) {
            const { bytesWritten } = await handle.write(
              chunk,
              cursor,
              chunk.length - cursor,
            );
            if (!bytesWritten) throw Error("write failed");
            cursor += bytesWritten;
          }
        }
        await handle.close();
        handle = null;
        if (size > MODEL_LIMIT)
          return reply(413, { error: "GLB 模型不能超过 30 MiB。" });
        validateGlb(await readFile(temporary));
        const sha256 = digest.digest("hex");
        await rename(temporary, join(directory, `${sha256}.glb`));
        const result = await bridge(
          config,
          JSON.stringify({
            action: "model_attach",
            id: upload[1],
            base_revision: Number(revision),
            sha256,
            byte_count: size,
          }),
        );
        return reply(result.status, result);
      } catch {
        return reply(422, {
          error: "GLB 文件不完整、格式不受支持或引用了外部资源，请检查后重试。",
        });
      } finally {
        clearTimeout(uploadTimeout);
        req.setTimeout(0);
        if (handle) await handle.close().catch(() => {});
        await unlink(temporary).catch(() => {});
      }
    }
    const model = pathname.match(modelPattern);
    if (model) {
      if (req.method !== "GET" && req.method !== "HEAD")
        return reply(405, { error: "请求方式不支持。" });
      if (!authorized(false))
        return reply(403, { error: "请从本地软件打开模型。" });
      const result = await bridge(
        config,
        JSON.stringify({ action: "model_asset", id: model[1] }),
      );
      if (result.status !== 200) return reply(result.status, result);
      try {
        const content = await readFile(
          join(config.dataDirectory, "models", `${result.data.sha256}.glb`),
        );
        res.writeHead(200, {
          "content-type": "model/gltf-binary",
          "content-length": content.length,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        });
        return res.end(req.method === "HEAD" ? undefined : content);
      } catch {
        return reply(404, { error: "本机模型文件已丢失，请重新导入。" });
      }
    }
    if (pathname === "/api/local") {
      if (req.method !== "POST") {
        reply(405, { error: "请求方式不支持。" });
        return;
      }
      if (!authorized(true)) {
        reply(403, { error: "请求来源无效，请重新打开本地软件。" });
        return;
      }
      if (
        !/^application\/json(?:;|$)/i.test(req.headers["content-type"] ?? "")
      ) {
        reply(415, { error: "请提交 JSON 格式。" });
        return;
      }
      try {
        let size = 0,
          chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size <= BODY_LIMIT) chunks.push(chunk);
        }
        if (size > BODY_LIMIT) {
          reply(413, { error: "场景过大，请减少内容后重试。" });
          return;
        }
        const body = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(body);
        if (!parsed || Array.isArray(parsed) || !finite(parsed)) {
          reply(422, { error: "场景包含非法数值，请检查后重试。" });
          return;
        }
        await mkdir(config.dataDirectory, { recursive: true });
        const result = await bridge(config, body);
        reply(result.status, result);
      } catch {
        reply(422, { error: "输入不是合法 JSON，请检查后重试。" });
      }
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      reply(405, { error: "请求方式不支持。" });
      return;
    }
    const vendor = pathname.startsWith("/vendor/three/");
    const directory = resolve(
      vendor ? config.vendorDirectory : config.publicDirectory,
    );
    const relative = vendor
      ? pathname.slice("/vendor/three/".length)
      : pathname === "/"
        ? "index.html"
        : pathname.slice(1);
    const file = resolve(directory, relative);
    if (!file.startsWith(directory + sep) || !types[extname(file)]) {
      reply(404, { error: "找不到该文件。" });
      return;
    }
    try {
      let content = await readFile(file);
      const headers = {
        "content-type": types[extname(file)],
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "content-security-policy": `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'`,
      };
      if (pathname === "/") {
        content = Buffer.from(
          content.toString().replaceAll("__NONCE__", nonce),
        );
        headers["set-cookie"] =
          `local_session=${token}; HttpOnly; SameSite=Strict; Path=/`;
      }
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      reply(404, { error: "找不到该文件。" });
    }
  });
}
export function startLocal(options) {
  const server = createLocalServer(options);
  server.listen(0, "127.0.0.1", () =>
    console.log(`LOCAL_URL=http://127.0.0.1:${server.address().port}`),
  );
  return server;
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const root = resolve(here, "../..");
  startLocal({
    bridgePath:
      process.env.FAMILY_BRIDGE ??
      join(root, ".local/windows-bridge/LocalBridge.exe"),
    protocolDirectory:
      process.env.FAMILY_PROTOCOL ??
      join(root, "apps/unity-client/Assets/StreamingAssets"),
    dataDirectory:
      process.env.FAMILY_DATA ??
      join(process.env.LOCALAPPDATA ?? here, "ZhinengFamily"),
  });
}
