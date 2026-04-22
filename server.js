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
  typeMessage: "仅支持 JPG / PNG / WEBP 图片",
});

const uploadMaterial = createUploader({
  allowedTypes: materialTypes,
  maxFileSize: MATERIAL_LIMIT,
  typeMessage: "仅支持 JPG / PNG / WEBP 图片与 MP4 / WEBM / MOV / MKV 视频",
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

function normalizeDb(raw = {}) {
  const paintings = Array.isArray(raw.paintings) ? raw.paintings : [];
  const materials = Array.isArray(raw.materials) ? raw.materials : [];

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
    item.assetType === "video" ? "视频" : "图片",
  ]
    .map((value) => trimText(value).toLowerCase())
    .join(" ");
  return target.includes(q);
}

async function removeFileByUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") {
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
      return res.status(400).json({ error: "作品 ID 无效" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id);
    if (!painting) {
      return res.status(404).json({ error: "作品不存在" });
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

app.post("/api/paintings", uploadPainting.single("image"), async (req, res, next) => {
  try {
    const title = trimText(req.body.title);
    const category = trimText(req.body.category);
    const description = trimText(req.body.description);

    if (!title) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: "标题不能为空" });
    }
    if (!category) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: "分类不能为空" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "请上传图片文件" });
    }

    const db = await readDb();
    const newItem = {
      id: db.paintingLastId + 1,
      title,
      category,
      description,
      imageUrl: `/uploads/${req.file.filename}`,
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

app.patch("/api/paintings/:id", uploadPainting.single("image"), async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: "作品 ID 无效" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id);
    if (!painting) {
      await removeUploadedFile(req.file);
      return res.status(404).json({ error: "作品不存在" });
    }

    const hasTitle = Object.prototype.hasOwnProperty.call(req.body, "title");
    const hasCategory = Object.prototype.hasOwnProperty.call(req.body, "category");
    const hasDescription = Object.prototype.hasOwnProperty.call(req.body, "description");

    if (hasTitle) {
      const title = trimText(req.body.title);
      if (!title) {
        await removeUploadedFile(req.file);
        return res.status(400).json({ error: "标题不能为空" });
      }
      painting.title = title;
    }

    if (hasCategory) {
      const category = trimText(req.body.category);
      if (!category) {
        await removeUploadedFile(req.file);
        return res.status(400).json({ error: "分类不能为空" });
      }
      painting.category = category;
    }

    if (hasDescription) {
      painting.description = trimText(req.body.description);
    }

    if (req.file) {
      const oldImageUrl = painting.imageUrl;
      painting.imageUrl = `/uploads/${req.file.filename}`;
      await removeFileByUrl(oldImageUrl);
    }

    painting.updatedAt = new Date().toISOString();
    await writeDb(db);

    res.json(painting);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/paintings/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "作品 ID 无效" });
    }

    const db = await readDb();
    const index = db.paintings.findIndex((item) => item.id === id);
    if (index < 0) {
      return res.status(404).json({ error: "作品不存在" });
    }

    const [deleted] = db.paintings.splice(index, 1);
    await writeDb(db);
    await removeFileByUrl(deleted.imageUrl);

    res.json({ success: true, id });
  } catch (error) {
    next(error);
  }
});

app.post("/api/paintings/:id/comments", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "作品 ID 无效" });
    }

    const content = trimText(req.body.content);
    if (!content) {
      return res.status(400).json({ error: "评论不能为空" });
    }

    const db = await readDb();
    const painting = db.paintings.find((item) => item.id === id);
    if (!painting) {
      return res.status(404).json({ error: "作品不存在" });
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
      return res.status(400).json({ error: "素材 ID 无效" });
    }

    const db = await readDb();
    const material = db.materials.find((item) => item.id === id);
    if (!material) {
      return res.status(404).json({ error: "素材不存在" });
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

app.post("/api/materials", uploadMaterial.single("asset"), async (req, res, next) => {
  try {
    const title = trimText(req.body.title);
    const category = trimText(req.body.category);
    const description = trimText(req.body.description);

    if (!title) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: "素材标题不能为空" });
    }
    if (!category) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: "素材分类不能为空" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "请上传图片或视频文件" });
    }

    const db = await readDb();
    const isVideo = req.file.mimetype.startsWith("video/");
    const newItem = {
      id: db.materialLastId + 1,
      title,
      category,
      description,
      assetType: isVideo ? "video" : "image",
      assetUrl: `/uploads/${req.file.filename}`,
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

app.patch("/api/materials/:id", uploadMaterial.single("asset"), async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: "素材 ID 无效" });
    }

    const db = await readDb();
    const material = db.materials.find((item) => item.id === id);
    if (!material) {
      await removeUploadedFile(req.file);
      return res.status(404).json({ error: "素材不存在" });
    }

    const hasTitle = Object.prototype.hasOwnProperty.call(req.body, "title");
    const hasCategory = Object.prototype.hasOwnProperty.call(req.body, "category");
    const hasDescription = Object.prototype.hasOwnProperty.call(req.body, "description");

    if (hasTitle) {
      const title = trimText(req.body.title);
      if (!title) {
        await removeUploadedFile(req.file);
        return res.status(400).json({ error: "素材标题不能为空" });
      }
      material.title = title;
    }

    if (hasCategory) {
      const category = trimText(req.body.category);
      if (!category) {
        await removeUploadedFile(req.file);
        return res.status(400).json({ error: "素材分类不能为空" });
      }
      material.category = category;
    }

    if (hasDescription) {
      material.description = trimText(req.body.description);
    }

    if (req.file) {
      const oldAssetUrl = material.assetUrl;
      material.assetType = req.file.mimetype.startsWith("video/") ? "video" : "image";
      material.assetUrl = `/uploads/${req.file.filename}`;
      await removeFileByUrl(oldAssetUrl);
    }

    material.updatedAt = new Date().toISOString();
    await writeDb(db);

    res.json(material);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/materials/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "素材 ID 无效" });
    }

    const db = await readDb();
    const index = db.materials.findIndex((item) => item.id === id);
    if (index < 0) {
      return res.status(404).json({ error: "素材不存在" });
    }

    const [deleted] = db.materials.splice(index, 1);
    await writeDb(db);
    await removeFileByUrl(deleted.assetUrl);

    res.json({ success: true, id });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      if (error.field === "asset") {
        return res.status(400).json({ error: "素材文件不能超过 80MB" });
      }
      return res.status(400).json({ error: "图片不能超过 10MB" });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error.message) {
    return res.status(400).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "服务器内部错误" });
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
