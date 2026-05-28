const test = require("node:test");
const assert = require("node:assert/strict");

const { removeFileAt } = require("../public/file-selection");

test("removeFileAt removes the selected file and preserves order", () => {
  const files = [
    { name: "shan-shui.png" },
    { name: "hua-niao.png" },
    { name: "ren-wu.png" },
  ];

  const nextFiles = removeFileAt(files, 1);

  assert.deepEqual(
    nextFiles.map((file) => file.name),
    ["shan-shui.png", "ren-wu.png"]
  );
});

test("removeFileAt ignores indexes outside the selected file list", () => {
  const files = [{ name: "only.png" }];

  assert.deepEqual(removeFileAt(files, -1), files);
  assert.deepEqual(removeFileAt(files, 3), files);
});
