const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const TEST_INVITE_CODE = 'studio-invite-123';

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to acquire free port')));
        return;
      }
      const { port } = address;
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function createTempStorage() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'multi-upload-red-'));
  const uploadDir = path.join(tempRoot, 'uploads');
  const dataDir = path.join(tempRoot, 'data');
  const dataFile = path.join(dataDir, 'paintings.json');
  const shimFile = path.join(tempRoot, 'path-redirect.cjs');

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  const shimSource = [
    "const nodePath = require('node:path');",
    "const serverRoot = process.env.SERVER_ROOT;",
    "const uploadDir = process.env.UPLOAD_DIR;",
    "const dataFile = process.env.DATA_FILE;",
    'if (serverRoot && uploadDir && dataFile) {',
    '  const originalJoin = nodePath.join;',
    "  const repoUploadDir = originalJoin(serverRoot, 'uploads');",
    "  const repoDataDir = originalJoin(serverRoot, 'data');",
    "  const repoDataFile = originalJoin(repoDataDir, 'paintings.json');",
    '  const tempDataDir = nodePath.dirname(dataFile);',
    '  nodePath.join = (...parts) => {',
    '    const resolved = originalJoin(...parts);',
    '    if (resolved === repoUploadDir) return uploadDir;',
    '    if (resolved === repoDataDir) return tempDataDir;',
    '    if (resolved === repoDataFile) return dataFile;',
    '    return resolved;',
    '  };',
    '}',
    '',
  ].join('\n');

  await fs.writeFile(shimFile, shimSource, 'utf8');

  return { tempRoot, uploadDir, dataFile, shimFile };
}

function startServer(port, storage) {
  const child = spawn(process.execPath, ['--require', storage.shimFile, 'server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SERVER_ROOT: process.cwd(),
      UPLOAD_DIR: storage.uploadDir,
      DATA_FILE: storage.dataFile,
      LEGACY_USER_PASSWORD: 'lulia-pass-123',
      REGISTRATION_INVITE_CODE: TEST_INVITE_CODE,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  return {
    child,
    waitUntilReady: async () => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(
            `Server exited before becoming ready. exitCode=${child.exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`
          );
        }

        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
          if (res.status === 401) {
            return;
          }
        } catch (_error) {
          // Server not ready yet.
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      throw new Error(`Timed out waiting for server startup.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    },
    stop: async () => {
      if (child.exitCode !== null) {
        return;
      }

      child.kill('SIGTERM');
      await new Promise((resolve) => {
        child.once('exit', () => resolve());
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, 5000);
      });
    },
  };
}

let server;
let baseUrl;
let storage;
let authCookie;

test.before(async () => {
  const port = await getFreePort();
  storage = await createTempStorage();
  server = startServer(port, storage);
  await server.waitUntilReady();
  baseUrl = `http://127.0.0.1:${port}`;

  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'multi-upload-user',
      password: 'brush-pass-123',
      inviteCode: TEST_INVITE_CODE,
    }),
  });
  assert.equal(registerRes.status, 201);

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'multi-upload-user',
      password: 'brush-pass-123',
    }),
  });
  assert.equal(loginRes.status, 200);
  authCookie = loginRes.headers.get('set-cookie').split(';')[0];
});

test.after(async () => {
  if (server) {
    await server.stop();
  }
  if (storage?.tempRoot) {
    await fs.rm(storage.tempRoot, { recursive: true, force: true });
  }
});

function makePngBlob(seed) {
  const bytes = new Uint8Array([137, 80, 78, 71, seed, 10, 26, 10]);
  return new Blob([bytes], { type: 'image/png' });
}

function makeHeicBlob(seed) {
  const bytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, seed, 10, 26, 10]);
  return new Blob([bytes], { type: 'image/heic' });
}

function makeSizedPngBlob(sizeBytes, fillByte) {
  const bytes = Buffer.alloc(sizeBytes, fillByte);
  return new Blob([bytes], { type: 'image/png' });
}

function attachmentPathId(attachment) {
  const value = attachment?.id ?? path.basename(String(attachment?.url ?? ''));
  return String(value).trim();
}

function authHeaders(extra = {}) {
  return { ...extra, Cookie: authCookie };
}

test('single-file create endpoints are healthy for paintings and materials', async () => {
  const paintingForm = new FormData();
  paintingForm.append('title', 'Control Painting');
  paintingForm.append('category', 'control');
  paintingForm.append('description', 'Single-file control create');
  paintingForm.append('image', makePngBlob(9), 'control-painting.png');

  const paintingRes = await fetch(`${baseUrl}/api/paintings`, {
    method: 'POST',
    headers: authHeaders(),
    body: paintingForm,
  });

  assert.equal(paintingRes.status, 201);
  const paintingBody = await paintingRes.json();
  assert.equal(typeof paintingBody, 'object');
  assert.equal(Array.isArray(paintingBody), false);
  assert.equal(typeof paintingBody.id, 'number');
  assert.equal(typeof paintingBody.imageUrl, 'string');

  const materialForm = new FormData();
  materialForm.append('title', 'Control Material');
  materialForm.append('category', 'control');
  materialForm.append('description', 'Single-file control create');
  materialForm.append('asset', makePngBlob(10), 'control-material.png');

  const materialRes = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: authHeaders(),
    body: materialForm,
  });

  assert.equal(materialRes.status, 201);
  const materialBody = await materialRes.json();
  assert.equal(typeof materialBody, 'object');
  assert.equal(Array.isArray(materialBody), false);
  assert.equal(typeof materialBody.id, 'number');
  assert.equal(typeof materialBody.assetUrl, 'string');
});

test('POST /api/paintings with multiple images returns one object with attachments[2]', async () => {
  const form = new FormData();
  form.append('title', 'Multi Image Painting');
  form.append('category', 'landscape');
  form.append('description', 'Expect one record with attachments');
  form.append('image', makePngBlob(1), 'painting-1.png');
  form.append('image', makePngBlob(2), 'painting-2.png');

  const res = await fetch(`${baseUrl}/api/paintings`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  assert.equal(res.status, 201);

  const body = await res.json();
  assert.equal(Array.isArray(body), false, 'expected a single record object, got array');
  assert.ok(Array.isArray(body.attachments), 'expected attachments array on returned record');
  assert.equal(body.attachments.length, 2);

  const listRes = await fetch(`${baseUrl}/api/paintings`, { headers: authHeaders() });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(Array.isArray(listBody.items), 'expected list endpoint to return paginated items');
  const created = listBody.items.find((item) => item.id === body.id);
  assert.ok(created, 'expected created painting to exist in list response');
  assert.equal(Array.isArray(created.attachments), true);
  assert.equal(created.attachments.length, 2);
});

test('POST /api/paintings accepts iPhone HEIC images', async () => {
  const form = new FormData();
  form.append('title', 'HEIC Painting');
  form.append('category', 'mobile');
  form.append('description', 'Uploaded from iPhone');
  form.append('image', makeHeicBlob(1), 'iphone-photo.heic');

  const res = await fetch(`${baseUrl}/api/paintings`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.imageUrl.endsWith('.heic'), true);
  assert.equal(body.attachments[0].url.endsWith('.heic'), true);
});

test('POST /api/paintings rejects images over the 10MB limit with a clear reason', async () => {
  const form = new FormData();
  form.append('title', 'Large Mobile Photo');
  form.append('category', 'mobile');
  form.append('description', 'Original phone photo before browser compression');
  form.append('image', makeSizedPngBlob(20 * 1024 * 1024, 17), 'large-mobile-photo.png');

  const res = await fetch(`${baseUrl}/api/paintings`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'Image file must be <= 10MB');
});

test('POST /api/paintings/:id/attachments accepts iPhone HEIC images', async () => {
  const createForm = new FormData();
  createForm.append('title', 'HEIC Attachment Base');
  createForm.append('category', 'mobile');
  createForm.append('description', 'Create one attachment first');
  createForm.append('image', makePngBlob(41), 'heic-base.png');

  const createRes = await fetch(`${baseUrl}/api/paintings`, {
    method: 'POST',
    headers: authHeaders(),
    body: createForm,
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();

  const appendForm = new FormData();
  appendForm.append('image', makeHeicBlob(2), 'iphone-append.heic');

  const appendRes = await fetch(`${baseUrl}/api/paintings/${created.id}/attachments`, {
    method: 'POST',
    headers: authHeaders(),
    body: appendForm,
  });

  assert.equal(appendRes.status, 200);
  const appendBody = await appendRes.json();
  assert.equal(appendBody.attachments.length, created.attachments.length + 1);
  assert.equal(appendBody.attachments.at(-1).url.endsWith('.heic'), true);
});

test('POST /api/materials with multiple assets returns one object with attachments[2]', async () => {
  const form = new FormData();
  form.append('title', 'Multi Asset Material');
  form.append('category', 'reference');
  form.append('description', 'Expect one record with attachments');
  form.append('asset', makePngBlob(3), 'material-1.png');
  form.append('asset', makePngBlob(4), 'material-2.png');

  const res = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  assert.equal(res.status, 201);

  const body = await res.json();
  assert.equal(Array.isArray(body), false, 'expected a single record object, got array');
  assert.ok(Array.isArray(body.attachments), 'expected attachments array on returned record');
  assert.equal(body.attachments.length, 2);

  const listRes = await fetch(`${baseUrl}/api/materials`, { headers: authHeaders() });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(Array.isArray(listBody.items), 'expected list endpoint to return paginated items');
  const created = listBody.items.find((item) => item.id === body.id);
  assert.ok(created, 'expected created material to exist in list response');
  assert.equal(Array.isArray(created.attachments), true);
  assert.equal(created.attachments.length, 2);
});

test('POST /api/materials accepts HEIC images from mobile photo libraries', async () => {
  const form = new FormData();
  form.append('title', 'HEIC Material');
  form.append('category', 'reference');
  form.append('description', 'Uploaded from iPhone');
  form.append('asset', makeHeicBlob(3), 'iphone-reference.heic');

  const res = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.assetUrl.endsWith('.heic'), true);
  assert.equal(body.attachments[0].url.endsWith('.heic'), true);
});

test('POST /api/materials accepts 81MB uploads within the deployed limit', async () => {
  const form = new FormData();
  form.append('title', 'Large Material Upload');
  form.append('category', 'reference');
  form.append('description', 'Should accept materials above 80MB');
  form.append('asset', makeSizedPngBlob(81 * 1024 * 1024, 5), 'large-material.png');

  const res = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  assert.equal(res.status, 201);

  const body = await res.json();
  assert.equal(body.title, 'Large Material Upload');
  assert.equal(Array.isArray(body.attachments), true);
  assert.equal(body.attachments.length, 1);
});

test('POST /api/materials/:id/attachments appends multiple assets to existing attachments', async () => {
  const createForm = new FormData();
  createForm.append('title', 'Append Asset Material');
  createForm.append('category', 'reference');
  createForm.append('description', 'Create one attachment first');
  createForm.append('asset', makePngBlob(11), 'append-base.png');

  const createRes = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: authHeaders(),
    body: createForm,
  });

  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.ok(Array.isArray(created.attachments));
  assert.equal(created.attachments.length, 1);

  const appendForm = new FormData();
  appendForm.append('asset', makePngBlob(12), 'append-1.png');
  appendForm.append('asset', makePngBlob(13), 'append-2.png');

  const appendRes = await fetch(`${baseUrl}/api/materials/${created.id}/attachments`, {
    method: 'POST',
    headers: authHeaders(),
    body: appendForm,
  });

  assert.ok(
    appendRes.status >= 200 && appendRes.status < 300,
    `expected success status when appending attachments, got ${appendRes.status}`
  );
  const appendBody = await appendRes.json();
  assert.ok(Array.isArray(appendBody.attachments));
  assert.equal(appendBody.attachments.length, created.attachments.length + 2);

  const getRes = await fetch(`${baseUrl}/api/materials/${created.id}`, { headers: authHeaders() });
  assert.equal(getRes.status, 200);
  const persisted = await getRes.json();
  assert.ok(Array.isArray(persisted.attachments));
  assert.equal(persisted.attachments.length, created.attachments.length + 2);
});

test('DELETE /api/paintings/:id/attachments/:attachmentId removes one attachment', async () => {
  const createForm = new FormData();
  createForm.append('title', 'Delete One Attachment Painting');
  createForm.append('category', 'study');
  createForm.append('description', 'Create painting with 2 attachments');
  createForm.append('image', makePngBlob(21), 'delete-1.png');
  createForm.append('image', makePngBlob(22), 'delete-2.png');

  const createRes = await fetch(`${baseUrl}/api/paintings`, {
    method: 'POST',
    headers: authHeaders(),
    body: createForm,
  });

  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.ok(Array.isArray(created.attachments));
  assert.ok(created.attachments.length >= 2);

  const attachmentId = attachmentPathId(created.attachments[0]);
  assert.ok(attachmentId, 'expected a usable attachment id');

  const deleteRes = await fetch(
    `${baseUrl}/api/paintings/${created.id}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE', headers: authHeaders() }
  );

  assert.ok(
    deleteRes.status >= 200 && deleteRes.status < 300,
    `expected success status when deleting one attachment, got ${deleteRes.status}`
  );

  const getRes = await fetch(`${baseUrl}/api/paintings/${created.id}`, { headers: authHeaders() });
  assert.equal(getRes.status, 200);
  const afterDelete = await getRes.json();
  assert.ok(Array.isArray(afterDelete.attachments));
  assert.equal(afterDelete.attachments.length, created.attachments.length - 1);
  const persistedAttachmentIds = afterDelete.attachments.map((attachment) => attachmentPathId(attachment));
  assert.equal(
    persistedAttachmentIds.includes(attachmentId),
    false,
    `expected deleted attachment id "${attachmentId}" to be absent from persisted attachments`
  );
});

test('DELETE /api/paintings/:id/attachments/:attachmentId rejects deleting the last attachment', async () => {
  const createForm = new FormData();
  createForm.append('title', 'Last Attachment Guard Painting');
  createForm.append('category', 'study');
  createForm.append('description', 'Create painting with 1 attachment');
  createForm.append('image', makePngBlob(31), 'last-1.png');

  const createRes = await fetch(`${baseUrl}/api/paintings`, {
    method: 'POST',
    headers: authHeaders(),
    body: createForm,
  });

  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.ok(Array.isArray(created.attachments));
  assert.equal(created.attachments.length, 1);

  const attachmentId = attachmentPathId(created.attachments[0]);
  assert.ok(attachmentId, 'expected a usable attachment id');

  const deleteUrl = `${baseUrl}/api/paintings/${created.id}/attachments/${encodeURIComponent(attachmentId)}`;
  const deleteRes = await fetch(deleteUrl, { method: 'DELETE', headers: authHeaders() });

  assert.equal(
    deleteRes.status,
    400,
    `expected DELETE last-attachment guard to return 400 (must keep at least one attachment), got ${deleteRes.status} for ${deleteUrl}`
  );

  if (deleteRes.status === 400) {
    const contentType = String(deleteRes.headers.get('content-type') || '');
    let errorText = '';

    if (contentType.includes('application/json')) {
      const body = await deleteRes.json();
      errorText = String(body?.error ?? '');
    } else {
      errorText = await deleteRes.text();
    }

    assert.match(
      errorText.toLowerCase(),
      /at least one|last attachment|attachment|至少|保留/,
      'expected error text to indicate keeping at least one attachment'
    );
  }
});

test('legacy records with imageUrl/assetUrl are normalized to attachments', async () => {
  const now = new Date().toISOString();
  const legacyPayload = {
    paintingLastId: 1,
    materialLastId: 1,
    paintings: [
      {
        id: 1,
        title: 'Legacy Painting',
        category: 'legacy',
        description: 'old schema',
        imageUrl: '/uploads/legacy-painting.png',
        createdAt: now,
      },
    ],
    materials: [
      {
        id: 1,
        title: 'Legacy Material',
        category: 'legacy',
        description: 'old schema',
        assetType: 'video',
        assetUrl: '/uploads/legacy-material.mp4',
        createdAt: now,
      },
    ],
  };

  await fs.writeFile(storage.dataFile, JSON.stringify(legacyPayload, null, 2), 'utf8');

  const legacyLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'lulia', password: 'lulia-pass-123' }),
  });
  assert.equal(legacyLogin.status, 200);
  const legacyCookie = legacyLogin.headers.get('set-cookie').split(';')[0];

  const paintingsRes = await fetch(`${baseUrl}/api/paintings`, {
    headers: { Cookie: legacyCookie },
  });
  assert.equal(paintingsRes.status, 200);
  const paintings = await paintingsRes.json();
  const legacyPainting = paintings.items.find((item) => item.id === 1);
  assert.ok(legacyPainting, 'expected legacy painting record to be returned');
  assert.ok(Array.isArray(legacyPainting.attachments), 'expected painting attachments array');
  assert.equal(legacyPainting.attachments.length, 1);
  assert.equal(legacyPainting.attachments[0].url, '/uploads/legacy-painting.png');
  assert.equal(legacyPainting.attachments[0].type, 'image');

  const materialsRes = await fetch(`${baseUrl}/api/materials`, {
    headers: { Cookie: legacyCookie },
  });
  assert.equal(materialsRes.status, 200);
  const materials = await materialsRes.json();
  const legacyMaterial = materials.items.find((item) => item.id === 1);
  assert.ok(legacyMaterial, 'expected legacy material record to be returned');
  assert.ok(Array.isArray(legacyMaterial.attachments), 'expected material attachments array');
  assert.equal(legacyMaterial.attachments.length, 1);
  assert.equal(legacyMaterial.attachments[0].url, '/uploads/legacy-material.mp4');
  assert.equal(legacyMaterial.attachments[0].type, 'video');
});
