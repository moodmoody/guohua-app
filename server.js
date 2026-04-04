const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "uploads");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "paintings.json");

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "_");
    cb(null, `${Date.now()}-${safeBase}${ext || ".jpg"}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error("仅支持 JPG / PNG / WEBP 图片"));
    }
    cb(null, true);
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

async function ensureStorage() {
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(
      dataFile,
      JSON.stringify({ lastId: 0, paintings: [] }, null, 2),
      "utf-8"
    );
  }
}

async function readDb() {
  const content = await fs.readFile(dataFile, "utf-8");
  return JSON.parse(content);
}

async function writeDb(db) {
  await fs.writeFile(dataFile, JSON.stringify(db, null, 2), "utf-8");
}

app.get("/api/paintings", async (req, res, next) => {
  try {
    const category = (req.query.category || "").trim().toLowerCase();
    const q = (req.query.q || "").trim().toLowerCase();
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
          (item.description || "").toLowerCase().includes(q)
        );
      });
    }

    result.sort((a, b) => b.id - a.id);
    res.json(result);
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

app.post("/api/paintings", upload.single("image"), async (req, res, next) => {
  try {
    const { title = "", category = "", description = "" } = req.body;
    const cleanTitle = title.trim();
    const cleanCategory = category.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle) {
      return res.status(400).json({ error: "标题不能为空" });
    }
    if (!cleanCategory) {
      return res.status(400).json({ error: "分类不能为空" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "请上传图片文件" });
    }

    const db = await readDb();
    const newItem = {
      id: db.lastId + 1,
      title: cleanTitle,
      category: cleanCategory,
      description: cleanDescription,
      imageUrl: `/uploads/${req.file.filename}`,
      comments: [],
      createdAt: new Date().toISOString(),
    };

    db.lastId = newItem.id;
    db.paintings.push(newItem);
    await writeDb(db);

    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
});

app.post("/api/paintings/:id/comments", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const content = (req.body.content || "").trim();

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
    painting.comments.push(comment);
    await writeDb(db);

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
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
