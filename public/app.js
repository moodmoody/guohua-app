const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanes = Array.from(document.querySelectorAll(".tab-pane"));

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authMessage = document.getElementById("auth-message");
const logoutBtn = document.getElementById("logout-btn");
const currentUserAvatar = document.getElementById("current-user-avatar");
const currentUserName = document.getElementById("current-user-name");
const currentUserUsername = document.getElementById("current-user-username");
const currentUserBio = document.getElementById("current-user-bio");

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
const { removeFileAt } = window.FileSelection;

const profileForm = document.getElementById("profile-form");
const avatarForm = document.getElementById("avatar-form");
const passwordForm = document.getElementById("password-form");
const profileMessage = document.getElementById("profile-message");
let currentUser = null;

const paintingState = {
  items: [],
  page: 1,
  pageSize: 6,
  total: 0,
  totalPages: 1,
};

const materialState = {
  items: [],
  page: 1,
  pageSize: 6,
  total: 0,
  totalPages: 1,
};

function formatTime(iso) {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function setMessage(target, text, isError = false) {
  if (!target) {
    return;
  }
  target.textContent = text;
  target.style.color = isError ? "#8b1d1d" : "#7a6f63";
}

function renderCurrentUser(user) {
  currentUser = user;
  const displayName = user?.displayName || user?.username || "";
  currentUserName.textContent = displayName;
  currentUserUsername.textContent = user?.username ? `@${user.username}` : "";
  currentUserBio.textContent = (user?.bio || "").trim() || "未填写简介";
  if (user?.avatarUrl) {
    currentUserAvatar.src = user.avatarUrl;
    currentUserAvatar.title = "点击预览头像";
    currentUserAvatar.setAttribute("aria-label", `${displayName || "用户"}头像，点击预览`);
  } else {
    currentUserAvatar.removeAttribute("src");
    currentUserAvatar.removeAttribute("title");
    currentUserAvatar.removeAttribute("aria-label");
  }
  currentUserAvatar.alt = displayName ? `${displayName}头像` : "";
  currentUserAvatar.classList.toggle("empty", !user?.avatarUrl);
  currentUserAvatar.classList.toggle("previewable", Boolean(user?.avatarUrl));
  profileForm.elements.displayName.value = displayName;
  profileForm.elements.bio.value = user?.bio || "";
}

async function loadAppData() {
  await Promise.all([
    loadPaintingCategories(),
    loadPaintings({ resetPage: true }),
    loadMaterialCategories(),
    loadMaterials({ resetPage: true }),
  ]);
}

function showAuth() {
  currentUser = null;
  authScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
  paintingState.items = [];
  paintingState.total = 0;
  paintingState.page = 1;
  paintingState.totalPages = 1;
  materialState.items = [];
  materialState.total = 0;
  materialState.page = 1;
  materialState.totalPages = 1;
  paintingsRoot.innerHTML = "";
  materialsRoot.innerHTML = "";
}

async function showApp(user) {
  renderCurrentUser(user);
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  activateTab("paintings");
  await loadAppData();
}

async function initializeAuth() {
  try {
    const payload = await fetchJson("/api/auth/me");
    await showApp(payload.user);
  } catch (_error) {
    showAuth();
  }
}

function updateFileInputFiles(input, files) {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function renderSelectedFiles(input, listEl) {
  const files = Array.from(input.files || []);
  listEl.innerHTML = "";
  listEl.classList.toggle("hidden", files.length === 0);

  files.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "selected-file-item";

    const name = document.createElement("span");
    name.className = "selected-file-name";
    name.textContent = file.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "selected-file-remove";
    removeBtn.textContent = "移除";
    removeBtn.addEventListener("click", () => {
      updateFileInputFiles(input, removeFileAt(input.files, index));
    });

    item.appendChild(name);
    item.appendChild(removeBtn);
    listEl.appendChild(item);
  });
}

function bindFilePicker(input) {
  if (!input || input.dataset.filePickerBound === "true") {
    return;
  }

  const listEl = document.createElement("div");
  listEl.className = "selected-file-list hidden";
  input.insertAdjacentElement("afterend", listEl);
  input.dataset.filePickerBound = "true";

  input.addEventListener("change", () => {
    renderSelectedFiles(input, listEl);
  });
}

function bindFilePickers(root = document) {
  root.querySelectorAll('input[type="file"]').forEach(bindFilePicker);
}

function resetFilePickers(root = document) {
  root.querySelectorAll('input[type="file"]').forEach((input) => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
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

function inferTypeFromUrl(url, fallbackType = "image") {
  const target = String(url || "").toLowerCase();
  if (target.endsWith(".mp4") || target.endsWith(".webm") || target.endsWith(".mov") || target.endsWith(".mkv")) {
    return "video";
  }
  return fallbackType === "video" ? "video" : "image";
}

function normalizeAttachment(attachment, fallbackType = "image") {
  const url = String(attachment?.url || attachment?.imageUrl || attachment?.assetUrl || "").trim();
  if (!url) {
    return null;
  }

  const rawType = String(attachment?.type || attachment?.assetType || "").trim();
  const type = rawType === "video" || rawType === "image" ? rawType : inferTypeFromUrl(url, fallbackType);

  const idFromUrl = url.split("/").filter(Boolean).pop() || "";
  const id = String(attachment?.id || idFromUrl).trim() || `${type}-${Date.now()}`;

  return { id, url, type };
}

function getAttachments(item, legacyUrl, legacyType) {
  const attachments = Array.isArray(item.attachments)
    ? item.attachments.map((attachment) => normalizeAttachment(attachment, legacyType)).filter(Boolean)
    : [];

  if (attachments.length > 0) {
    return attachments;
  }

  const fallback = normalizeAttachment({
    id: String(legacyUrl || "").split("/").filter(Boolean).pop() || "",
    url: legacyUrl,
    type: legacyType,
  }, legacyType);

  return fallback ? [fallback] : [];
}

function setPreviewMedia({ imageEl, videoEl, tipEl, attachment, title }) {
  imageEl.classList.add("hidden");
  imageEl.src = "";
  imageEl.alt = "";

  videoEl.classList.add("hidden");
  videoEl.pause();
  videoEl.src = "";

  if (!attachment) {
    tipEl.textContent = "暂无附件";
    return;
  }

  if (attachment.type === "video") {
    videoEl.preload = "metadata";
    videoEl.src = attachment.url;
    videoEl.classList.remove("hidden");
    tipEl.textContent = "单击预览视频";
    return;
  }

  imageEl.loading = "lazy";
  imageEl.decoding = "async";
  imageEl.src = attachment.url;
  imageEl.alt = title;
  imageEl.classList.remove("hidden");
  tipEl.textContent = "单击预览图片";
}

function applyListPayload(state, payload) {
  if (Array.isArray(payload)) {
    state.items = payload;
    state.total = payload.length;
    state.totalPages = Math.max(1, Math.ceil(payload.length / state.pageSize));
    return;
  }

  state.items = Array.isArray(payload?.items) ? payload.items : [];
  state.total = Number.isInteger(payload?.total) ? payload.total : state.items.length;
  state.page = Number.isInteger(payload?.page) ? payload.page : state.page;
  state.pageSize = Number.isInteger(payload?.pageSize) ? payload.pageSize : state.pageSize;
  state.totalPages = Number.isInteger(payload?.totalPages)
    ? payload.totalPages
    : Math.max(1, Math.ceil(state.total / state.pageSize));
}

function renderAttachmentStrip({ container, attachments, selectedIndex, onSelect, onDelete }) {
  container.innerHTML = "";

  if (!attachments.length) {
    const empty = document.createElement("p");
    empty.className = "attachment-empty";
    empty.textContent = "暂无附件";
    container.appendChild(empty);
    return;
  }

  attachments.forEach((attachment, index) => {
    const item = document.createElement("div");
    item.className = "attachment-item";

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `attachment-chip ${attachment.type === "video" ? "attachment-video" : "attachment-image"}`;
    if (index === selectedIndex) {
      chip.classList.add("active");
    }
    chip.textContent = `${attachment.type === "video" ? "视频" : "图片"} ${index + 1}`;
    chip.addEventListener("click", () => {
      onSelect(index);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "attachment-remove";
    removeBtn.textContent = "删除";
    removeBtn.addEventListener("click", () => {
      onDelete(attachment);
    });

    item.appendChild(chip);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
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
  params.set("page", String(paintingState.page));
  params.set("pageSize", String(paintingState.pageSize));

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
  const total = paintingState.total;

  if (!total) {
    paintingsRoot.innerHTML = `<p>暂无作品，先收入一幅画作吧。</p>`;
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

  const pageItems = paintingState.items;

  pageItems.forEach((item) => {
    const fragment = paintingTemplate.content.cloneNode(true);
    const shellEl = fragment.querySelector(".painting-media");
    const previewImageEl = fragment.querySelector(".painting-preview-image");
    const previewVideoEl = fragment.querySelector(".painting-preview-video");
    const tipEl = fragment.querySelector(".painting-tip");
    const attachmentsEl = fragment.querySelector(".painting-attachments");
    const titleEl = fragment.querySelector(".painting-title");
    const metaEl = fragment.querySelector(".meta");
    const descEl = fragment.querySelector(".description");
    const editBtn = fragment.querySelector(".edit-btn");
    const deleteBtn = fragment.querySelector(".delete-btn");
    const editForm = fragment.querySelector(".edit-form");
    const cancelEditBtn = fragment.querySelector(".cancel-edit-btn");
    const appendForm = fragment.querySelector(".append-attachment-form");
    const commentList = fragment.querySelector(".comment-list");
    const commentForm = fragment.querySelector(".comment-form");

    const attachments = getAttachments(item, item.imageUrl, "image");
    let selectedIndex = 0;

    bindFilePickers(fragment);
    setHighlightedText(titleEl, item.title, keyword);

    const updateText = item.updatedAt ? `，更新于：${formatTime(item.updatedAt)}` : "";
    const categoryEl = document.createElement("span");
    setHighlightedText(categoryEl, item.category, keyword);
    metaEl.textContent = "";
    metaEl.appendChild(categoryEl);
    metaEl.appendChild(document.createTextNode(` · 创建于：${formatTime(item.createdAt)}${updateText}`));

    setHighlightedText(descEl, item.description || "暂无题跋简介", keyword);

    const renderCurrentAttachment = () => {
      const current = attachments[selectedIndex] || null;
      setPreviewMedia({
        imageEl: previewImageEl,
        videoEl: previewVideoEl,
        tipEl,
        attachment: current,
        title: item.title,
      });

      shellEl.tabIndex = current ? 0 : -1;
      renderAttachmentStrip({
        container: attachmentsEl,
        attachments,
        selectedIndex,
        onSelect: (nextIndex) => {
          selectedIndex = nextIndex;
          renderCurrentAttachment();
        },
        onDelete: async (attachment) => {
          const ok = window.confirm("确定删除这条附件吗？");
          if (!ok) {
            return;
          }

          try {
            await fetchJson(`/api/paintings/${item.id}/attachments/${encodeURIComponent(attachment.id)}`, {
              method: "DELETE",
            });
            setMessage(messageEl, "作品附件已删除");
            await Promise.all([loadPaintingCategories(), loadPaintings()]);
          } catch (error) {
            setMessage(messageEl, error.message, true);
          }
        },
      });
    };

    renderCurrentAttachment();

    shellEl.addEventListener("click", () => {
      const current = attachments[selectedIndex];
      if (!current) {
        return;
      }
      openLightbox({
        type: current.type,
        url: current.url,
        title: item.title,
        category: item.category,
      });
    });

    shellEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const current = attachments[selectedIndex];
      if (!current) {
        return;
      }
      event.preventDefault();
      openLightbox({
        type: current.type,
        url: current.url,
        title: item.title,
        category: item.category,
      });
    });

    const comments = Array.isArray(item.comments) ? item.comments : [];
    if (!comments.length) {
      commentList.innerHTML = `<li>暂无评语</li>`;
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
      resetFilePickers(editForm);
      editForm.classList.remove("hidden");
    });

    cancelEditBtn.addEventListener("click", () => {
      editForm.classList.add("hidden");
    });

    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        title: editForm.elements.title.value.trim(),
        category: editForm.elements.category.value.trim(),
        description: editForm.elements.description.value.trim(),
      };

      try {
        await fetchJson(`/api/paintings/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage(messageEl, "作品已更新");
        editForm.classList.add("hidden");
        resetFilePickers(editForm);
        await Promise.all([loadPaintingCategories(), loadPaintings()]);
      } catch (error) {
        setMessage(messageEl, error.message, true);
      }
    });

    appendForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const files = Array.from(appendForm.elements.image.files || []);
      if (!files.length) {
        return;
      }

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("image", file);
      });

      try {
        await fetchJson(`/api/paintings/${item.id}/attachments`, {
          method: "POST",
          body: formData,
        });
        appendForm.reset();
        resetFilePickers(appendForm);
        setMessage(messageEl, "作品附件已追加");
        await Promise.all([loadPaintingCategories(), loadPaintings()]);
      } catch (error) {
        setMessage(messageEl, error.message, true);
      }
    });

    deleteBtn.addEventListener("click", async () => {
      const ok = window.confirm(`确定删除作品《${item.title}》吗？`);
      if (!ok) {
        return;
      }

      try {
        await fetchJson(`/api/paintings/${item.id}`, { method: "DELETE" });
        setMessage(messageEl, "作品已删除");
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
        setMessage(messageEl, "评语已添加");
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
  applyListPayload(paintingState, await fetchJson(url));
  renderPaintings();
}

function materialTypeOf(item) {
  if (item.assetType === "video" || item.assetType === "image") {
    return item.assetType;
  }

  return inferTypeFromUrl(item.assetUrl || "", "image");
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
  params.set("page", String(materialState.page));
  params.set("pageSize", String(materialState.pageSize));

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
  const total = materialState.total;

  if (!total) {
    materialsRoot.innerHTML = `<p>暂无素材，先收入一条参考素材吧。</p>`;
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

  const pageItems = materialState.items;

  pageItems.forEach((item) => {
    const fragment = materialTemplate.content.cloneNode(true);
    const shellEl = fragment.querySelector(".material-media");
    const previewImageEl = fragment.querySelector(".material-preview-image");
    const previewVideoEl = fragment.querySelector(".material-preview-video");
    const tipEl = fragment.querySelector(".material-tip");
    const attachmentsEl = fragment.querySelector(".material-attachments");
    const titleEl = fragment.querySelector(".material-title");
    const metaEl = fragment.querySelector(".material-meta");
    const descEl = fragment.querySelector(".material-description");
    const editBtn = fragment.querySelector(".material-edit-btn");
    const deleteBtn = fragment.querySelector(".material-delete-btn");
    const editForm = fragment.querySelector(".material-edit-form");
    const cancelBtn = fragment.querySelector(".material-cancel-edit-btn");
    const appendForm = fragment.querySelector(".material-append-attachment-form");

    const attachments = getAttachments(item, item.assetUrl, materialTypeOf(item));
    let selectedIndex = 0;

    bindFilePickers(fragment);
    setHighlightedText(titleEl, item.title, keyword);
    setHighlightedText(descEl, item.description || "暂无素材说明", keyword);

    const updateText = item.updatedAt ? `，更新于：${formatTime(item.updatedAt)}` : "";
    const currentType = attachments[0]?.type || materialTypeOf(item);

    metaEl.textContent = "";
    metaEl.appendChild(document.createTextNode(`${currentType === "video" ? "视频" : "图片"} · `));
    const categoryEl = document.createElement("span");
    setHighlightedText(categoryEl, item.category, keyword);
    metaEl.appendChild(categoryEl);
    metaEl.appendChild(document.createTextNode(` · 创建于：${formatTime(item.createdAt)}${updateText}`));

    const renderCurrentAttachment = () => {
      const current = attachments[selectedIndex] || null;
      setPreviewMedia({
        imageEl: previewImageEl,
        videoEl: previewVideoEl,
        tipEl,
        attachment: current,
        title: item.title,
      });

      shellEl.tabIndex = current ? 0 : -1;
      renderAttachmentStrip({
        container: attachmentsEl,
        attachments,
        selectedIndex,
        onSelect: (nextIndex) => {
          selectedIndex = nextIndex;
          renderCurrentAttachment();
        },
        onDelete: async (attachment) => {
          const ok = window.confirm("确定删除这条附件吗？");
          if (!ok) {
            return;
          }

          try {
            await fetchJson(`/api/materials/${item.id}/attachments/${encodeURIComponent(attachment.id)}`, {
              method: "DELETE",
            });
            setMessage(materialMessageEl, "素材附件已删除");
            await Promise.all([loadMaterialCategories(), loadMaterials()]);
          } catch (error) {
            setMessage(materialMessageEl, error.message, true);
          }
        },
      });
    };

    renderCurrentAttachment();

    shellEl.addEventListener("click", () => {
      const current = attachments[selectedIndex];
      if (!current) {
        return;
      }
      openLightbox({
        type: current.type,
        url: current.url,
        title: item.title,
        category: item.category,
      });
    });

    shellEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const current = attachments[selectedIndex];
      if (!current) {
        return;
      }
      event.preventDefault();
      openLightbox({
        type: current.type,
        url: current.url,
        title: item.title,
        category: item.category,
      });
    });

    editBtn.addEventListener("click", () => {
      fillMaterialEditForm(editForm, item);
      resetFilePickers(editForm);
      editForm.classList.remove("hidden");
    });

    cancelBtn.addEventListener("click", () => {
      editForm.classList.add("hidden");
    });

    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        title: editForm.elements.title.value.trim(),
        category: editForm.elements.category.value.trim(),
        description: editForm.elements.description.value.trim(),
      };

      try {
        await fetchJson(`/api/materials/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage(materialMessageEl, "素材已更新");
        editForm.classList.add("hidden");
        resetFilePickers(editForm);
        await Promise.all([loadMaterialCategories(), loadMaterials()]);
      } catch (error) {
        setMessage(materialMessageEl, error.message, true);
      }
    });

    appendForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const files = Array.from(appendForm.elements.asset.files || []);
      if (!files.length) {
        return;
      }

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("asset", file);
      });

      try {
        await fetchJson(`/api/materials/${item.id}/attachments`, {
          method: "POST",
          body: formData,
        });
        appendForm.reset();
        resetFilePickers(appendForm);
        setMessage(materialMessageEl, "素材附件已追加");
        await Promise.all([loadMaterialCategories(), loadMaterials()]);
      } catch (error) {
        setMessage(materialMessageEl, error.message, true);
      }
    });

    deleteBtn.addEventListener("click", async () => {
      const ok = window.confirm(`确定删除素材《${item.title}》吗？`);
      if (!ok) {
        return;
      }

      try {
        await fetchJson(`/api/materials/${item.id}`, { method: "DELETE" });
        setMessage(materialMessageEl, "素材已删除");
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
  applyListPayload(materialState, await fetchJson(url));
  renderMaterials();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: loginForm.elements.username.value,
        password: loginForm.elements.password.value,
      }),
    });
    loginForm.reset();
    setMessage(authMessage, "");
    await showApp(payload.user);
  } catch (error) {
    setMessage(authMessage, error.message, true);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await fetchJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: registerForm.elements.username.value,
        displayName: registerForm.elements.displayName.value,
        password: registerForm.elements.password.value,
        inviteCode: registerForm.elements.inviteCode.value,
      }),
    });
    registerForm.reset();
    setMessage(authMessage, "");
    await showApp(payload.user);
  } catch (error) {
    setMessage(authMessage, error.message, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await fetchJson("/api/auth/logout", { method: "POST" });
  } catch (_error) {}
  showAuth();
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await fetchJson("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: profileForm.elements.displayName.value,
        bio: profileForm.elements.bio.value,
      }),
    });
    renderCurrentUser(payload.user);
    setMessage(profileMessage, "资料已保存");
  } catch (error) {
    setMessage(profileMessage, error.message, true);
  }
});

avatarForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(avatarForm);
  try {
    const payload = await fetchJson("/api/profile/avatar", {
      method: "POST",
      body: formData,
    });
    avatarForm.reset();
    resetFilePickers(avatarForm);
    renderCurrentUser(payload.user);
    setMessage(profileMessage, "头像已更新");
  } catch (error) {
    setMessage(profileMessage, error.message, true);
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await fetchJson("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: passwordForm.elements.currentPassword.value,
        newPassword: passwordForm.elements.newPassword.value,
      }),
    });
    passwordForm.reset();
    renderCurrentUser(payload.user);
    setMessage(profileMessage, "密码已更新");
  } catch (error) {
    setMessage(profileMessage, error.message, true);
  }
});

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
    resetFilePickers(uploadForm);
    setMessage(messageEl, "作品已收入册");
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
    setMessage(messageEl, "已清空作品检索条件");
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
    resetFilePickers(materialUploadForm);
    setMessage(materialMessageEl, "素材已收入库");
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
    setMessage(materialMessageEl, "已清空素材检索条件");
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
  }, 400);
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
  }, 400);
});

prevPageBtn.addEventListener("click", async () => {
  if (paintingState.page <= 1) {
    return;
  }
  paintingState.page -= 1;
  try {
    await loadPaintings();
  } catch (error) {
    setMessage(messageEl, error.message, true);
  }
});

nextPageBtn.addEventListener("click", async () => {
  if (paintingState.page >= paintingState.totalPages) {
    return;
  }
  paintingState.page += 1;
  try {
    await loadPaintings();
  } catch (error) {
    setMessage(messageEl, error.message, true);
  }
});

materialPrevPageBtn.addEventListener("click", async () => {
  if (materialState.page <= 1) {
    return;
  }
  materialState.page -= 1;
  try {
    await loadMaterials();
  } catch (error) {
    setMessage(materialMessageEl, error.message, true);
  }
});

materialNextPageBtn.addEventListener("click", async () => {
  if (materialState.page >= materialState.totalPages) {
    return;
  }
  materialState.page += 1;
  try {
    await loadMaterials();
  } catch (error) {
    setMessage(materialMessageEl, error.message, true);
  }
});

lightboxClose.addEventListener("click", () => {
  closeLightbox();
});

currentUserAvatar.addEventListener("click", () => {
  if (!currentUser?.avatarUrl) {
    return;
  }
  const displayName = currentUser?.displayName || currentUser?.username || "用户";
  openLightbox({
    type: "image",
    url: currentUser.avatarUrl,
    title: `${displayName}头像`,
    category: "个人资料",
  });
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
  bindFilePickers();
  await initializeAuth();
})();
