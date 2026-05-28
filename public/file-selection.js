(function (root) {
  function removeFileAt(files, index) {
    const list = Array.from(files || []);
    if (index < 0 || index >= list.length) {
      return list;
    }
    return list.filter((_file, fileIndex) => fileIndex !== index);
  }

  const api = { removeFileAt };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.FileSelection = api;
})(typeof window !== "undefined" ? window : globalThis);
