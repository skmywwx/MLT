# MLT · 模力通原型

模力通办公写作 Agent 单文件 HTML 原型与 PRD 文档。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `index.html` | 办公写作 Agent 完整原型（桌面启动 → 登录 → 首页 → 智能体工作区任务流模拟，**全部逻辑内嵌在本文件**） |
| `PRD.md` | 产品需求文档（编辑源） |
| `PRD.html` | PRD 双栏阅读页 |
| `scripts/sync-prd-html.py` | PRD.md → PRD.html 同步脚本 |

## 如何测试完整流程

### 最简单：直接打开文件

1. 双击 `index.html`（或拖入 Chrome / Edge）
2. 桌面点 **模力通** → 登录（任意用户名/密码）
3. 侧边栏 **办公写作Agent** → 输入需求或点 **「沙盒演示」**
4. 选择 **交互模式** → 发送 ↑

无需启动本地服务器、无需额外 JS 文件。

### 可选：本地 HTTP 服务

```bash
python3 -m http.server 8080
# 访问 http://localhost:8080/index.html
```

### 快捷入口

| 方式 | 说明 |
| --- | --- |
| **沙盒演示** 按钮 | 自动填充 demo 文案并进入交互模式流程 |
| URL 参数 | `index.html?skipLogin=1&autoDemo=interactive` 跳过登录直达流程 |
| 最近对话 | 点击左侧历史条目可重新播放 |
| 控制台 | `MLTWorkflowSandbox.start("你的需求", "交互模式")` |

## 原型内置流程（对齐 PRD）

需求理解 → 任务规划 → 资料检索 → 分析归纳 → 分章撰写 → 三审三校 → 最终交付

- **交互模式**：完整 6 步待办 + 多智能体消息 + 进度条
- **快速模式**：精简路径，直接生成 docx
