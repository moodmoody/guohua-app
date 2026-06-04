const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const TEST_INVITE_CODE = "studio-invite-123";

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to acquire free port")));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function createTempStorage(initialData = null) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "guohua-server-"));
  const uploadDir = path.join(tempRoot, "uploads");
  const dataDir = path.join(tempRoot, "data");
  const dataFile = path.join(dataDir, "paintings.json");
  const shimFile = path.join(tempRoot, "path-redirect.cjs");

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });
  if (initialData) {
    await fs.writeFile(dataFile, JSON.stringify(initialData, null, 2), "utf8");
  }

  await fs.writeFile(
    shimFile,
    [
      "const nodePath = require('node:path');",
      "const serverRoot = process.env.SERVER_ROOT;",
      "const uploadDir = process.env.UPLOAD_DIR;",
      "const dataFile = process.env.DATA_FILE;",
      "if (serverRoot && uploadDir && dataFile) {",
      "  const originalJoin = nodePath.join;",
      "  const repoUploadDir = originalJoin(serverRoot, 'uploads');",
      "  const repoDataDir = originalJoin(serverRoot, 'data');",
      "  const repoDataFile = originalJoin(repoDataDir, 'paintings.json');",
      "  const tempDataDir = nodePath.dirname(dataFile);",
      "  nodePath.join = (...parts) => {",
      "    const resolved = originalJoin(...parts);",
      "    if (resolved === repoUploadDir) return uploadDir;",
      "    if (resolved === repoDataDir) return tempDataDir;",
      "    if (resolved === repoDataFile) return dataFile;",
      "    return resolved;",
      "  };",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );

  return { tempRoot, uploadDir, dataFile, shimFile };
}

function startServer(port, storage) {
  const child = spawn(process.execPath, ["--require", storage.shimFile, "server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SERVER_ROOT: process.cwd(),
      UPLOAD_DIR: storage.uploadDir,
      DATA_FILE: storage.dataFile,
      LEGACY_USER_PASSWORD: "lulia-pass-123",
      REGISTRATION_INVITE_CODE: TEST_INVITE_CODE,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return {
    child,
    waitUntilReady: async () => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(`Server exited.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
        }
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
          if (res.status === 401) return;
        } catch (_error) {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out waiting.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    },
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        child.once("exit", resolve);
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 5000);
      });
    },
  };
}

async function startFixture(initialData = null) {
  const port = await getFreePort();
  const storage = await createTempStorage(initialData);
  const server = startServer(port, storage);
  await server.waitUntilReady();
  return { baseUrl: `http://127.0.0.1:${port}`, storage, server };
}

async function stopFixture(fixture) {
  await fixture.server.stop();
  await fs.rm(fixture.storage.tempRoot, { recursive: true, force: true });
}

module.exports = { startFixture, stopFixture, TEST_INVITE_CODE };
