# MLT 产品文档与原型

本仓库包含两个独立产品的 PRD、HTML 阅读页与可交互原型，文档互不覆盖。

## 产品目录

| 产品 | 文档目录 | PRD | HTML 阅读页 | 原型 |
|------|----------|-----|-------------|------|
| **模力通** | [`docs/molitong/`](docs/molitong/) | [`PRD.md`](docs/molitong/PRD.md) | [`PRD.html`](docs/molitong/PRD.html) | [`index.html`](docs/molitong/index.html) |
| **主题相册** | [`docs/theme-album/`](docs/theme-album/) | [`PRD.md`](docs/theme-album/PRD.md) | [`PRD.html`](docs/theme-album/PRD.html) | [`index.html`](docs/theme-album/index.html) |

> 仓库根目录的 `PRD.md`、`PRD.html`、`index.html` 为 **模力通** 的快捷入口（与 `docs/molitong/` 保持同步），便于沿用原有打开方式。

---

## 模力通

双模式办公写作智能体：写作 / 深度研究 / AI PPT，含多智能体任务流与对话页原型。

- **用户说明**：见 [`docs/molitong/README.md`](docs/molitong/README.md)
- **打开原型**：双击 [`docs/molitong/index.html`](docs/molitong/index.html) 或根目录 [`index.html`](index.html)
- **阅读 PRD**：打开 [`docs/molitong/PRD.html`](docs/molitong/PRD.html)

---

## 主题相册

本地上传照片收纳、主题文件夹、明信片收纳册与手账式电子相册编辑。

- **用户指南**：见 [`docs/theme-album/README.md`](docs/theme-album/README.md)
- **打开原型**：双击 [`docs/theme-album/index.html`](docs/theme-album/index.html)
- **阅读 PRD**：打开 [`docs/theme-album/PRD.html`](docs/theme-album/PRD.html)

---

## 文档同步

各产品 PRD 独立维护，请使用对应命令同步 HTML 阅读页：

```bash
# 模力通 PRD（同时更新 docs/molitong/ 与根目录 PRD 文件）
npm run sync-prd:molitong

# 主题相册 PRD
npm run sync-prd:theme-album

# 同步全部
npm run sync-prd
```

**编辑约定**

- 模力通：只改 `docs/molitong/PRD.md`，再执行 `sync-prd:molitong`
- 主题相册：只改 `docs/theme-album/PRD.md`；若改 `index.html`，同步更新 PRD §7.6 修订记录后执行 `sync-prd:theme-album`
