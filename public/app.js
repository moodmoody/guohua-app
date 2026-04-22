const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanes = Array.from(document.querySelectorAll(".tab-pane"));

const uploadForm = document.getElementById("upload-form");
const filterCategory = document.getElementById("filter-category");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const resetBtn = document.getElementById("reset-btn");
const paintingsRoot = document.getElementById("paintings");
const messageEl = document.getElementById("message");
const paintingTemplate = document.getElementById("painting-template");
const pagination = document.getElementById("pagination");
const prevPageBtn = document.getElementById("prev-page-btn");
const nextPageBtn = document.getElementById("next-page-btn");
const pageInfo = document.getElementById("page-info");

const materialUploadForm = document.getElementById("material-upload-form");
const materialFilterCategory = document.getElementById("material-filter-category");
const materialSearchInput = document.getElementById("material-search-input");
const materialSearchBtn = document.getElementById("material-search-btn");
const materialResetBtn = document.getElementById("material-reset-btn");
const materialsRoot = document.getElementById("materials");
const materialMessageEl = document.getElementById("material-message");
const materialTemplate = document.getElementById("material-template");
const materialPagination = document.getElementById("material-pagination");
const materialPrevPageBtn = document.getElementById("material-prev-page-btn");
const materialNextPageBtn = document.getElementById("material-next-page-btn");
const materialPageInfo = document.getElementById("material-page-info");

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxVideo = document.getElementById("lightbox-video");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxClose = document.getElementById("lightbox-close");

const paintingState = {
  items: [],
  page: 1,
  pageSize: 6,
};

const materialState = {
  items: [],
  page: 1,
  pageSize: 6,
};

function formatTime(iso) {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function setMessage(target, text, isError = false) {
  target.textContent = text;
  target.style.color = isError ? "#8b1d1d" : "#7a6f63";
}

function activateTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === tabName);
  });

  tabPanes.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.tabPane === tabName);
  });
}

function openLightbox({ type, url, title, category }) {
  lightboxImage.classList.add("hidden");
  lightboxVideo.classList.add("hidden");
  lightboxImage.src = "";
  lightboxImage.alt = "";
  lightboxVideo.src = "";
  lightboxVideo.pause();

  if (type === "video") {
    lightboxVideo.src = url;
    lightboxVideo.classList.remove("hidden");
  } else {
    lightboxImage.src = url;
    lightboxImage.alt = title || "预览图";
    lightboxImage.classList.remove("hidden");
  }

  lightboxCaption.textContent = category ? `${title} · ${category}` : title || "";
  lightbox.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxImage.src = "";
  lightboxImage.alt = "";
  lightboxVideo.pause();
  lightboxVideo.src = "";
  lightboxCaption.textContent = "";
  document.body.classList.remove("modal-open");
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload;
}

function renderCategories(selectEl, categories) {
  const previous = selectEl.value;
  selectEl.innerHTML = `<option value="">全部分类</option>`;
  categories.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    selectEl.appendChild(option);
  });

  if (previous && categories.includes(previous)) {
    selectEl.value = previous;
  }
}

function setHighlightedText(el, text, keyword) {
  const rawText = String(text ?? "");
  const query = String(keyword ?? "").trim();
  el.textContent = "";

  if (!query) {
    el.textContent = rawText;
    return;
  }

  const lowerText = rawText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let from = 0;
  let index = lowerText.indexOf(lowerQuery);

  if (index < 0) {
    el.textContent = rawText;
    return;
  }

  while (index >= 0) {
    if (index > from) {
      el.appendChild(document.createTextNode(rawText.slice(from, index)));
    }

    const mark = document.createElement("mark");
    mark.className = "hl";
    mark.textContent = rawText.slice(index, index + query.length);
    el.appendChild(mark);

    from = index + query.length;
    index = lowerText.indexOf(lowerQuery, from);
  }

  if (from < rawText.length) {
    el.appendChild(document.createTextNode(rawText.slice(from)));
  }
}

function renderPagination({
  total,
  page,
  pageSize,
  paginationEl,
  prevBtn,
  nextBtn,
  pageInfoEl,
}) {
  if (!total) {
    paginationEl.classList.add("hidden");
    pageInfoEl.textContent = "";
    return { currentPage: 1, totalPages: 1 };
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);

  paginationEl.classList.remove("hidden");
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(total, currentPage * pageSize);
  pageInfoEl.textContent = `第 ${currentPage}/${totalPages} 页 · 显示 ${start}-${end} 条，共 ${total} 条`;
  return { currentPage, totalPages };
}

function buildPaintingQuery() {
  const params = new URLSearchParams();
  const category = filterCategory.value.trim();
  const q = searchInput.value.trim();

  if (category) {
    params.set("category", category);
  }
  if (q) {
    params.set("q", q);
  }

  const query = params.toString();
  return query ? `/api/paintings?${query}` : "/api/paintings";
}

function fillPaintingEditForm(form, item) {
  form.elements.title.value = item.title;
  form.elements.category.value = item.category;
  form.elements.description.value = item.description || "";
  form.elements.image.value = "";
}

function renderPaintings() {
  paintingsRoot.innerHTML = "";
  const keyword = searchInput.value.trim();
  const total = paintingState.items.length;

  if (!total) {
    paintingsRoot.innerHTML = `<p>暂无作品，先上传一幅吧。</p>`;
    paintingState.page = 1;
    renderPagination({
      total: 0,
      page: 1,
      pageSize: paintingState.pageSize,
      paginationEl: pagination,
      prevBtn: prevPageBtn,
      nextBtn: nextPageBtn,
      pageInfoEl: pageInfo,
    });
    return;
  }

  const paginationInfo = renderPagination({
    total,
    page: paintingState.page,
    pageSize: paintingState.pageSize,
    paginationEl: pagination,
    prevBtn: prevPageBtn,
    nextBtn: nextPageBtn,
    pageInfoEl: pageInfo,
  });
  paintingState.page = paginationInfo.currentPage;

  const startIndex = (paintingState.page - 1) * paintingState.pageSize;
  const pageItems = paintingState.items.slice(startIndex, startIndex + paintingState.pageSize);

  pageItems.forEach((item) => {
    const fragment = paintingTemplate.content.cloneNode(true);
    const imageEl = fragment.querySelector(".painting-image");
    const titleEl = fragment.querySelector(".painting-title");
    const metaEl = fragment.querySelector(".meta");
    const descEl = fragment.querySelector(".description");
    const editBtn = fragment.querySelector(".edit-btn");
    const deleteBtn = fragment.querySelector(".delete-btn");
    const editForm = fragment.querySelector(".edit-form");
    const cancelEditBtn = fragment.querySelector(".cancel-edit-btn");
    const commentList = fragment.querySelector(".comment-list");
    const commentForm = fragment.querySelector(".comment-form");

    imageEl.src = item.imageUrl;
    imageEl.alt = item.title;
    imageEl.tabIndex = 0;
    setHighlightedText(titleEl, item.title, keyword);

    imageEl.addEventListener("click", () => {
      openLightbox({
        type: "image",
        url: item.imageUrl,
        title: item.title,
        category: item.category,
      });
    });

    imageEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox({
          type: "image",
          url: item.imageUrl,
          title: item.title,
          category: item.category,
        });
      }
    });

    const updateText = item.updatedAt ? `，更新于：${formatTime(item.updatedAt)}` : "";
    const categoryEl = document.createElement("span");
    setHighlightedText(categoryEl, item.category, keyword);
    metaEl.textContent = "";
    metaEl.appendChild(categoryEl);
    metaEl.appendChild(
      document.createTextNode(` · 创建于：${formatTime(item.createdAt)}${updateText}`)
    );

    setHighlightedText(descEl, item.description || "暂无简介", keyword);

    const comments = Array.isArray(item.comments) ? item.comments : [];
    if (!comments.length) {
      commentList.innerHTML = `<li>暂无评论</li>`;
    } else {
      comments
        .slice()
        .sort((a, b) => b.id - a.id)
        .forEach((comment) => {
          const li = document.createElement("li");
          const contentEl = document.createElement("span");
          setHighlightedText(contentEl, comment.content, keyword);
          li.appendChild(contentEl);
          li.appendChild(document.createTextNode(`（${formatTime(comment.createdAt)}）`));
          commentList.appendChild(li);
        });
    }

    editBtn.addEventListener("click", () => {
      fillPaintingEditForm(editForm, item);
      editForm.classList.remove("hidden");
    });

    cancelEditBtn.addEventListener("click", () => {
      editForm.classList.add("hidden");
    });

    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(editForm);
      const imageFile = editForm.elements.image.files[0];
      if (!imageFile) {
        formData.delete("image");
      }

      try {
        await fetchJson(`/api/paintings/${item.id}`, {
          method: "PATCH",
          body: formData,
        });
        setMessage(messageEl, "作品修改成功");
        editForm.classList.add("hidden");
        await Promise.all([loadPaintingCategories(), loadPaintings()]);
      } catch (error) {
        setMessage(messageEl, error.message, true);
      }
    });

    deleteBtn.addEventListener("click", async () => {
      const ok = window.confirm(`确定删除《${item.title}》吗？`);
      if (!ok) {
        return;
      }

      try {
        await fetchJson(`/api/paintings/${item.id}`, { method: "DELETE" });
        setMessage(messageEl, "作品删除成功");
        await Promise.all([loadPaintingCategories(), loadPaintings()]);
      } catch (error) {
        setMessage(messageEl, error.message, true);
      }
    });

    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = commentForm.elements.comment;
      const content = input.value.trim();
      if (!content) {
        return;
      }

      try {
        await fetchJson(`/api/paintings/${item.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        input.value = "";
        setMessage(messageEl, "评论已添加");
        await loadPaintings();
      } catch (error) {
        setMessage(messageEl, error.message, true);
      }
    });

    paintingsRoot.appendChild(fragment);
  });
}

async function loadPaintingCategories() {
  const categories = await fetchJson("/api/categories");
  renderCategories(filterCategory, categories);
}

async function loadPaintings({ resetPage = false } = {}) {
  if (resetPage) {
    paintingState.page = 1;
  }
  const url = buildPaintingQuery();
  paintingState.items = await fetchJson(url);
  renderPaintings();
}

function materialTypeOf(item) {
  if (item.assetType === "video" || item.assetType === "image") {
    return item.assetType;
  }

  const url = String(item.assetUrl || "").toLowerCase();
  if (url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov") || url.endsWith(".mkv")) {
    return "video";
  }
  return "image";
}

function buildMaterialQuery() {
  const params = new URLSearchParams();
  const category = materialFilterCategory.value.trim();
  const q = materialSearchInput.value.trim();

  if (category) {
    params.set("category", category);
  }
  if (q) {
    params.set("q", q);
  }

  const query = params.toString();
  return query ? `/api/materials?${query}` : "/api/materials";
}

function fillMaterialEditForm(form, item) {
  form.elements.title.value = item.title;
  form.elements.category.value = item.category;
  form.elements.description.value = item.description || "";
  form.elements.asset.value = "";
}

function renderMaterials() {
  materialsRoot.innerHTML = "";
  const keyword = materialSearchInput.value.trim();
  const total = materialState.items.length;

  if (!total) {
    materialsRoot.innerHTML = `<p>暂无素材，先上传一条参考素材吧。</p>`;
    materialState.page = 1;
    renderPagination({
      total: 0,
      page: 1,
      pageSize: materialState.pageSize,
      paginationEl: materialPagination,
      prevBtn: materialPrevPageBtn,
      nextBtn: materialNextPageBtn,
      pageInfoEl: materialPageInfo,
    });
    return;
  }

  const paginationInfo = renderPagination({
    total,
    page: materialState.page,
    pageSize: materialState.pageSize,
    paginationEl: materialPagination,
    prevBtn: materialPrevPageBtn,
    nextBtn: materialNextPageBtn,
    pageInfoEl: materialPageInfo,
  });
  materialState.page = paginationInfo.currentPage;

  const startIndex = (materialState.page - 1) * materialState.pageSize;
  const pageItems = materialState.items.slice(startIndex, startIndex + materialState.pageSize);

  pageItems.forEach((item) => {
    const fragment = materialTemplate.content.cloneNode(true);
    const shellEl = fragment.querySelector(".material-media");
    const imageEl = fragment.querySelector(".material-image");
    const videoEl = fragment.querySelector(".material-video");
    const tipEl = fragment.querySelector(".material-tip");
    const titleEl = fragment.querySelector(".material-title");
    const metaEl = fragment.querySelector(".material-meta");
    const descEl = fragment.querySelector(".material-description");
    const editBtn = fragment.querySelector(".material-edit-btn");
    const deleteBtn = fragment.querySelector(".material-delete-btn");
    const editForm = fragment.querySelector(".material-edit-form");
    const cancelBtn = fragment.querySelector(".material-cancel-edit-btn");

    const type = materialTypeOf(item);
    const updateText = item.updatedAt ? `，更新于：${formatTime(item.updatedAt)}` : "";

    setHighlightedText(titleEl, item.title, keyword);
    setHighlightedText(descEl, item.description || "暂无说明", keyword);
    metaEl.textContent = `${type === "video" ? "视频" : "图片"} · ${item.category} · 创建于：${formatTime(item.createdAt)}${updateText}`;

    shellEl.tabIndex = 0;
    if (type === "video") {
      imageEl.classList.add("hidden");
      videoEl.classList.remove("hidden");
      videoEl.src = item.assetUrl;
      tipEl.textContent = "单击预览视频";
    } else {
      videoEl.classList.add("hidden");
      videoEl.pause();
      videoEl.src = "";
      imageEl.classList.remove("hidden");
      imageEl.src = item.assetUrl;
      imageEl.alt = item.title;
      tipEl.textContent = "单击预览图片";
    }

    shellEl.addEventListener("click", () => {
      openLightbox({
        type,
        url: item.assetUrl,
        title: item.title,
        category: item.category,
      });
    });

    shellEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox({
          type,
          url: item.assetUrl,
          title: item.title,
          category: item.category,
        });
      }
    });

    editBtn.addEventListener("click", () => {
      fillMaterialEditForm(editForm, item);
      editForm.classList.remove("hidden");
    });

    cancelBtn.addEventListener("click", () => {
      editForm.classList.add("hidden");
    });

    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(editForm);
      const assetFile = editForm.elements.asset.files[0];
      if (!assetFile) {
        formData.delete("asset");
      }

      try {
        await fetchJson(`/api/materials/${item.id}`, {
          method: "PATCH",
          body: formData,
        });
        setMessage(materialMessageEl, "素材修改成功");
        editForm.classList.add("hidden");
        await Promise.all([loadMaterialCategories(), loadMaterials()]);
      } catch (error) {
        setMessage(materialMessageEl, error.message, true);
      }
    });

    deleteBtn.addEventListener("click", async () => {
      const ok = window.confirm(`确定删除素材「${item.title}」吗？`);
      if (!ok) {
        return;
      }

      try {
        await fetchJson(`/api/materials/${item.id}`, { method: "DELETE" });
        setMessage(materialMessageEl, "素材删除成功");
        await Promise.all([loadMaterialCategories(), loadMaterials()]);
      } catch (error) {
        setMessage(materialMessageEl, error.message, true);
      }
    });

    materialsRoot.appendChild(fragment);
  });
}

async function loadMaterialCategories() {
  const categories = await fetchJson("/api/material-categories");
  renderCategories(materialFilterCategory, categories);
}

async function loadMaterials({ resetPage = false } = {}) {
  if (resetPage) {
    materialState.page = 1;
  }
  const url = buildMaterialQuery();
  materialState.items = await fetchJson(url);
  renderMaterials();
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tabTarget);
  });
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);

  try {
    await fetchJson("/api/paintings", {
      method: "POST",
      body: formData,
    });
    uploadForm.reset();
    setMessage(messageEl, "作品上传成功");
    await Promise.all([loadPaintingCategories(), loadPaintings({ resetPage: true })]);
  } catch (error) {
    setMessage(messageEl, error.message, true);
  }
});

filterCategory.addEventListener("change", async () => {
  try {
    await loadPaintings({ resetPage: true });
  } catch (error) {
    setMessage(messageEl, error.message, true);
  }
});

searchBtn.addEventListener("click", async () => {
  try {
    await loadPaintings({ resetPage: true });
  } catch (error) {
    setMessage(messageEl, error.message, true);
  }
});

resetBtn.addEventListener("click", async () => {
  filterCategory.value = "";
  searchInput.value = "";
  try {
    await loadPaintings({ resetPage: true });
    setMessage(messageEl, "已重置作品检索条件");
  } catch (error) {
    setMessage(messageEl, error.message, true);
  }
});

materialUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(materialUploadForm);

  try {
    await fetchJson("/api/materials", {
      method: "POST",
      body: formData,
    });
    materialUploadForm.reset();
    setMessage(materialMessageEl, "素材上传成功");
    await Promise.all([loadMaterialCategories(), loadMaterials({ resetPage: true })]);
  } catch (error) {
    setMessage(materialMessageEl, error.message, true);
  }
});

materialFilterCategory.addEventListener("change", async () => {
  try {
    await loadMaterials({ resetPage: true });
  } catch (error) {
    setMessage(materialMessageEl, error.message, true);
  }
});

materialSearchBtn.addEventListener("click", async () => {
  try {
    await loadMaterials({ resetPage: true });
  } catch (error) {
    setMessage(materialMessageEl, error.message, true);
  }
});

materialResetBtn.addEventListener("click", async () => {
  materialFilterCategory.value = "";
  materialSearchInput.value = "";
  try {
    await loadMaterials({ resetPage: true });
    setMessage(materialMessageEl, "已重置素材检索条件");
  } catch (error) {
    setMessage(materialMessageEl, error.message, true);
  }
});

let paintingSearchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(paintingSearchTimer);
  paintingSearchTimer = setTimeout(async () => {
    try {
      await loadPaintings({ resetPage: true });
    } catch (error) {
      setMessage(messageEl, error.message, true);
    }
  }, 250);
});

let materialSearchTimer;
materialSearchInput.addEventListener("input", () => {
  clearTimeout(materialSearchTimer);
  materialSearchTimer = setTimeout(async () => {
    try {
      await loadMaterials({ resetPage: true });
    } catch (error) {
      setMessage(materialMessageEl, error.message, true);
    }
  }, 250);
});

prevPageBtn.addEventListener("click", () => {
  if (paintingState.page <= 1) {
    return;
  }
  paintingState.page -= 1;
  renderPaintings();
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(paintingState.items.length / paintingState.pageSize));
  if (paintingState.page >= totalPages) {
    return;
  }
  paintingState.page += 1;
  renderPaintings();
});

materialPrevPageBtn.addEventListener("click", () => {
  if (materialState.page <= 1) {
    return;
  }
  materialState.page -= 1;
  renderMaterials();
});

materialNextPageBtn.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(materialState.items.length / materialState.pageSize));
  if (materialState.page >= totalPages) {
    return;
  }
  materialState.page += 1;
  renderMaterials();
});

lightboxClose.addEventListener("click", () => {
  closeLightbox();
});

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lightbox.classList.contains("hidden")) {
    closeLightbox();
  }
});

(async () => {
  activateTab("paintings");
  try {
    await Promise.all([
      loadPaintingCategories(),
      loadPaintings({ resetPage: true }),
      loadMaterialCategories(),
      loadMaterials({ resetPage: true }),
    ]);
  } catch (error) {
    setMessage(messageEl, error.message, true);
    setMessage(materialMessageEl, error.message, true);
  }
})();
