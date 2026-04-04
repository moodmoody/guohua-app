const uploadForm = document.getElementById("upload-form");
const filterCategory = document.getElementById("filter-category");
const searchInput = document.getElementById("search-input");
const paintingsRoot = document.getElementById("paintings");
const messageEl = document.getElementById("message");
const template = document.getElementById("painting-template");

let state = {
  paintings: [],
};

function formatTime(iso) {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#8b1d1d" : "#7a6f63";
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload;
}

function renderCategories(categories) {
  filterCategory.innerHTML = `<option value="">全部分类</option>`;
  categories.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    filterCategory.appendChild(option);
  });
}

function renderPaintings() {
  paintingsRoot.innerHTML = "";

  if (!state.paintings.length) {
    paintingsRoot.innerHTML = `<p>暂无作品，先上传一幅吧。</p>`;
    return;
  }

  state.paintings.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".card");
    const imageEl = fragment.querySelector(".painting-image");
    const titleEl = fragment.querySelector(".painting-title");
    const metaEl = fragment.querySelector(".meta");
    const descEl = fragment.querySelector(".description");
    const commentList = fragment.querySelector(".comment-list");
    const commentForm = fragment.querySelector(".comment-form");

    imageEl.src = item.imageUrl;
    imageEl.alt = item.title;
    titleEl.textContent = item.title;
    metaEl.textContent = `${item.category} · 创建于 ${formatTime(item.createdAt)}`;
    descEl.textContent = item.description || "暂无简介";

    if (!item.comments.length) {
      commentList.innerHTML = `<li>暂无评论</li>`;
    } else {
      item.comments
        .slice()
        .sort((a, b) => b.id - a.id)
        .forEach((comment) => {
          const li = document.createElement("li");
          li.textContent = `${comment.content}（${formatTime(comment.createdAt)}）`;
          commentList.appendChild(li);
        });
    }

    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = commentForm.elements.comment;
      const content = input.value.trim();
      if (!content) return;

      try {
        await fetchJson(`/api/paintings/${item.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        input.value = "";
        setMessage("评论已添加");
        await loadPaintings();
      } catch (error) {
        setMessage(error.message, true);
      }
    });

    card.dataset.id = String(item.id);
    paintingsRoot.appendChild(fragment);
  });
}

async function loadCategories() {
  const categories = await fetchJson("/api/categories");
  const previous = filterCategory.value;
  renderCategories(categories);
  if (previous && categories.includes(previous)) {
    filterCategory.value = previous;
  }
}

async function loadPaintings() {
  const params = new URLSearchParams();
  const category = filterCategory.value.trim();
  const q = searchInput.value.trim();
  if (category) params.set("category", category);
  if (q) params.set("q", q);

  const query = params.toString();
  const url = query ? `/api/paintings?${query}` : "/api/paintings";
  state.paintings = await fetchJson(url);
  renderPaintings();
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);

  try {
    await fetchJson("/api/paintings", {
      method: "POST",
      body: formData,
    });
    uploadForm.reset();
    setMessage("上传成功");
    await Promise.all([loadCategories(), loadPaintings()]);
  } catch (error) {
    setMessage(error.message, true);
  }
});

filterCategory.addEventListener("change", async () => {
  try {
    await loadPaintings();
  } catch (error) {
    setMessage(error.message, true);
  }
});

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    try {
      await loadPaintings();
    } catch (error) {
      setMessage(error.message, true);
    }
  }, 250);
});

(async () => {
  try {
    await Promise.all([loadCategories(), loadPaintings()]);
  } catch (error) {
    setMessage(error.message, true);
  }
})();
