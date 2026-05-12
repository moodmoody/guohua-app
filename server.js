const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");

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
const MATERIAL_LIMIT = 80 * 1024 * 1024;
const MAX_UPLOAD_FILES_PER_REQUEST = 10;

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

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

function getMaxId(items) {
  return items.reduce((max, item) => {
    const id = Number(item?.id);
    return Number.isInteger(id) && id > max ? id : max;
  }, 0);
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
  const paintings = Array.isArray(raw.paintings)
    ? raw.paintings.map((item) => normalizePaintingRecord(item))
    : [];
  const materials = Array.isArray(raw.materials)
    ? raw.materials.map((item) => normalizeMaterialRecord(item))
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
        { paintingLastId: 0, materialLastId: 0, paintings: [], materials: [] },
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

app.get("/api/paintings", async (req, res, next) => {
  try {
    const category = trimText(req.query.category).toLowerCase();
    const q = trimText(req.query.q).toLowerCase();

    const db = await readDb();
    let result = [...db.paintings];

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
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/paintings/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid painting ID" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id);
    if (!painting) {
      return res.status(404).json({ error: "Painting not found" });
    }

    res.json(painting);
  } catch (error) {
    next(error);
  }
});

app.get("/api/categories", async (_req, res, next) => {
  try {
    const db = await readDb();
    const categories = [...new Set(db.paintings.map((item) => item.category))].sort(
      (a, b) => a.localeCompare(b, "zh-Hans-CN")
    );
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

app.post("/api/paintings", uploadPainting.array("image", MAX_UPLOAD_FILES_PER_REQUEST), async (req, res, next) => {
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

app.patch("/api/paintings/:id", async (req, res, next) => {
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
    const painting = db.paintings.find((item) => item.id === id);
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

app.post("/api/paintings/:id/attachments", uploadPainting.array("image", MAX_UPLOAD_FILES_PER_REQUEST), async (req, res, next) => {
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
    const painting = db.paintings.find((item) => item.id === id);
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

app.delete("/api/paintings/:id/attachments/:attachmentId", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid painting ID" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id);
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

app.delete("/api/paintings/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid painting ID" });
    }

    const db = await readDb();
    const index = db.paintings.findIndex((item) => item.id === id);
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

app.post("/api/paintings/:id/comments", async (req, res, next) => {
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
    const painting = db.paintings.find((item) => item.id === id);
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

app.get("/api/materials", async (req, res, next) => {
  try {
    const category = trimText(req.query.category).toLowerCase();
    const q = trimText(req.query.q).toLowerCase();

    const db = await readDb();
    let result = [...db.materials];

    if (category) {
      result = result.filter((item) => item.category.toLowerCase() === category);
    }

    if (q) {
      result = result.filter((item) => matchesKeyword(item, q));
    }

    result.sort((a, b) => b.id - a.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/materials/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid material ID" });
    }

    const db = await readDb();
    const material = db.materials.find((item) => item.id === id);
    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    res.json(material);
  } catch (error) {
    next(error);
  }
});

app.get("/api/material-categories", async (_req, res, next) => {
  try {
    const db = await readDb();
    const categories = [...new Set(db.materials.map((item) => item.category))].sort(
      (a, b) => a.localeCompare(b, "zh-Hans-CN")
    );
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

app.post("/api/materials", uploadMaterial.array("asset", MAX_UPLOAD_FILES_PER_REQUEST), async (req, res, next) => {
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

app.patch("/api/materials/:id", async (req, res, next) => {
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
    const material = db.materials.find((item) => item.id === id);
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

app.post("/api/materials/:id/attachments", uploadMaterial.array("asset", MAX_UPLOAD_FILES_PER_REQUEST), async (req, res, next) => {
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
    const material = db.materials.find((item) => item.id === id);
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

app.delete("/api/materials/:id/attachments/:attachmentId", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid material ID" });
    }

    const db = await readDb();
    const material = db.materials.find((item) => item.id === id);
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

app.delete("/api/materials/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid material ID" });
    }

    const db = await readDb();
    const index = db.materials.findIndex((item) => item.id === id);
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
        return res.status(400).json({ error: "Material file must be <= 80MB" });
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
