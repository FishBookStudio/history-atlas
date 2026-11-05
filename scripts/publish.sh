#!/usr/bin/env bash
# 一键重新发布「史迹 · 历史时间轴」到 GitHub Pages
# 用法：bash scripts/publish.sh
# 说明：发布的是 dist/ 里的构建产物 -> gh-pages 分支。
#       改了 data 之后先跑 python3 scripts/build_data.py 再跑本脚本。
set -euo pipefail

REPO_SLUG="FishBookStudio/history-atlas"
PAGES_URL="https://fishbookstudio.github.io/history-atlas/"

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# 1) 校验构建产物完整（需要 node）
if command -v node >/dev/null 2>&1; then
  echo "==> 运行内容校验"
  node scripts/verify.mjs
else
  echo "!! 未找到 node，跳过 verify.mjs"
fi

# 2) 把 dist/ 内容发到 gh-pages
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -a dist/. "$TMP"/
touch "$TMP/.nojekyll"

git -C "$TMP" init -q -b gh-pages
git -C "$TMP" config user.name "$(git -C "$ROOT" config user.name || echo FishBookStudio)"
git -C "$TMP" config user.email "$(git -C "$ROOT" config user.email || echo 1031500172@qq.com)"
git -C "$TMP" add -A

if git -C "$TMP" diff --cached --quiet; then
  echo "==> dist/ 与已发布版本一致，无需重新发布"
  exit 0
fi

git -C "$TMP" commit -q -m "Publish site $(date '+%Y-%m-%d %H:%M')"
git -C "$TMP" remote add origin "git@github.com:${REPO_SLUG}.git" 2>/dev/null \
  || git -C "$TMP" remote add origin "https://github.com/${REPO_SLUG}.git"
git -C "$TMP" push -q --force origin gh-pages

echo "==> 已推送 gh-pages，1~2 分钟后生效：$PAGES_URL"
