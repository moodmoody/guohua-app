const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanes = Array.from(document.querySelectorAll(".tab-pane"));

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const showRegisterBtn = document.getElementById("show-register-btn");
const showLoginBtn = document.getElementById("show-login-btn");
const authMessage = document.getElementById("auth-message");
const logoutBtn = document.getElementById("logout-btn");
const currentUserAvatar = document.getElementById("current-user-avatar");
const currentUserName = document.getElementById("current-user-name");
const currentUserUsername = document.getElementById("current-user-username");
const currentUserBio = document.getElementById("current-user-bio");
const membershipSummary = document.getElementById("membership-summary");

const uploadForm = document.getElementById("upload-form");
const filterCategory = document.getElementById("filter-category");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const resetBtn = document.getElementById("reset-btn");
const paintingsRoot = document.getElementById("paintings");
const messageEl = document.getElementById("message");
const uploadMessageEl = document.getElementById("upload-message");
const paintingTemplate = document.getElementById("painting-template");
const paintingTagStrip = document.getElementById("painting-tag-strip");
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
const materialTagStrip = document.getElementById("material-tag-strip");
const materialPagination = document.getElementById("material-pagination");
const materialPrevPageBtn = document.getElementById("material-prev-page-btn");
const materialNextPageBtn = document.getElementById("material-next-page-btn");
const materialPageInfo = document.getElementById("material-page-info");

const lightbox = document.getElementById("lightbox");
const lightboxContent = document.getElementById("lightbox-content");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxVideo = document.getElementById("lightbox-video");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");
const lightboxStatus = document.getElementById("lightbox-status");
const shareSheet = document.getElementById("share-sheet");
const shareSheetClose = document.getElementById("share-sheet-close");
const shareSheetWork = document.getElementById("share-sheet-work");
const shareLinkInput = document.getElementById("share-link-input");
const shareOpenLink = document.getElementById("share-open-link");
const shareCopyBtn = document.getElementById("share-copy-btn");
const sharePosterBtn = document.getElementById("share-poster-btn");
const shareSystemBtn = document.getElementById("share-system-btn");
const shareDownloadLink = document.getElementById("share-download-link");
const sharePosterPreview = document.getElementById("share-poster-preview");
const { removeFileAt } = window.FileSelection;

const profileForm = document.getElementById("profile-form");
const avatarForm = document.getElementById("avatar-form");
const passwordForm = document.getElementById("password-form");
const profileMessage = document.getElementById("profile-message");
const adminUserManagement = document.getElementById("admin-user-management");
const adminUsersRoot = document.getElementById("admin-users");
const adminUsersMessage = document.getElementById("admin-users-message");
const adminUsersRefresh = document.getElementById("admin-users-refresh");
const adminUserTemplate = document.getElementById("admin-user-template");
let currentUser = null;
let currentUsage = null;
let lightboxState = {
  attachments: [],
  index: 0,
  title: "",
  category: "",
};
let shareState = {
  title: "",
  category: "",
  description: "",
  shareUrl: "",
  posterImageUrl: "",
  posterBlob: null,
  posterObjectUrl: "",
};

const paintingState = {
  items: [],
  page: 1,
  pageSize: 6,
  total: 0,
  totalPages: 1,
  tags: [],
  selectedTag: "",
};

const materialState = {
  items: [],
  page: 1,
  pageSize: 6,
  total: 0,
  totalPages: 1,
  tags: [],
  selectedTag: "",
};

const IMAGE_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

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

function setUploadMessage(text, isError = false) {
  setMessage(uploadMessageEl, text, isError);
  if (text && isError && uploadMessageEl) {
    uploadMessageEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function paintingImageLimitMessage(files) {
  const oversized = (Array.isArray(files) ? files : []).find((file) => Number(file?.size || 0) > IMAGE_UPLOAD_LIMIT_BYTES);
  if (!oversized) {
    return "";
  }
  return `图片不能超过 10M，请压缩后再上传：${oversized.name || "所选图片"}`;
}

function friendlyErrorMessage(message) {
  if (message === "Image file must be <= 10MB") {
    return "图片不能超过 10M，请压缩后再上传";
  }
  return message;
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) {
    return "不限";
  }
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) {
    return `${Math.round(value / 1024 / 1024)}M`;
  }
  if (value >= 1024) {
    return `${Math.round(value / 1024)}K`;
  }
  return `${value}B`;
}

function formatLimit(value) {
  return value === null || value === undefined ? "不限" : value;
}

function isAdminUser(user) {
  return user?.username === "lulia" || user?.plan === "admin";
}

function renderAdminAccess(user) {
  const isAdmin = isAdminUser(user);
  if (adminUserManagement) {
    adminUserManagement.classList.toggle("hidden", !isAdmin);
  }
}

function getVisibleUsage() {
  const usage = currentUsage || {};
  return {
    storageBytes: usage.storageBytes,
    paintingCount: Math.max(Number(usage.paintingCount || 0), Number(paintingState.total || 0)),
    materialCount: Math.max(Number(usage.materialCount || 0), Number(materialState.total || 0)),
  };
}

function showLoginView(message = "", isError = false) {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  setMessage(authMessage, message, isError);
}

function showRegisterView() {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
  setMessage(authMessage, "");
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
  if (membershipSummary) {
    const quota = user?.quota || {};
    const usage = getVisibleUsage();
    if (user?.plan === "admin" || user?.username === "lulia") {
      membershipSummary.textContent = [
        `空间 ${formatBytes(usage.storageBytes)}`,
        `作品 ${usage.paintingCount || 0}`,
        `素材 ${usage.materialCount || 0}`,
      ].join(" · ");
    } else {
      membershipSummary.textContent = [
        user?.plan === "free" ? "免费版" : user?.plan || "会员",
        `空间 ${formatBytes(usage.storageBytes)} / ${formatBytes(quota.storageBytes)}`,
        `作品 ${usage.paintingCount || 0}/${formatLimit(quota.paintingLimit)}`,
        `素材 ${usage.materialCount || 0}/${formatLimit(quota.materialLimit)}`,
      ].join(" · ");
    }
  }
  profileForm.elements.displayName.value = displayName;
  profileForm.elements.bio.value = user?.bio || "";
  if (adminUserManagement) {
    adminUserManagement.classList.toggle("hidden", !isAdminUser(currentUser));
  }
}

async function loadAppData() {
  await Promise.all([
    loadPaintingCategories(),
    loadPaintingTags(),
    loadPaintings({ resetPage: true }),
    loadMaterialCategories(),
    loadMaterialTags(),
    loadMaterials({ resetPage: true }),
  ]);
  if (isAdminUser(currentUser)) {
    await loadAdminUsers();
  }
}

function showAuth() {
  currentUser = null;
  currentUsage = null;
  authScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
  showLoginView();
  paintingState.items = [];
  paintingState.total = 0;
  paintingState.page = 1;
  paintingState.totalPages = 1;
  paintingState.tags = [];
  paintingState.selectedTag = "";
  materialState.items = [];
  materialState.total = 0;
  materialState.page = 1;
  materialState.totalPages = 1;
  materialState.tags = [];
  materialState.selectedTag = "";
  paintingsRoot.innerHTML = "";
  materialsRoot.innerHTML = "";
  if (adminUsersRoot) {
    adminUsersRoot.innerHTML = "";
  }
  renderAdminAccess(null);
  renderPaintingTagStrip();
  renderMaterialTagStrip();
}

function quotaMb(quota = {}) {
  return quota.storageBytes === null || quota.storageBytes === undefined
    ? ""
    : Math.round(Number(quota.storageBytes || 0) / 1024 / 1024);
}

function closeOtherAdminUserDetails(currentCard) {
  if (!adminUsersRoot) {
    return;
  }
  adminUsersRoot.querySelectorAll(".admin-user-card").forEach((card) => {
    if (card === currentCard) {
      return;
    }
    card.querySelector(".admin-user-detail")?.classList.add("hidden");
    const button = card.querySelector(".admin-user-open");
    if (button) {
      button.textContent = "设置";
      button.setAttribute("aria-expanded", "false");
    }
  });
}

function renderAdminUsers(users = []) {
  if (!adminUsersRoot || !adminUserTemplate) {
    return;
  }
  const manageableUsers = users.filter((user) => user.username !== "lulia" && user.id !== currentUser?.id);
  adminUsersRoot.innerHTML = "";
  if (!manageableUsers.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "暂无其他用户";
    adminUsersRoot.appendChild(empty);
    return;
  }

  manageableUsers.forEach((user) => {
    const fragment = adminUserTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".admin-user-card");
    const form = fragment.querySelector(".admin-quota-form");
    const detail = fragment.querySelector(".admin-user-detail");
    const openButton = fragment.querySelector(".admin-user-open");
    const quota = user.quota || {};
    const usage = user.usage || {};
    const protectedUser = user.username === "lulia" || user.id === currentUser?.id;

    card.dataset.userId = user.id;
    fragment.querySelector(".admin-user-name").textContent = user.displayName || user.username;
    fragment.querySelector(".admin-user-username").textContent = `@${user.username}`;
    fragment.querySelector(".admin-user-plan").textContent = user.plan === "admin" ? "管理员" : "试用";
    fragment.querySelector(".admin-user-usage").textContent = [
      `空间 ${formatBytes(usage.storageBytes)} / ${formatBytes(quota.storageBytes)}`,
      `作品 ${usage.paintingCount || 0}/${formatLimit(quota.paintingLimit)}`,
      `素材 ${usage.materialCount || 0}/${formatLimit(quota.materialLimit)}`,
    ].join(" · ");

    form.elements.plan.value = user.plan === "admin" ? "admin" : "free";
    form.elements.storageMb.value = quotaMb(quota);
    form.elements.paintingLimit.value = quota.paintingLimit ?? "";
    form.elements.materialLimit.value = quota.materialLimit ?? "";
    form.elements.aiEnabled.checked = quota.aiEnabled === true;
    form.querySelector(".admin-delete-user").disabled = protectedUser;
    openButton.setAttribute("aria-expanded", "false");

    openButton.addEventListener("click", () => {
      const willOpen = detail.classList.contains("hidden");
      closeOtherAdminUserDetails(card);
      detail.classList.toggle("hidden", !willOpen);
      openButton.textContent = willOpen ? "收起" : "设置";
      openButton.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await fetchJson(`/api/admin/users/${user.id}/quota`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: form.elements.plan.value,
            quota: {
              storageMb: form.elements.storageMb.value,
              paintingLimit: form.elements.paintingLimit.value,
              materialLimit: form.elements.materialLimit.value,
              aiEnabled: form.elements.aiEnabled.checked,
            },
          }),
        });
        setMessage(adminUsersMessage, "用户额度已保存");
        await loadAdminUsers();
      } catch (error) {
        setMessage(adminUsersMessage, error.message, true);
      }
    });

    form.querySelector(".admin-delete-user").addEventListener("click", async () => {
      const ok = window.confirm(`确定删除用户 @${user.username} 吗？该用户的作品和素材也会被删除。`);
      if (!ok) {
        return;
      }
      try {
        await fetchJson(`/api/admin/users/${user.id}`, { method: "DELETE" });
        setMessage(adminUsersMessage, "用户已删除");
        await loadAdminUsers();
      } catch (error) {
        setMessage(adminUsersMessage, error.message, true);
      }
    });

    adminUsersRoot.appendChild(fragment);
  });
}

async function loadAdminUsers() {
  if (!isAdminUser(currentUser) || !adminUsersRoot) {
    return;
  }
  try {
    const payload = await fetchJson("/api/admin/users");
    renderAdminUsers(payload.users || []);
  } catch (error) {
    setMessage(adminUsersMessage, error.message, true);
  }
}

async function showApp(user) {
  renderCurrentUser(user);
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  activateTab("paintings");
  await loadAppData();
}

async function refreshMembershipSummary() {
  if (!currentUser) {
    return;
  }
  try {
    const payload = await fetchJson("/api/auth/me");
    currentUsage = payload.usage || null;
    renderCurrentUser(payload.user);
  } catch (_error) {}
}

async function initializeAuth() {
  try {
    const payload = await fetchJson("/api/auth/me");
    currentUsage = payload.usage || null;
    await showApp(payload.user);
    await refreshMembershipSummary();
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

function renderLightboxMedia() {
  const current = lightboxState.attachments[lightboxState.index] || null;
  const hasMultiple = lightboxState.attachments.length > 1;

  lightboxImage.classList.add("hidden");
  lightboxVideo.classList.add("hidden");
  lightboxImage.src = "";
  lightboxImage.alt = "";
  lightboxVideo.src = "";
  lightboxVideo.pause();
  lightboxPrev.classList.toggle("hidden", !hasMultiple);
  lightboxNext.classList.toggle("hidden", !hasMultiple);
  lightboxStatus.classList.toggle("hidden", !hasMultiple);

  if (!current) {
    lightboxCaption.textContent = "";
    lightboxStatus.textContent = "";
    return;
  }

  if (current.type === "video") {
    lightboxVideo.src = current.url;
    lightboxVideo.classList.remove("hidden");
  } else {
    lightboxImage.src = current.url;
    lightboxImage.alt = lightboxState.title || "预览图";
    lightboxImage.classList.remove("hidden");
  }

  const counter = hasMultiple ? `${lightboxState.index + 1} / ${lightboxState.attachments.length}` : "";
  lightboxStatus.textContent = counter;
  lightboxCaption.textContent = [lightboxState.title, lightboxState.category, counter].filter(Boolean).join(" · ");
}

function showLightboxAttachment(delta) {
  if (lightbox.classList.contains("hidden") || lightboxState.attachments.length <= 1) {
    return;
  }
  lightboxState.index = moveAttachmentIndex(lightboxState.index, lightboxState.attachments.length, delta);
  renderLightboxMedia();
}

function openLightbox({ type, url, title, category, attachments, index = 0 }) {
  const groupedAttachments = Array.isArray(attachments) && attachments.length
    ? attachments
    : [{ type, url }].filter((attachment) => attachment.url);
  lightboxState = {
    attachments: groupedAttachments,
    index: Math.min(Math.max(index, 0), Math.max(groupedAttachments.length - 1, 0)),
    title: title || "",
    category: category || "",
  };
  renderLightboxMedia();
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
  lightboxStatus.textContent = "";
  lightboxState = {
    attachments: [],
    index: 0,
    title: "",
    category: "",
  };
  document.body.classList.remove("modal-open");
}

async function copyShareUrl(shareUrl) {
  try {
    await navigator.clipboard.writeText(shareUrl);
    return true;
  } catch (_error) {
    window.prompt("复制分享链接", shareUrl);
    return false;
  }
}

function loadPosterImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("分享图片生成失败，请换一张作品图再试"));
    image.src = src;
  });
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const chars = Array.from(text || "");
  let line = "";
  let lineCount = 0;
  chars.forEach((char) => {
    const nextLine = `${line}${char}`;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      if (lineCount < maxLines) {
        ctx.fillText(line, x, y + lineCount * lineHeight);
      }
      line = char;
      lineCount += 1;
      return;
    }
    line = nextLine;
  });
  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
  }
}

function drawImageContain(ctx, image, x, y, width, height) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawSharePoster({ image, title, category, description }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f4ead8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(170, 61, 45, 0.08)";
  ctx.fillRect(58, 58, canvas.width - 116, canvas.height - 116);
  ctx.fillStyle = "#2c241c";
  ctx.fillRect(112, 140, 856, 872);
  ctx.fillStyle = "#fff8ec";
  ctx.fillRect(142, 170, 796, 812);
  ctx.fillStyle = "#19140f";
  ctx.fillRect(176, 204, 728, 744);
  drawImageContain(ctx, image, 176, 204, 728, 744);

  ctx.fillStyle = "#241f1a";
  ctx.textAlign = "center";
  ctx.font = '72px "STXingkai", "KaiTi", serif';
  drawWrappedText(ctx, title || "墨舞丹青", 540, 1110, 820, 82, 2);
  ctx.fillStyle = "#685b4b";
  ctx.font = '34px "STXingkai", "KaiTi", serif';
  ctx.fillText(category || "国画作品", 540, 1268);
  ctx.font = '26px "KaiTi", serif';
  drawWrappedText(ctx, description || "一幅收于墨舞丹青的作品", 540, 1322, 760, 34, 2);
  ctx.fillStyle = "#aa3d2d";
  ctx.font = '30px "STXingkai", "KaiTi", serif';
  ctx.fillText("墨舞丹青", 540, 1384);

  return canvas;
}

async function generateSharePoster() {
  if (!shareState.posterImageUrl) {
    throw new Error("这幅作品暂时没有可生成分享图的图片");
  }
  const image = await loadPosterImage(shareState.posterImageUrl);
  const canvas = drawSharePoster({
    image,
    title: shareState.title,
    category: shareState.category,
    description: shareState.description,
  });
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("分享图片生成失败"));
      }
    }, "image/png", 0.95);
  });
  if (shareState.posterObjectUrl) {
    URL.revokeObjectURL(shareState.posterObjectUrl);
  }
  shareState.posterBlob = blob;
  shareState.posterObjectUrl = URL.createObjectURL(blob);
  sharePosterPreview.src = shareState.posterObjectUrl;
  sharePosterPreview.classList.remove("hidden");
  shareDownloadLink.href = shareState.posterObjectUrl;
  shareDownloadLink.classList.remove("hidden");
  shareSystemBtn.disabled = false;
  return blob;
}

async function sharePosterFile() {
  const blob = shareState.posterBlob || await generateSharePoster();
  const file = new File([blob], `${shareState.title || "墨舞丹青"}分享图.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({
      title: shareState.title || "墨舞丹青",
      text: "分享一幅墨舞丹青作品",
      files: [file],
    });
    return true;
  }
  return false;
}

function openShareSheet({ title, category, description, shareUrl, posterImageUrl }) {
  if (shareState.posterObjectUrl) {
    URL.revokeObjectURL(shareState.posterObjectUrl);
  }
  shareState = {
    title: title || "",
    category: category || "",
    description: description || "",
    shareUrl,
    posterImageUrl: posterImageUrl || "",
    posterBlob: null,
    posterObjectUrl: "",
  };
  shareSheetWork.textContent = title ? `《${title}》` : "作品分享";
  shareLinkInput.value = shareUrl;
  shareOpenLink.href = shareUrl;
  sharePosterPreview.src = "";
  sharePosterPreview.classList.add("hidden");
  shareDownloadLink.href = "#";
  shareDownloadLink.classList.add("hidden");
  shareSystemBtn.disabled = true;
  shareSheet.classList.remove("hidden");
  document.body.classList.add("modal-open");
  shareLinkInput.focus();
  shareLinkInput.select();
}

function closeShareSheet() {
  shareSheet.classList.add("hidden");
  shareLinkInput.value = "";
  shareOpenLink.href = "#";
  if (shareState.posterObjectUrl) {
    URL.revokeObjectURL(shareState.posterObjectUrl);
  }
  shareState = {
    title: "",
    category: "",
    description: "",
    shareUrl: "",
    posterImageUrl: "",
    posterBlob: null,
    posterObjectUrl: "",
  };
  if (lightbox.classList.contains("hidden")) {
    document.body.classList.remove("modal-open");
  }
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

function tagsToInputValue(tags) {
  return Array.isArray(tags) ? tags.join(" ") : "";
}

function renderTagStrip({ container, tags, selectedTag, onSelect }) {
  if (!container) {
    return;
  }
  container.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `tag-pill${selectedTag ? "" : " active"}`;
  allButton.textContent = "全部标签";
  allButton.addEventListener("click", () => onSelect(""));
  container.appendChild(allButton);

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-pill${tag === selectedTag ? " active" : ""}`;
    button.textContent = tag;
    button.addEventListener("click", () => onSelect(tag));
    container.appendChild(button);
  });
}

function renderCardTags({ container, tags, keyword, onSelect }) {
  if (!container) {
    return;
  }
  const normalizedTags = Array.isArray(tags) ? tags : [];
  container.innerHTML = "";
  container.classList.toggle("hidden", normalizedTags.length === 0);

  normalizedTags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-pill card-tag";
    setHighlightedText(button, tag, keyword);
    button.addEventListener("click", () => onSelect(tag));
    container.appendChild(button);
  });
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

function moveAttachmentIndex(currentIndex, total, delta) {
  if (!total) {
    return 0;
  }
  return (currentIndex + delta + total) % total;
}

function updateAttachmentNavigation({ attachments, selectedIndex, prevBtn, nextBtn, statusEl }) {
  const hasMultiple = attachments.length > 1;
  prevBtn.classList.toggle("hidden", !hasMultiple);
  nextBtn.classList.toggle("hidden", !hasMultiple);
  statusEl.classList.toggle("hidden", !attachments.length);
  statusEl.textContent = attachments.length ? `${selectedIndex + 1} / ${attachments.length}` : "";
}

function bindAttachmentGesture({ shellEl, attachments, getSelectedIndex, onChange }) {
  let pointerId = null;
  let startX = 0;
  let startY = 0;

  shellEl.addEventListener("pointerdown", (event) => {
    if (attachments.length <= 1 || !event.isPrimary) {
      return;
    }
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
  });

  shellEl.addEventListener("pointerup", (event) => {
    if (attachments.length <= 1 || !event.isPrimary || pointerId !== event.pointerId) {
      return;
    }
    pointerId = null;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }
    shellEl.dataset.ignorePreviewClickUntil = String(Date.now() + 400);
    const nextIndex = moveAttachmentIndex(getSelectedIndex(), attachments.length, deltaX < 0 ? 1 : -1);
    onChange(nextIndex);
  });

  shellEl.addEventListener("pointercancel", () => {
    pointerId = null;
  });
}

function bindLightboxGesture() {
  let pointerId = null;
  let startX = 0;
  let startY = 0;

  lightboxContent.addEventListener("pointerdown", (event) => {
    if (lightboxState.attachments.length <= 1 || !event.isPrimary) {
      return;
    }
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
  });

  lightboxContent.addEventListener("pointerup", (event) => {
    if (lightboxState.attachments.length <= 1 || !event.isPrimary || pointerId !== event.pointerId) {
      return;
    }
    pointerId = null;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }
    showLightboxAttachment(deltaX < 0 ? 1 : -1);
  });

  lightboxContent.addEventListener("pointercancel", () => {
    pointerId = null;
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
  if (paintingState.selectedTag) {
    params.set("tag", paintingState.selectedTag);
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
  form.elements.tags.value = tagsToInputValue(item.tags);
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
    const prevAttachmentBtn = fragment.querySelector(".attachment-prev");
    const nextAttachmentBtn = fragment.querySelector(".attachment-next");
    const attachmentStatusEl = fragment.querySelector(".painting-status");
    const previewImageEl = fragment.querySelector(".painting-preview-image");
    const previewVideoEl = fragment.querySelector(".painting-preview-video");
    const tipEl = fragment.querySelector(".painting-tip");
    const attachmentsEl = fragment.querySelector(".painting-attachments");
    const titleEl = fragment.querySelector(".painting-title");
    const metaEl = fragment.querySelector(".meta");
    const descEl = fragment.querySelector(".description");
    const tagsEl = fragment.querySelector(".painting-tags");
    const shareBtn = fragment.querySelector(".share-btn");
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
    renderCardTags({
      container: tagsEl,
      tags: item.tags,
      keyword,
      onSelect: async (tag) => {
        paintingState.selectedTag = tag;
        paintingState.page = 1;
        renderPaintingTagStrip();
        await loadPaintings();
      },
    });

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
      updateAttachmentNavigation({
        attachments,
        selectedIndex,
        prevBtn: prevAttachmentBtn,
        nextBtn: nextAttachmentBtn,
        statusEl: attachmentStatusEl,
      });
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
            await Promise.all([loadPaintingCategories(), loadPaintingTags(), loadPaintings()]);
            await refreshMembershipSummary();
          } catch (error) {
            setMessage(messageEl, error.message, true);
          }
        },
      });
    };

    renderCurrentAttachment();

    prevAttachmentBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedIndex = moveAttachmentIndex(selectedIndex, attachments.length, -1);
      renderCurrentAttachment();
    });

    nextAttachmentBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedIndex = moveAttachmentIndex(selectedIndex, attachments.length, 1);
      renderCurrentAttachment();
    });

    bindAttachmentGesture({
      shellEl,
      attachments,
      getSelectedIndex: () => selectedIndex,
      onChange: (nextIndex) => {
        selectedIndex = nextIndex;
        renderCurrentAttachment();
      },
    });

    shellEl.addEventListener("click", () => {
      if (Number(shellEl.dataset.ignorePreviewClickUntil || 0) > Date.now()) {
        return;
      }
      if (!attachments[selectedIndex]) {
        return;
      }
      openLightbox({
        attachments,
        index: selectedIndex,
        title: item.title,
        category: item.category,
      });
    });

    shellEl.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        selectedIndex = moveAttachmentIndex(selectedIndex, attachments.length, -1);
        renderCurrentAttachment();
        return;
      }
      if (event.key === "ArrowRight") {
        selectedIndex = moveAttachmentIndex(selectedIndex, attachments.length, 1);
        renderCurrentAttachment();
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      if (!attachments[selectedIndex]) {
        return;
      }
      event.preventDefault();
      openLightbox({
        attachments,
        index: selectedIndex,
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

    shareBtn.addEventListener("click", async () => {
      try {
        const payload = await fetchJson(`/api/paintings/${item.id}/share`, { method: "POST" });
        const posterShareUrl = new URL(`${payload.url}?poster=1`, window.location.origin).href;
        window.location.href = posterShareUrl;
      } catch (error) {
        setMessage(messageEl, error.message, true);
      }
    });

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
        tags: editForm.elements.tags.value,
      };
      const editFiles = Array.from(editForm.elements.image.files || []);
      const editLimitMessage = paintingImageLimitMessage(editFiles);
      if (editLimitMessage) {
        setMessage(messageEl, editLimitMessage, true);
        return;
      }

      try {
        await fetchJson(`/api/paintings/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (editFiles.length) {
          const editFormData = new FormData();
          editFiles.forEach((file) => {
            editFormData.append("image", file);
          });
          await fetchJson(`/api/paintings/${item.id}/attachments`, {
            method: "POST",
            body: editFormData,
          });
        }
        setMessage(messageEl, editFiles.length ? "作品已更新，附件已追加" : "作品已更新");
        editForm.classList.add("hidden");
        resetFilePickers(editForm);
        await Promise.all([loadPaintingCategories(), loadPaintingTags(), loadPaintings()]);
        await refreshMembershipSummary();
      } catch (error) {
        setMessage(messageEl, friendlyErrorMessage(error.message), true);
      }
    });

    appendForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const files = Array.from(appendForm.elements.image.files || []);
      if (!files.length) {
        return;
      }
      const appendLimitMessage = paintingImageLimitMessage(files);
      if (appendLimitMessage) {
        setMessage(messageEl, appendLimitMessage, true);
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
        await Promise.all([loadPaintingCategories(), loadPaintingTags(), loadPaintings()]);
        await refreshMembershipSummary();
      } catch (error) {
        setMessage(messageEl, friendlyErrorMessage(error.message), true);
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
        await Promise.all([loadPaintingCategories(), loadPaintingTags(), loadPaintings()]);
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

function renderPaintingTagStrip() {
  renderTagStrip({
    container: paintingTagStrip,
    tags: paintingState.tags,
    selectedTag: paintingState.selectedTag,
    onSelect: async (tag) => {
      paintingState.selectedTag = tag;
      paintingState.page = 1;
      renderPaintingTagStrip();
      await loadPaintings();
    },
  });
}

async function loadPaintingTags() {
  paintingState.tags = await fetchJson("/api/tags/paintings");
  renderPaintingTagStrip();
}

async function loadPaintings({ resetPage = false } = {}) {
  if (resetPage) {
    paintingState.page = 1;
  }
  const url = buildPaintingQuery();
  applyListPayload(paintingState, await fetchJson(url));
  renderPaintings();
  if (currentUser) {
    renderCurrentUser(currentUser);
  }
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
  if (materialState.selectedTag) {
    params.set("tag", materialState.selectedTag);
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
  form.elements.tags.value = tagsToInputValue(item.tags);
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
    const prevAttachmentBtn = fragment.querySelector(".attachment-prev");
    const nextAttachmentBtn = fragment.querySelector(".attachment-next");
    const attachmentStatusEl = fragment.querySelector(".material-status");
    const previewImageEl = fragment.querySelector(".material-preview-image");
    const previewVideoEl = fragment.querySelector(".material-preview-video");
    const tipEl = fragment.querySelector(".material-tip");
    const attachmentsEl = fragment.querySelector(".material-attachments");
    const titleEl = fragment.querySelector(".material-title");
    const metaEl = fragment.querySelector(".material-meta");
    const descEl = fragment.querySelector(".material-description");
    const tagsEl = fragment.querySelector(".material-tags");
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
    renderCardTags({
      container: tagsEl,
      tags: item.tags,
      keyword,
      onSelect: async (tag) => {
        materialState.selectedTag = tag;
        materialState.page = 1;
        renderMaterialTagStrip();
        await loadMaterials();
      },
    });

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
      updateAttachmentNavigation({
        attachments,
        selectedIndex,
        prevBtn: prevAttachmentBtn,
        nextBtn: nextAttachmentBtn,
        statusEl: attachmentStatusEl,
      });
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
            await Promise.all([loadMaterialCategories(), loadMaterialTags(), loadMaterials()]);
            await refreshMembershipSummary();
          } catch (error) {
            setMessage(materialMessageEl, error.message, true);
          }
        },
      });
    };

    renderCurrentAttachment();

    prevAttachmentBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedIndex = moveAttachmentIndex(selectedIndex, attachments.length, -1);
      renderCurrentAttachment();
    });

    nextAttachmentBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedIndex = moveAttachmentIndex(selectedIndex, attachments.length, 1);
      renderCurrentAttachment();
    });

    bindAttachmentGesture({
      shellEl,
      attachments,
      getSelectedIndex: () => selectedIndex,
      onChange: (nextIndex) => {
        selectedIndex = nextIndex;
        renderCurrentAttachment();
      },
    });

    shellEl.addEventListener("click", () => {
      if (Number(shellEl.dataset.ignorePreviewClickUntil || 0) > Date.now()) {
        return;
      }
      if (!attachments[selectedIndex]) {
        return;
      }
      openLightbox({
        attachments,
        index: selectedIndex,
        title: item.title,
        category: item.category,
      });
    });

    shellEl.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        selectedIndex = moveAttachmentIndex(selectedIndex, attachments.length, -1);
        renderCurrentAttachment();
        return;
      }
      if (event.key === "ArrowRight") {
        selectedIndex = moveAttachmentIndex(selectedIndex, attachments.length, 1);
        renderCurrentAttachment();
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      if (!attachments[selectedIndex]) {
        return;
      }
      event.preventDefault();
      openLightbox({
        attachments,
        index: selectedIndex,
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
        tags: editForm.elements.tags.value,
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
        await Promise.all([loadMaterialCategories(), loadMaterialTags(), loadMaterials()]);
        await refreshMembershipSummary();
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
        await Promise.all([loadMaterialCategories(), loadMaterialTags(), loadMaterials()]);
        await refreshMembershipSummary();
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
        await Promise.all([loadMaterialCategories(), loadMaterialTags(), loadMaterials()]);
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

function renderMaterialTagStrip() {
  renderTagStrip({
    container: materialTagStrip,
    tags: materialState.tags,
    selectedTag: materialState.selectedTag,
    onSelect: async (tag) => {
      materialState.selectedTag = tag;
      materialState.page = 1;
      renderMaterialTagStrip();
      await loadMaterials();
    },
  });
}

async function loadMaterialTags() {
  materialState.tags = await fetchJson("/api/tags/materials");
  renderMaterialTagStrip();
}

async function loadMaterials({ resetPage = false } = {}) {
  if (resetPage) {
    materialState.page = 1;
  }
  const url = buildMaterialQuery();
  applyListPayload(materialState, await fetchJson(url));
  renderMaterials();
  if (currentUser) {
    renderCurrentUser(currentUser);
  }
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
    const username = registerForm.elements.username.value.trim();
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
    loginForm.elements.username.value = username || payload.user.username || "";
    loginForm.elements.password.value = "";
    showLoginView("注册成功，请登录");
  } catch (error) {
    setMessage(authMessage, error.message, true);
  }
});

showRegisterBtn.addEventListener("click", () => {
  showRegisterView();
});

showLoginBtn.addEventListener("click", () => {
  showLoginView();
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

if (adminUsersRefresh) {
  adminUsersRefresh.addEventListener("click", async () => {
    await loadAdminUsers();
  });
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tabTarget);
  });
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);
  const imageLimitMessage = paintingImageLimitMessage(Array.from(uploadForm.elements.image.files || []));
  if (imageLimitMessage) {
    setUploadMessage(imageLimitMessage, true);
    return;
  }
  formData.delete("tags");
  formData.append("tags", uploadForm.elements.tags.value.trim());

  try {
    await fetchJson("/api/paintings", {
      method: "POST",
      body: formData,
    });
    uploadForm.reset();
    resetFilePickers(uploadForm);
    setUploadMessage("作品已收入册");
    await Promise.all([loadPaintingCategories(), loadPaintingTags(), loadPaintings({ resetPage: true })]);
    await refreshMembershipSummary();
  } catch (error) {
    setUploadMessage(friendlyErrorMessage(error.message), true);
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
  paintingState.selectedTag = "";
  renderPaintingTagStrip();
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
  formData.delete("tags");
  formData.append("tags", materialUploadForm.elements.tags.value.trim());

  try {
    await fetchJson("/api/materials", {
      method: "POST",
      body: formData,
    });
    materialUploadForm.reset();
    resetFilePickers(materialUploadForm);
    setMessage(materialMessageEl, "素材已收入库");
    await Promise.all([loadMaterialCategories(), loadMaterialTags(), loadMaterials({ resetPage: true })]);
    await refreshMembershipSummary();
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
  materialState.selectedTag = "";
  renderMaterialTagStrip();
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

lightboxPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  showLightboxAttachment(-1);
});

lightboxNext.addEventListener("click", (event) => {
  event.stopPropagation();
  showLightboxAttachment(1);
});

shareSheetClose.addEventListener("click", () => {
  closeShareSheet();
});

shareCopyBtn.addEventListener("click", async () => {
  const shareUrl = shareLinkInput.value.trim();
  if (!shareUrl) {
    return;
  }
  const copied = await copyShareUrl(shareUrl);
  shareCopyBtn.textContent = copied ? "已复制" : "复制链接";
  setTimeout(() => {
    shareCopyBtn.textContent = "复制链接";
  }, 1600);
});

sharePosterBtn.addEventListener("click", async () => {
  sharePosterBtn.disabled = true;
  sharePosterBtn.textContent = "生成中...";
  try {
    await generateSharePoster();
    setMessage(messageEl, "分享图片已生成，可长按保存或点“分享图片”");
  } catch (error) {
    setMessage(messageEl, error.message, true);
  } finally {
    sharePosterBtn.disabled = false;
    sharePosterBtn.textContent = "生成分享图片";
  }
});

shareSystemBtn.addEventListener("click", async () => {
  try {
    const shared = await sharePosterFile();
    if (!shared) {
      setMessage(messageEl, "当前浏览器不支持直接分享图片，请长按预览图保存后发朋友圈", true);
    }
  } catch (error) {
    setMessage(messageEl, error.message, true);
  }
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

shareSheet.addEventListener("click", (event) => {
  if (event.target === shareSheet) {
    closeShareSheet();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!lightbox.classList.contains("hidden")) {
      closeLightbox();
    }
    if (!shareSheet.classList.contains("hidden")) {
      closeShareSheet();
    }
    return;
  }
  if (lightbox.classList.contains("hidden")) {
    return;
  }
  if (event.key === "ArrowLeft") {
    showLightboxAttachment(-1);
    return;
  }
  if (event.key === "ArrowRight") {
    showLightboxAttachment(1);
  }
});

bindLightboxGesture();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

(async () => {
  bindFilePickers();
  registerServiceWorker();
  await initializeAuth();
})();
