const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "uploads");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "paintings.json");

const paintingTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const materialTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
]);

const IMAGE_LIMIT = 10 * 1024 * 1024;
const MATERIAL_LIMIT = 100 * 1024 * 1024;
const AVATAR_LIMIT = 5 * 1024 * 1024;
const MAX_UPLOAD_FILES_PER_REQUEST = 10;
const PUBLIC_CACHE_MS = 60 * 60 * 1000;
const UPLOAD_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = "guohua_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";
const DEFAULT_USER_USERNAME = "lulia";
const DEFAULT_LIST_PAGE_SIZE = 6;
const MAX_LIST_PAGE_SIZE = 24;
let generatedLegacyPassword = "";
let legacyPasswordLogged = false;

function sanitizeBaseName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const safeBase = path
    .basename(fileName, ext)
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return { ext, safeBase: safeBase || "file" };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const { ext, safeBase } = sanitizeBaseName(file.originalname);
    cb(null, `${Date.now()}-${safeBase}${ext || ".dat"}`);
  },
});

function createUploader({ allowedTypes, maxFileSize, typeMessage }) {
  return multer({
    storage,
    limits: { fileSize: maxFileSize },
    fileFilter: (_req, file, cb) => {
      if (!allowedTypes.has(file.mimetype)) {
        return cb(new Error(typeMessage));
      }
      cb(null, true);
    },
  });
}

const uploadPainting = createUploader({
  allowedTypes: paintingTypes,
  maxFileSize: IMAGE_LIMIT,
  typeMessage: "Only JPG / PNG / WEBP images are supported",
});

const uploadMaterial = createUploader({
  allowedTypes: materialTypes,
  maxFileSize: MATERIAL_LIMIT,
  typeMessage: "Only JPG / PNG / WEBP images and MP4 / WEBM / MOV / MKV videos are supported",
});

const uploadAvatar = createUploader({
  allowedTypes: paintingTypes,
  maxFileSize: AVATAR_LIMIT,
  typeMessage: "Only JPG / PNG / WEBP avatar images are supported",
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { maxAge: PUBLIC_CACHE_MS }));
app.use("/uploads", express.static(uploadDir, { immutable: true, maxAge: UPLOAD_CACHE_MS }));

function getMaxId(items) {
  return items.reduce((max, item) => {
    const id = Number(item?.id);
    return Number.isInteger(id) && id > max ? id : max;
  }, 0);
}

function normalizeUsername(value) {
  return trimText(value).toLowerCase();
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto
    .pbkdf2Sync(String(password || ""), salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString("hex");
  return `pbkdf2$${PASSWORD_ITERATIONS}$${PASSWORD_DIGEST}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") {
    return false;
  }

  const [_prefix, iterations, digest, salt, hash] = parts;
  const candidate = crypto
    .pbkdf2Sync(String(password || ""), salt, Number(iterations), PASSWORD_KEY_LENGTH, digest)
    .toString("hex");
  const stored = Buffer.from(hash, "hex");
  const incoming = Buffer.from(candidate, "hex");
  return stored.length === incoming.length && crypto.timingSafeEqual(stored, incoming);
}

function validatePassword(password) {
  if (String(password || "").length < 8) {
    return "Password must be at least 8 characters";
  }
  return "";
}

function normalizeUserRecord(user = {}) {
  const username = normalizeUsername(user.username);
  const now = new Date().toISOString();
  return {
    id: Number(user.id),
    username,
    passwordHash: String(user.passwordHash || ""),
    displayName: trimText(user.displayName) || username,
    bio: trimText(user.bio),
    avatarUrl: trimText(user.avatarUrl),
    createdAt: trimText(user.createdAt) || now,
    updatedAt: trimText(user.updatedAt) || trimText(user.createdAt) || now,
  };
}

function createDefaultUser(id) {
  const password = process.env.LEGACY_USER_PASSWORD || generatedLegacyPassword || crypto.randomBytes(18).toString("base64url");
  generatedLegacyPassword = password;
  if (!process.env.LEGACY_USER_PASSWORD && !legacyPasswordLogged) {
    console.log(`Generated ${DEFAULT_USER_USERNAME} user password: ${password}`);
    legacyPasswordLogged = true;
  }

  const now = new Date().toISOString();
  return {
    id,
    username: DEFAULT_USER_USERNAME,
    passwordHash: hashPassword(password),
    displayName: DEFAULT_USER_USERNAME,
    bio: "",
    avatarUrl: "",
    createdAt: now,
    updatedAt: now,
  };
}

function parseCookies(req) {
  const cookieHeader = String(req.headers.cookie || "");
  return cookieHeader.split(";").reduce((cookies, pair) => {
    const index = pair.indexOf("=");
    if (index < 0) {
      return cookies;
    }
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
    return cookies;
  }, {});
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

function createSession(db, userId) {
  const now = new Date();
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    id: token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  db.sessions.push(session);
  return session;
}

function findSessionUser(db, req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) {
    return { token: "", session: null, user: null };
  }
  const now = Date.now();
  const session = db.sessions.find(
    (item) => item.id === token && Date.parse(item.expiresAt) > now
  );
  const user = session ? db.users.find((item) => item.id === session.userId) : null;
  return { token, session: user ? session : null, user: user || null };
}

async function requireUser(req, res, next) {
  try {
    const db = await readDb();
    const { user } = findSessionUser(db, req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

function belongsToUser(item, user) {
  return Number(item?.ownerUserId) === Number(user?.id);
}

function ownedItems(items, user) {
  return items.filter((item) => belongsToUser(item, user));
}

function extractAttachmentUrl(attachment) {
  if (typeof attachment === "string") {
    return trimText(attachment);
  }
  return trimText(attachment?.url ?? attachment?.imageUrl ?? attachment?.assetUrl);
}

function extractAttachmentId(attachment) {
  return trimText(attachment?.id);
}

function attachmentIdFromUrl(url) {
  const normalizedUrl = trimText(url);
  if (!normalizedUrl) {
    return "";
  }
  return trimText(path.basename(normalizedUrl));
}

function toAttachmentRecord({ id, url, type }) {
  const normalizedUrl = extractAttachmentUrl({ url });
  if (!normalizedUrl) {
    return null;
  }
  const normalizedId = trimText(id) || attachmentIdFromUrl(normalizedUrl);
  return {
    id: normalizedId || undefined,
    url: normalizedUrl,
    type,
  };
}

function buildPaintingAttachmentFromFile(file) {
  return toAttachmentRecord({
    id: file?.filename,
    url: file?.filename ? `/uploads/${file.filename}` : "",
    type: "image",
  });
}

function buildMaterialAttachmentFromFile(file) {
  return toAttachmentRecord({
    id: file?.filename,
    url: file?.filename ? `/uploads/${file.filename}` : "",
    type: file?.mimetype?.startsWith("video/") ? "video" : "image",
  });
}

function findAttachmentIndex(attachments, targetAttachmentId) {
  const target = trimText(targetAttachmentId);
  if (!target) {
    return -1;
  }

  return attachments.findIndex((attachment) => {
    const attachmentId = extractAttachmentId(attachment);
    const attachmentUrl = extractAttachmentUrl(attachment);
    return attachmentId === target || attachmentIdFromUrl(attachmentUrl) === target;
  });
}

function inferAssetTypeFromUrl(url) {
  return /\.(mp4|webm|mov|mkv)$/i.test(url) ? "video" : "image";
}

function normalizeAssetType(type, url = "") {
  if (type === "video" || type === "image") {
    return type;
  }
  return inferAssetTypeFromUrl(url);
}

function normalizePaintingRecord(item = {}) {
  const legacyImageUrl = trimText(item.imageUrl);
  const attachments = Array.isArray(item.attachments)
    ? item.attachments
        .map((attachment) => {
          const url = extractAttachmentUrl(attachment);
          if (!url) {
            return null;
          }
          return toAttachmentRecord({
            id: extractAttachmentId(attachment),
            url,
            type: "image",
          });
        })
        .filter(Boolean)
    : [];

  if (legacyImageUrl) {
    if (attachments.length === 0) {
      attachments.push(
        toAttachmentRecord({
          id: attachmentIdFromUrl(legacyImageUrl),
          url: legacyImageUrl,
          type: "image",
        })
      );
    } else {
      attachments[0] = toAttachmentRecord({
        ...attachments[0],
        url: legacyImageUrl,
        type: "image",
      });
    }
  }

  const firstAttachment = attachments[0];
  return {
    ...item,
    imageUrl: firstAttachment ? firstAttachment.url : legacyImageUrl,
    attachments,
  };
}

function normalizeMaterialRecord(item = {}) {
  const legacyAssetUrl = trimText(item.assetUrl);
  const legacyAssetType = normalizeAssetType(item.assetType, legacyAssetUrl);
  const attachments = Array.isArray(item.attachments)
    ? item.attachments
        .map((attachment) => {
          const url = extractAttachmentUrl(attachment);
          if (!url) {
            return null;
          }
          return toAttachmentRecord({
            id: extractAttachmentId(attachment),
            url,
            type: normalizeAssetType(attachment?.type ?? attachment?.assetType, url),
          });
        })
        .filter(Boolean)
    : [];

  if (legacyAssetUrl) {
    const firstType = normalizeAssetType(
      attachments[0]?.type ?? legacyAssetType,
      legacyAssetUrl
    );
    if (attachments.length === 0) {
      attachments.push(
        toAttachmentRecord({
          id: attachmentIdFromUrl(legacyAssetUrl),
          url: legacyAssetUrl,
          type: firstType,
        })
      );
    } else {
      attachments[0] = toAttachmentRecord({
        ...attachments[0],
        url: legacyAssetUrl,
        type: firstType,
      });
    }
  }

  const firstAttachment = attachments[0];
  return {
    ...item,
    assetUrl: firstAttachment ? firstAttachment.url : legacyAssetUrl,
    assetType: firstAttachment
      ? normalizeAssetType(firstAttachment.type, firstAttachment.url)
      : legacyAssetType,
    attachments,
  };
}

function normalizeDb(raw = {}) {
  const now = Date.now();
  let users = Array.isArray(raw.users)
    ? raw.users
        .map((user) => normalizeUserRecord(user))
        .filter((user) => Number.isInteger(user.id) && user.id > 0 && user.username)
    : [];
  let userLastId = Number.isInteger(raw.userLastId) ? raw.userLastId : getMaxId(users);
  let defaultUser = users.find((user) => user.username === DEFAULT_USER_USERNAME);
  const legacyUsers = users.filter((user) => user.username === "legacy");
  let renamedLegacyUser = false;
  if (!defaultUser && legacyUsers.length > 0) {
    defaultUser = legacyUsers[0];
    defaultUser.username = DEFAULT_USER_USERNAME;
    renamedLegacyUser = true;
    if (defaultUser.displayName === "legacy") {
      defaultUser.displayName = DEFAULT_USER_USERNAME;
    }
    if (process.env.LEGACY_USER_PASSWORD) {
      defaultUser.passwordHash = hashPassword(process.env.LEGACY_USER_PASSWORD);
    }
    defaultUser.updatedAt = new Date().toISOString();
  }
  if (defaultUser && legacyUsers.length > 0) {
    const legacyUserIds = new Set(
      legacyUsers
        .filter((user) => user.id !== defaultUser.id)
        .map((user) => user.id)
    );
    raw.paintings = Array.isArray(raw.paintings)
      ? raw.paintings.map((item) => ({
          ...item,
          ownerUserId: legacyUserIds.has(item?.ownerUserId) ? defaultUser.id : item?.ownerUserId,
        }))
      : raw.paintings;
    raw.materials = Array.isArray(raw.materials)
      ? raw.materials.map((item) => ({
          ...item,
          ownerUserId: legacyUserIds.has(item?.ownerUserId) ? defaultUser.id : item?.ownerUserId,
        }))
      : raw.materials;
    raw.sessions = Array.isArray(raw.sessions)
      ? raw.sessions.map((session) => ({
          ...session,
          userId: legacyUserIds.has(session?.userId) ? defaultUser.id : session?.userId,
        }))
      : raw.sessions;
    if (!renamedLegacyUser && process.env.LEGACY_USER_PASSWORD && legacyUserIds.size > 0) {
      defaultUser.passwordHash = hashPassword(process.env.LEGACY_USER_PASSWORD);
      defaultUser.updatedAt = new Date().toISOString();
    }
    users = users.filter((user) => user.username !== "legacy");
  }
  const needsLegacyUser =
    (Array.isArray(raw.paintings) && raw.paintings.some((item) => !Number.isInteger(item?.ownerUserId))) ||
    (Array.isArray(raw.materials) && raw.materials.some((item) => !Number.isInteger(item?.ownerUserId)));
  if (needsLegacyUser && !defaultUser) {
    defaultUser = createDefaultUser(userLastId + 1);
    users.push(defaultUser);
    userLastId = defaultUser.id;
  }
  const defaultUserId = defaultUser?.id;

  const paintings = Array.isArray(raw.paintings)
    ? raw.paintings.map((item) => {
        const record = normalizePaintingRecord(item);
        return {
          ...record,
          ownerUserId: Number.isInteger(record.ownerUserId) ? record.ownerUserId : defaultUserId,
        };
      })
    : [];
  const materials = Array.isArray(raw.materials)
    ? raw.materials.map((item) => {
        const record = normalizeMaterialRecord(item);
        return {
          ...record,
          ownerUserId: Number.isInteger(record.ownerUserId) ? record.ownerUserId : defaultUserId,
        };
      })
    : [];
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.filter((session) => {
        return (
          trimText(session?.id) &&
          Number.isInteger(session.userId) &&
          Date.parse(session.expiresAt) > now
        );
      })
    : [];

  const normalizedPaintingLastId = Number.isInteger(raw.paintingLastId)
    ? raw.paintingLastId
    : Number.isInteger(raw.lastId)
      ? raw.lastId
      : getMaxId(paintings);

  const normalizedMaterialLastId = Number.isInteger(raw.materialLastId)
    ? raw.materialLastId
    : getMaxId(materials);

  return {
    userLastId: Math.max(userLastId, getMaxId(users)),
    users,
    sessions,
    paintingLastId: Math.max(normalizedPaintingLastId, getMaxId(paintings)),
    materialLastId: Math.max(normalizedMaterialLastId, getMaxId(materials)),
    paintings,
    materials,
  };
}

async function ensureStorage() {
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(
      dataFile,
      JSON.stringify(
        {
          userLastId: 0,
          users: [],
          sessions: [],
          paintingLastId: 0,
          materialLastId: 0,
          paintings: [],
          materials: [],
        },
        null,
        2
      ),
      "utf-8"
    );
    return;
  }

  const db = await readDb();
  await writeDb(db);
}

async function readDb() {
  const content = await fs.readFile(dataFile, "utf-8");
  return normalizeDb(JSON.parse(content));
}

async function writeDb(db) {
  const normalized = normalizeDb(db);
  await fs.writeFile(dataFile, JSON.stringify(normalized, null, 2), "utf-8");
}

function toId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function trimText(value) {
  return String(value ?? "").trim();
}

function toPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function paginateItems(items, query = {}) {
  const pageSize = Math.min(
    toPositiveInteger(query.pageSize, DEFAULT_LIST_PAGE_SIZE),
    MAX_LIST_PAGE_SIZE
  );
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(toPositiveInteger(query.page, 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

function matchesKeyword(item, q) {
  const target = [
    item.title,
    item.category,
    item.description,
    item.assetType === "video" ? "video" : "image",
  ]
    .map((value) => trimText(value).toLowerCase())
    .join(" ");
  return target.includes(q);
}

function isMultipartRequest(req) {
  return trimText(req.headers["content-type"]).toLowerCase().startsWith(
    "multipart/form-data"
  );
}

async function removeFileByUrl(fileUrl) {
  if (
    !fileUrl ||
    typeof fileUrl !== "string" ||
    !fileUrl.startsWith("/uploads/")
  ) {
    return;
  }

  const fileName = path.basename(fileUrl);
  if (!fileName) {
    return;
  }

  const target = path.join(uploadDir, fileName);
  try {
    await fs.unlink(target);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function removeUploadedFile(file) {
  if (!file?.filename) {
    return;
  }
  await removeFileByUrl(`/uploads/${file.filename}`);
}

async function removeUploadedFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return;
  }
  await Promise.all(files.map((file) => removeUploadedFile(file)));
}

async function removeRecordAttachmentFiles(record, legacyField) {
  const fileUrls = new Set();

  if (Array.isArray(record?.attachments)) {
    for (const attachment of record.attachments) {
      const url = extractAttachmentUrl(attachment);
      if (url) {
        fileUrls.add(url);
      }
    }
  }

  const legacyUrl = trimText(record?.[legacyField]);
  if (legacyUrl) {
    fileUrls.add(legacyUrl);
  }

  await Promise.all([...fileUrls].map((url) => removeFileByUrl(url)));
}

app.get("/api/auth/me", async (req, res, next) => {
  try {
    const db = await readDb();
    const { user } = findSessionUser(db, req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const displayName = trimText(req.body.displayName) || username;
    const password = String(req.body.password || "");
    const passwordError = validatePassword(password);

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const db = await readDb();
    if (db.users.some((user) => user.username === username)) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const now = new Date().toISOString();
    const user = {
      id: db.userLastId + 1,
      username,
      passwordHash: hashPassword(password),
      displayName,
      bio: "",
      avatarUrl: "",
      createdAt: now,
      updatedAt: now,
    };
    db.userLastId = user.id;
    db.users.push(user);
    const session = createSession(db, user.id);
    await writeDb(db);
    setSessionCookie(res, session.id);
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");
    const db = await readDb();
    const user = db.users.find((item) => item.username === username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const session = createSession(db, user.id);
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
    setSessionCookie(res, session.id);
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const db = await readDb();
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) {
      db.sessions = db.sessions.filter((session) => session.id !== token);
      await writeDb(db);
    }
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/profile", requireUser, async (req, res, next) => {
  try {
    const db = await readDb();
    const user = db.users.find((item) => item.id === req.currentUser.id);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "displayName")) {
      user.displayName = trimText(req.body.displayName) || user.username;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "bio")) {
      user.bio = trimText(req.body.bio);
    }
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/profile/avatar", requireUser, uploadAvatar.single("avatar"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an avatar image" });
    }
    const db = await readDb();
    const user = db.users.find((item) => item.id === req.currentUser.id);
    if (!user) {
      await removeUploadedFile(req.file);
      return res.status(401).json({ error: "Authentication required" });
    }
    const previousAvatar = user.avatarUrl;
    user.avatarUrl = `/uploads/${req.file.filename}`;
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
    await removeFileByUrl(previousAvatar);
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    if (req.file) {
      await removeUploadedFile(req.file).catch(() => {});
    }
    next(error);
  }
});

app.post("/api/profile/password", requireUser, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const db = await readDb();
    const user = db.users.find((item) => item.id === req.currentUser.id);
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    user.passwordHash = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    db.sessions = db.sessions.filter((session) => session.userId !== user.id);
    const session = createSession(db, user.id);
    await writeDb(db);
    setSessionCookie(res, session.id);
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/paintings", requireUser, async (req, res, next) => {
  try {
    const category = trimText(req.query.category).toLowerCase();
    const q = trimText(req.query.q).toLowerCase();

    const db = await readDb();
    let result = ownedItems(db.paintings, req.currentUser);

    if (category) {
      result = result.filter((item) => item.category.toLowerCase() === category);
    }

    if (q) {
      result = result.filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          trimText(item.description).toLowerCase().includes(q)
        );
      });
    }

    result.sort((a, b) => b.id - a.id);
    res.json(paginateItems(result, req.query));
  } catch (error) {
    next(error);
  }
});

app.get("/api/paintings/:id", requireUser, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid painting ID" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (!painting) {
      return res.status(404).json({ error: "Painting not found" });
    }

    res.json(painting);
  } catch (error) {
    next(error);
  }
});

app.get("/api/categories", requireUser, async (req, res, next) => {
  try {
    const db = await readDb();
    const categories = [...new Set(ownedItems(db.paintings, req.currentUser).map((item) => item.category))].sort(
      (a, b) => a.localeCompare(b, "zh-Hans-CN")
    );
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

app.post("/api/paintings", requireUser, uploadPainting.array("image", MAX_UPLOAD_FILES_PER_REQUEST), async (req, res, next) => {
  try {
    const title = trimText(req.body.title);
    const category = trimText(req.body.category);
    const description = trimText(req.body.description);
    const files = Array.isArray(req.files) ? req.files : [];

    if (!title) {
      await removeUploadedFiles(files);
      return res.status(400).json({ error: "Title is required" });
    }
    if (!category) {
      await removeUploadedFiles(files);
      return res.status(400).json({ error: "Category is required" });
    }
    if (files.length === 0) {
      return res.status(400).json({ error: "Please upload an image file" });
    }

    const attachments = files.map((file) => buildPaintingAttachmentFromFile(file)).filter(Boolean);

    const db = await readDb();
    const newItem = {
      id: db.paintingLastId + 1,
      title,
      category,
      description,
      imageUrl: attachments[0].url,
      attachments,
      comments: [],
      ownerUserId: req.currentUser.id,
      createdAt: new Date().toISOString(),
    };

    db.paintingLastId = newItem.id;
    db.paintings.push(newItem);
    await writeDb(db);

    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/paintings/:id", requireUser, async (req, res, next) => {
  try {
    if (isMultipartRequest(req)) {
      return res.status(400).json({
        error: "Use /api/paintings/:id/attachments to upload attachment files",
      });
    }

    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid painting ID" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (!painting) {
      return res.status(404).json({ error: "Painting not found" });
    }

    const hasTitle = Object.prototype.hasOwnProperty.call(req.body, "title");
    const hasCategory = Object.prototype.hasOwnProperty.call(req.body, "category");
    const hasDescription = Object.prototype.hasOwnProperty.call(req.body, "description");

    if (hasTitle) {
      const title = trimText(req.body.title);
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      painting.title = title;
    }

    if (hasCategory) {
      const category = trimText(req.body.category);
      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }
      painting.category = category;
    }

    if (hasDescription) {
      painting.description = trimText(req.body.description);
    }

    painting.updatedAt = new Date().toISOString();
    await writeDb(db);

    res.json(painting);
  } catch (error) {
    next(error);
  }
});

app.post("/api/paintings/:id/attachments", requireUser, uploadPainting.array("image", MAX_UPLOAD_FILES_PER_REQUEST), async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const id = toId(req.params.id);
    if (!id) {
      await removeUploadedFiles(files);
      return res.status(400).json({ error: "Invalid painting ID" });
    }
    if (files.length === 0) {
      return res.status(400).json({ error: "Please upload an image file" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (!painting) {
      await removeUploadedFiles(files);
      return res.status(404).json({ error: "Painting not found" });
    }

    const newAttachments = files.map((file) => buildPaintingAttachmentFromFile(file)).filter(Boolean);
    painting.attachments = Array.isArray(painting.attachments) ? painting.attachments : [];
    painting.attachments.push(...newAttachments);
    if (painting.attachments[0]) {
      painting.imageUrl = painting.attachments[0].url;
    }

    painting.updatedAt = new Date().toISOString();
    await writeDb(db);

    res.json(painting);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/paintings/:id/attachments/:attachmentId", requireUser, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid painting ID" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (!painting) {
      return res.status(404).json({ error: "Painting not found" });
    }

    const attachments = Array.isArray(painting.attachments) ? painting.attachments : [];
    const targetIndex = findAttachmentIndex(attachments, req.params.attachmentId);
    if (targetIndex < 0) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    if (attachments.length <= 1) {
      return res.status(400).json({ error: "At least one attachment must remain" });
    }

    const [removedAttachment] = attachments.splice(targetIndex, 1);
    painting.attachments = attachments;
    painting.imageUrl = attachments[0]?.url || "";
    painting.updatedAt = new Date().toISOString();
    await writeDb(db);
    await removeFileByUrl(extractAttachmentUrl(removedAttachment));

    res.json(painting);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/paintings/:id", requireUser, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid painting ID" });
    }

    const db = await readDb();
    const index = db.paintings.findIndex((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (index < 0) {
      return res.status(404).json({ error: "Painting not found" });
    }

    const [deleted] = db.paintings.splice(index, 1);
    await writeDb(db);
    await removeRecordAttachmentFiles(deleted, "imageUrl");

    res.json({ success: true, id });
  } catch (error) {
    next(error);
  }
});

app.post("/api/paintings/:id/comments", requireUser, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid painting ID" });
    }

    const content = trimText(req.body.content);
    if (!content) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (!painting) {
      return res.status(404).json({ error: "Painting not found" });
    }

    const comment = {
      id: Date.now(),
      content,
      createdAt: new Date().toISOString(),
    };
    painting.comments = Array.isArray(painting.comments) ? painting.comments : [];
    painting.comments.push(comment);
    await writeDb(db);

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

app.get("/api/materials", requireUser, async (req, res, next) => {
  try {
    const category = trimText(req.query.category).toLowerCase();
    const q = trimText(req.query.q).toLowerCase();

    const db = await readDb();
    let result = ownedItems(db.materials, req.currentUser);

    if (category) {
      result = result.filter((item) => item.category.toLowerCase() === category);
    }

    if (q) {
      result = result.filter((item) => matchesKeyword(item, q));
    }

    result.sort((a, b) => b.id - a.id);
    res.json(paginateItems(result, req.query));
  } catch (error) {
    next(error);
  }
});

app.get("/api/materials/:id", requireUser, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid material ID" });
    }

    const db = await readDb();
    const material = db.materials.find((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    res.json(material);
  } catch (error) {
    next(error);
  }
});

app.get("/api/material-categories", requireUser, async (req, res, next) => {
  try {
    const db = await readDb();
    const categories = [...new Set(ownedItems(db.materials, req.currentUser).map((item) => item.category))].sort(
      (a, b) => a.localeCompare(b, "zh-Hans-CN")
    );
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

app.post("/api/materials", requireUser, uploadMaterial.array("asset", MAX_UPLOAD_FILES_PER_REQUEST), async (req, res, next) => {
  try {
    const title = trimText(req.body.title);
    const category = trimText(req.body.category);
    const description = trimText(req.body.description);
    const files = Array.isArray(req.files) ? req.files : [];

    if (!title) {
      await removeUploadedFiles(files);
      return res.status(400).json({ error: "Material title is required" });
    }
    if (!category) {
      await removeUploadedFiles(files);
      return res.status(400).json({ error: "Material category is required" });
    }
    if (files.length === 0) {
      return res
        .status(400)
        .json({ error: "Please upload at least one image or video file" });
    }

    const attachments = files.map((file) => buildMaterialAttachmentFromFile(file)).filter(Boolean);

    const db = await readDb();
    const newItem = {
      id: db.materialLastId + 1,
      title,
      category,
      description,
      assetType: attachments[0].type,
      assetUrl: attachments[0].url,
      attachments,
      ownerUserId: req.currentUser.id,
      createdAt: new Date().toISOString(),
    };

    db.materialLastId = newItem.id;
    db.materials.push(newItem);
    await writeDb(db);

    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/materials/:id", requireUser, async (req, res, next) => {
  try {
    if (isMultipartRequest(req)) {
      return res.status(400).json({
        error: "Use /api/materials/:id/attachments to upload attachment files",
      });
    }

    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid material ID" });
    }

    const db = await readDb();
    const material = db.materials.find((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    const hasTitle = Object.prototype.hasOwnProperty.call(req.body, "title");
    const hasCategory = Object.prototype.hasOwnProperty.call(req.body, "category");
    const hasDescription = Object.prototype.hasOwnProperty.call(req.body, "description");

    if (hasTitle) {
      const title = trimText(req.body.title);
      if (!title) {
        return res.status(400).json({ error: "Material title is required" });
      }
      material.title = title;
    }

    if (hasCategory) {
      const category = trimText(req.body.category);
      if (!category) {
        return res.status(400).json({ error: "Material category is required" });
      }
      material.category = category;
    }

    if (hasDescription) {
      material.description = trimText(req.body.description);
    }

    material.updatedAt = new Date().toISOString();
    await writeDb(db);

    res.json(material);
  } catch (error) {
    next(error);
  }
});

app.post("/api/materials/:id/attachments", requireUser, uploadMaterial.array("asset", MAX_UPLOAD_FILES_PER_REQUEST), async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const id = toId(req.params.id);
    if (!id) {
      await removeUploadedFiles(files);
      return res.status(400).json({ error: "Invalid material ID" });
    }
    if (files.length === 0) {
      return res
        .status(400)
        .json({ error: "Please upload at least one image or video file" });
    }

    const db = await readDb();
    const material = db.materials.find((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (!material) {
      await removeUploadedFiles(files);
      return res.status(404).json({ error: "Material not found" });
    }

    const newAttachments = files.map((file) => buildMaterialAttachmentFromFile(file)).filter(Boolean);
    material.attachments = Array.isArray(material.attachments) ? material.attachments : [];
    material.attachments.push(...newAttachments);
    if (material.attachments[0]) {
      material.assetUrl = material.attachments[0].url;
      material.assetType = normalizeAssetType(
        material.attachments[0].type,
        material.attachments[0].url
      );
    }

    material.updatedAt = new Date().toISOString();
    await writeDb(db);

    res.json(material);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/materials/:id/attachments/:attachmentId", requireUser, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid material ID" });
    }

    const db = await readDb();
    const material = db.materials.find((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    const attachments = Array.isArray(material.attachments) ? material.attachments : [];
    const targetIndex = findAttachmentIndex(attachments, req.params.attachmentId);
    if (targetIndex < 0) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    if (attachments.length <= 1) {
      return res.status(400).json({ error: "At least one attachment must remain" });
    }

    const [removedAttachment] = attachments.splice(targetIndex, 1);
    material.attachments = attachments;
    material.assetUrl = attachments[0]?.url || "";
    material.assetType = normalizeAssetType(
      attachments[0]?.type,
      attachments[0]?.url || ""
    );
    material.updatedAt = new Date().toISOString();
    await writeDb(db);
    await removeFileByUrl(extractAttachmentUrl(removedAttachment));

    res.json(material);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/materials/:id", requireUser, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid material ID" });
    }

    const db = await readDb();
    const index = db.materials.findIndex((item) => item.id === id && belongsToUser(item, req.currentUser));
    if (index < 0) {
      return res.status(404).json({ error: "Material not found" });
    }

    const [deleted] = db.materials.splice(index, 1);
    await writeDb(db);
    await removeRecordAttachmentFiles(deleted, "assetUrl");

    res.json({ success: true, id });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      if (error.field === "asset") {
        return res.status(400).json({ error: "Material file must be <= 100MB" });
      }
      if (error.field === "avatar") {
        return res.status(400).json({ error: "Avatar image must be <= 5MB" });
      }
      return res.status(400).json({ error: "Image file must be <= 10MB" });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error.message) {
    return res.status(400).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
});

ensureStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running: http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize storage:", error);
    process.exit(1);
  });
