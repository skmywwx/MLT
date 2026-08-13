/**
 * 模力通办公写作 Agent — 交互模式工作流模拟
 * 基于 PRD 深度研究任务流：需求理解 → 任务规划 → 资料检索 → 分析归纳 → 内容撰写 → 质量校验 → 最终交付
 */
(function () {
  "use strict";

  const AGENTS = {
    planner: { name: "统筹专家", emoji: "👨🏻‍💼", tag: "任务规划" },
    search: { name: "检索专家", emoji: "🧑🏻‍💻", tag: "信息收集" },
    reader: { name: "文献阅读师", emoji: "🧑🏻‍🏫", tag: "资料阅读" },
    writer: { name: "写作达人", emoji: "👩🏻", tag: "内容撰写" },
    editor: { name: "资深编辑", emoji: "👩🏻‍💼", tag: "质量校验" },
  };

  const TODO_ITEMS = [
    { id: "outline", title: "创建写作大纲", weight: 1 },
    { id: "research", title: "资料收集", weight: 1.5 },
    { id: "analyze", title: "分析归纳", weight: 1 },
    { id: "write", title: "分章撰写", weight: 2 },
    { id: "review", title: "三审三校", weight: 1 },
    { id: "deliver", title: "最终定稿交付", weight: 0.5 },
  ];

  const DEMO_FILES = [
    { name: "20260105 周报.docx", type: "doc", size: "128 KB" },
    { name: "测试文档01.pdf", type: "pdf", size: "2.1 MB" },
  ];

  const OUTPUT_FILES = [
    { name: "工作总结分析报告（初稿）.docx", type: "doc", size: "856 KB", date: "2026-02-10" },
    { name: "工作总结分析报告（校对版）.docx", type: "doc", size: "862 KB", date: "2026-02-10" },
    { name: "工作总结分析报告（最终结果）.docx", type: "doc", size: "871 KB", date: "2026-02-10" },
    { name: "第一章-报告引言.md", type: "md", size: "12 KB", date: "2026-02-10" },
    { name: "资料摘要卡片.pdf", type: "pdf", size: "234 KB", date: "2026-02-10" },
    { name: "成本统计图表.png", type: "img", size: "89 KB", date: "2026-02-09" },
  ];

  const SUGGESTED_QUESTIONS = [
    "这份报告的核心结论在不同部门间是否存在差异？",
    "当前方案最大的执行风险是什么？",
    "如何把研究结果转化为下季度行动计划？",
  ];

  let running = false;
  let abortToken = 0;
  let currentTodoIndex = 0;
  let progressPercent = 0;

  const els = {};

  function init() {
    els.homeView = document.getElementById("homeView");
    els.workflowView = document.getElementById("workflowView");
    els.workflowChat = document.getElementById("workflowChat");
    els.workflowStatusBar = document.getElementById("workflowStatusBar");
    els.workflowTodo = document.getElementById("workflowTodo");
    els.workflowTodoList = document.getElementById("workflowTodoList");
    els.workflowTodoCount = document.getElementById("workflowTodoCount");
    els.backHome = document.getElementById("backHome");
    els.filesModal = document.getElementById("filesModal");
    els.feedbackModal = document.getElementById("feedbackModal");

    if (!els.workflowView) return;

    els.backHome?.addEventListener("click", stopAndGoHome);
    document.getElementById("closeFilesModal")?.addEventListener("click", () => toggleModal("filesModal", false));
    document.getElementById("closeFeedbackModal")?.addEventListener("click", () => toggleModal("feedbackModal", false));
    document.getElementById("submitFeedback")?.addEventListener("click", () => {
      toggleModal("feedbackModal", false);
      window.showToast?.("感谢反馈，我们会持续改进");
    });
    document.querySelectorAll("[data-feedback-chip]").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll("[data-feedback-chip]").forEach((c) => c.classList.remove("is-selected"));
        chip.classList.add("is-selected");
      });
    });

    window.startWorkflowSimulation = startWorkflowSimulation;
  }

  function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.toggle("hidden", !show);
    modal.classList.toggle("flex", show);
  }

  function stopAndGoHome() {
    abortToken++;
    running = false;
    els.workflowView.classList.add("hidden");
    els.homeView?.classList.remove("hidden");
    document.getElementById("benefits")?.classList.remove("hidden");
  }

  window.MLTWorkflowSandbox = {
    start(promptText, mode) {
      return startWorkflowSimulation(promptText || "请将以上文档内容整合，并基于我上传的文件生成一份工作总结分析报告", mode || "交互模式");
    },
    stop: stopAndGoHome,
    isRunning: () => running,
    modes: ["快速模式", "交互模式"],
    demoPrompt: "请将以上文档内容整合，并基于我上传的文件生成一份工作总结分析报告",
  };

  function sleep(ms, token) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (token !== undefined) {
        const check = setInterval(() => {
          if (token !== abortToken) {
            clearTimeout(timer);
            clearInterval(check);
            reject(new Error("aborted"));
          }
        }, 50);
        setTimeout(() => clearInterval(check), ms + 100);
      }
    });
  }

  function scrollChat() {
    requestAnimationFrame(() => {
      els.workflowChat.scrollTop = els.workflowChat.scrollHeight;
    });
  }

  function updateStatusBar(stage, owner, completed, total, percent) {
    els.workflowStatusBar.innerHTML = `
      <div class="flex items-center justify-between gap-3 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="shrink-0 px-2 py-0.5 rounded bg-[#eaf8fd] text-[#00a0df] text-[10px] font-semibold">交互模式</span>
          <span class="truncate text-[11px] text-[#444]">${stage}</span>
        </div>
        <div class="shrink-0 text-[10px] text-[#888]">${completed}/${total} · ${owner}</div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1 h-[6px] rounded-full bg-[#ececef] overflow-hidden" role="progressbar"
          aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
          <div class="wf-progress-fill h-full rounded-full bg-[#5B5FE5] transition-all duration-500" style="width:${percent}%"></div>
        </div>
        <span class="text-[10px] font-semibold text-[#5B5FE5] w-[32px] text-right">${percent}%</span>
      </div>`;
  }

  function renderTodoList() {
    els.workflowTodoList.innerHTML = TODO_ITEMS.map((item, i) => {
      let statusClass = "text-[#aaa]";
      let icon = '<span class="w-[14px] h-[14px] rounded-full border border-[#ddd]"></span>';
      if (i < currentTodoIndex) {
        statusClass = "text-[#35a92f]";
        icon = '<i data-lucide="circle-check" class="w-[14px] h-[14px] text-[#35a92f]"></i>';
      } else if (i === currentTodoIndex) {
        statusClass = "text-[#00a0df] font-medium";
        icon = '<span class="w-[14px] h-[14px] rounded-full border-2 border-[#00a0df] border-t-transparent animate-spin"></span>';
      }
      return `<li class="flex items-center gap-2 py-1.5 ${statusClass}">
        ${icon}<span class="text-[11px]">${item.title}</span>
      </li>`;
    }).join("");
    els.workflowTodoCount.textContent = `${Math.min(currentTodoIndex + 1, TODO_ITEMS.length)}/${TODO_ITEMS.length}`;
    window.lucide?.createIcons();
  }

  function setProgress(completed, stage, owner) {
    const weights = TODO_ITEMS.reduce((s, t) => s + t.weight, 0);
    let done = 0;
    for (let i = 0; i < completed; i++) done += TODO_ITEMS[i]?.weight || 0;
    progressPercent = Math.min(100, Math.round((done / weights) * 100));
    updateStatusBar(stage, owner, completed, TODO_ITEMS.length, progressPercent);
    currentTodoIndex = completed;
    renderTodoList();
  }

  function appendMessage(html) {
    const wrap = document.createElement("div");
    wrap.className = "wf-msg animate-[wfIn_.35s_ease]";
    wrap.innerHTML = html;
    els.workflowChat.appendChild(wrap);
    scrollChat();
    window.lucide?.createIcons();
    return wrap;
  }

  function agentBadge(agent) {
    return `<div class="flex items-center gap-2 mb-2">
      <span class="w-[26px] h-[26px] rounded-md bg-[#eaf8fd] grid place-items-center text-[14px]">${agent.emoji}</span>
      <span class="text-[11px] font-semibold text-[#333]">${agent.name}</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded bg-[#f0f0f2] text-[#888]">${agent.tag}</span>
    </div>`;
  }

  function userMessage(text, files) {
    const fileHtml = files?.length
      ? `<div class="flex flex-wrap gap-2 mt-2">${files.map((f) =>
          `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-[#e4e6ea] text-[10px]">
            <i data-lucide="${f.type === "pdf" ? "file-text" : "file"}" class="w-3 h-3 text-[#00a0df]"></i>${f.name}
          </span>`).join("")}</div>`
      : "";
    return appendMessage(`
      <div class="flex justify-end mb-4">
        <div class="max-w-[78%] rounded-[12px] rounded-tr-[4px] bg-[#5B5FE5] text-white px-3.5 py-2.5 text-[12px] leading-relaxed">
          ${text}${fileHtml}
        </div>
      </div>`);
  }

  function agentMessage(agent, content) {
    return appendMessage(`
      <div class="mb-4 max-w-[92%]">
        ${agentBadge(agent)}
        <div class="rounded-[12px] rounded-tl-[4px] border border-[#ececef] bg-[#fafafa] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#444]">${content}</div>
      </div>`);
  }

  function statusLine(text, type) {
    const colors = { info: "#00a0df", warn: "#e95f32", error: "#d14848", ok: "#35a92f" };
    const color = colors[type] || colors.info;
    return appendMessage(`
      <div class="flex items-center gap-2 mb-3 pl-1 text-[11px]" style="color:${color}">
        <span class="w-[6px] h-[6px] rounded-full animate-pulse" style="background:${color}"></span>
        <span>${text}</span>
      </div>`);
  }

  function toolLog(items) {
    return appendMessage(`
      <div class="mb-4 ml-2 border-l-2 border-[#e8e8eb] pl-3 space-y-1.5">
        ${items.map((item) => {
          const iconMap = { read: "file-search", edit: "file-pen", shell: "terminal", search: "search", chart: "bar-chart-3" };
          return `<div class="flex items-start gap-2 text-[10px] text-[#777]">
            <i data-lucide="${iconMap[item.type] || "circle"}" class="w-3 h-3 mt-0.5 shrink-0"></i>
            <span>${item.text}${item.detail ? ` <span class="text-[#aaa]">${item.detail}</span>` : ""}</span>
            ${item.action ? `<button class="ml-auto text-[#00a0df] hover:underline shrink-0">${item.action}</button>` : ""}
          </div>`;
        }).join("")}
      </div>`);
  }

  function searchResults() {
    const cards = [
      { title: "成本核算方法 - 百度百科", snippet: "成本核算是指对生产费用进行归集和分配...", date: "2025-12" },
      { title: "收入成本工作内容分析 - 知乎", snippet: "企业收入与成本的匹配原则及常见核算误区...", date: "2026-01" },
      { title: "部门工作总结写作规范", snippet: "总结报告应包含工作回顾、数据分析与改进建议...", date: "2025-11" },
    ];
    return appendMessage(`
      <div class="mb-4">
        ${agentBadge(AGENTS.search)}
        <div class="grid gap-2">
          ${cards.map((c) => `
            <div class="rounded-lg border border-[#e8e8eb] bg-white p-2.5 hover:border-[#91dafa] transition">
              <div class="text-[11px] font-medium text-[#333]">${c.title}</div>
              <div class="text-[10px] text-[#888] mt-1 line-clamp-2">${c.snippet}</div>
              <div class="text-[9px] text-[#bbb] mt-1">${c.date}</div>
            </div>`).join("")}
          <div class="text-[10px] text-[#888]">共检索到 <strong class="text-[#00a0df]">120</strong> 条相关资料，已筛选 12 条高相关来源</div>
        </div>
      </div>`);
  }

  function outlineCard(onConfirm) {
    const wrap = appendMessage(`
      <div class="mb-4">
        ${agentBadge(AGENTS.writer)}
        <div class="rounded-lg border border-[#e8e8eb] bg-white p-3">
          <div class="text-[11px] font-semibold mb-2">报告大纲</div>
          <ol class="text-[11px] text-[#555] space-y-1.5 list-decimal pl-4">
            <li>报告引言</li>
            <li>核心需求分析</li>
            <li>工作内容拆解与实施路径</li>
            <li>成本统计与预算分析</li>
            <li>综合结论与建议</li>
          </ol>
          <button id="confirmOutline" class="mt-3 h-[30px] px-4 rounded-lg bg-[#5B5FE5] text-white text-[11px] font-medium hover:bg-[#494dcc]">
            使用此大纲
          </button>
        </div>
      </div>`);
    wrap.querySelector("#confirmOutline")?.addEventListener("click", onConfirm);
    return wrap;
  }

  function fileCard(name, label) {
    return appendMessage(`
      <div class="mb-3 inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[#e4e6ea] bg-white hover:border-[#91dafa] cursor-pointer wf-file-card">
        <span class="w-[32px] h-[32px] rounded bg-[#eaf8fd] grid place-items-center">
          <i data-lucide="file-text" class="w-4 h-4 text-[#00a0df]"></i>
        </span>
        <div>
          <div class="text-[11px] font-medium text-[#333]">${name}</div>
          <div class="text-[9px] text-[#aaa]">${label || "Word 文档"}</div>
        </div>
        <i data-lucide="download" class="w-3.5 h-3.5 text-[#bbb] ml-2"></i>
      </div>`);
  }

  function workflowCarousel() {
    const steps = [
      { agent: AGENTS.planner, label: "任务规划" },
      { agent: AGENTS.search, label: "资料检索" },
      { agent: AGENTS.writer, label: "分章撰写" },
      { agent: AGENTS.editor, label: "三审三校" },
      { agent: AGENTS.planner, label: "最终交付" },
    ];
    return appendMessage(`
      <div class="mb-4 overflow-x-auto">
        <div class="flex gap-2 min-w-max pb-1">
          ${steps.map((s, i) => `
            <div class="flex items-center gap-1.5">
              <div class="w-[100px] rounded-lg border border-[#e8e8eb] bg-white p-2 text-center ${i === steps.length - 1 ? "border-[#5B5FE5] bg-[#f4f4ff]" : ""}">
                <div class="text-[16px]">${s.agent.emoji}</div>
                <div class="text-[9px] font-medium mt-1">${s.agent.name}</div>
                <div class="text-[8px] text-[#aaa]">${s.label}</div>
              </div>
              ${i < steps.length - 1 ? '<i data-lucide="chevron-right" class="w-3 h-3 text-[#ccc]"></i>' : ""}
            </div>`).join("")}
        </div>
      </div>`);
  }

  function ratingAndQuestions() {
    const wrap = appendMessage(`
      <div class="mb-6 rounded-xl border border-[#ececef] bg-[#fafafa] p-4">
        <div class="text-[11px] font-medium mb-2">您对本次结果满意吗？</div>
        <div class="flex gap-1 mb-4 wf-stars">
          ${[1, 2, 3, 4, 5].map((n) =>
            `<button data-star="${n}" class="text-[18px] text-[#ddd] hover:text-[#ffb800] transition">★</button>`).join("")}
        </div>
        <div class="text-[10px] text-[#888] mb-2">你可能想问</div>
        <div class="space-y-1.5">
          ${SUGGESTED_QUESTIONS.map((q) =>
            `<button class="wf-followup w-full text-left px-3 py-2 rounded-lg border border-[#e8e8eb] bg-white text-[11px] text-[#555] hover:border-[#91dafa] hover:text-[#00a0df]">${q}</button>`).join("")}
        </div>
        <button id="openAllFiles" class="mt-3 h-[30px] px-3 rounded-lg border border-[#e4e6ea] text-[11px] text-[#555] hover:bg-white flex items-center gap-1.5">
          <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>打包下载任务中所有文件
        </button>
      </div>`);
    wrap.querySelectorAll("[data-star]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = +btn.dataset.star;
        wrap.querySelectorAll("[data-star]").forEach((b) => {
          b.style.color = +b.dataset.star <= val ? "#ffb800" : "#ddd";
        });
        if (val <= 3) toggleModal("feedbackModal", true);
        else window.showToast?.("感谢您的评价！");
      });
    });
    wrap.querySelector("#openAllFiles")?.addEventListener("click", () => showFilesModal());
    wrap.querySelectorAll(".wf-followup").forEach((btn) => {
      btn.addEventListener("click", () => window.showToast?.("已继承上下文：" + btn.textContent.slice(0, 20) + "..."));
    });
    return wrap;
  }

  function showFilesModal() {
    const body = document.getElementById("filesModalBody");
    if (!body) return;
    body.innerHTML = OUTPUT_FILES.map((f) => `
      <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f7f8f9] group">
        <span class="w-[32px] h-[32px] rounded bg-[#f0f7fb] grid place-items-center shrink-0">
          <i data-lucide="${f.type === "img" ? "image" : "file-text"}" class="w-4 h-4 text-[#00a0df]"></i>
        </span>
        <div class="flex-1 min-w-0">
          <div class="text-[12px] font-medium truncate">${f.name}</div>
          <div class="text-[10px] text-[#aaa]">${f.type.toUpperCase()} · ${f.size} · ${f.date}</div>
        </div>
        <button class="opacity-0 group-hover:opacity-100 text-[10px] text-[#00a0df] hover:underline">下载</button>
      </div>`).join("");
    window.lucide?.createIcons();
    toggleModal("filesModal", true);
  }

  async function runInteractiveFlow(promptText, token) {
    els.workflowChat.innerHTML = "";
    els.workflowTodo.classList.remove("hidden");
    currentTodoIndex = 0;
    progressPercent = 0;
    setProgress(0, "需求理解中", AGENTS.planner.name);

    const hasFiles = /整合|上传|文档|文件|报告/.test(promptText);
    const displayPrompt = promptText;
    const files = hasFiles ? DEMO_FILES : null;

    userMessage(displayPrompt, files);
    await sleep(600, token);

    if (hasFiles) {
      agentMessage(AGENTS.planner,
        "已收到您上传的 <strong>2</strong> 份文件。该任务涉及跨文档分析与报告生成，系统推荐切换至 <strong>交互模式</strong>，以便您确认任务计划与阶段结果。");
      const modeCard = appendMessage(`
        <div class="mb-4 flex gap-2">
          <button class="wf-mode-btn is-active h-[32px] px-4 rounded-lg bg-[#5B5FE5] text-white text-[11px] font-medium">切换至交互模式</button>
          <button class="wf-mode-btn h-[32px] px-4 rounded-lg border border-[#e4e6ea] text-[11px] text-[#666]">继续使用快速模式</button>
        </div>`);
      await sleep(1200, token);
      modeCard.querySelector(".is-active")?.classList.add("ring-2", "ring-[#5B5FE5]/30");
    }

    statusLine("写作技能已加载", "ok");
    agentMessage(AGENTS.planner, "当前负责人：<strong>统筹专家</strong>。正在理解需求并规划任务…");
    await sleep(800, token);

    setProgress(0, "任务规划中", AGENTS.planner.name);
    agentMessage(AGENTS.planner,
      "已将您的任务拆分为 <strong>6</strong> 个步骤，涉及统筹、检索、写作与编辑四个智能体协作。请查看右侧待办事项跟踪进度。");
    await sleep(700, token);

    setProgress(1, "资料检索中 · 12%", AGENTS.search.name);
    statusLine("正在搜索：成本核算方法", "info");
    toolLog([
      { type: "read", text: "正在阅读文件…", detail: "20260105 周报.docx" },
      { type: "read", text: "正在阅读文件…", detail: "测试文档01.pdf" },
    ]);
    await sleep(900, token);
    statusLine("正在搜索：收入 成本 工作内容", "info");
    toolLog([{ type: "search", text: "调用搜索工具", action: "查看" }]);
    await sleep(800, token);

    setProgress(2, "资料检索中 · 45%", AGENTS.search.name);
    searchResults();
    agentMessage(AGENTS.reader, "已从上传文件与外部来源中提取 <strong>12</strong> 条有效证据，生成资料摘要卡片。");
    await sleep(700, token);

    setProgress(2, "分析归纳中 · 55%", AGENTS.writer.name);
    agentMessage(AGENTS.writer, "基于资料分析，正在生成报告大纲…");
    await sleep(600, token);

    setProgress(3, "等待确认大纲", AGENTS.writer.name);
    let outlineConfirmed = false;
    outlineCard(() => {
      outlineConfirmed = true;
      window.showToast?.("已确认大纲，开始分章撰写");
    });
    await sleep(1500, token);
    if (!outlineConfirmed) {
      document.getElementById("confirmOutline")?.click();
    }
    await sleep(400, token);

    setProgress(4, "分章撰写中 · 68%", AGENTS.writer.name);
    statusLine("开始撰写第一章：报告引言", "info");
    fileCard("第一章-报告引言.md", "Markdown · 12 KB");
    await sleep(700, token);
    statusLine("第一章完成，开始撰写第二章：核心需求分析", "info");
    await sleep(600, token);
    statusLine("章节撰写完成，正在合并文档…", "info");
    fileCard("工作总结分析报告（初稿）.docx", "Word · 856 KB");
    await sleep(700, token);

    setProgress(5, "三审三校中 · 85%", AGENTS.editor.name);
    agentMessage(AGENTS.editor, "报告已生成，现进入 <strong>三审三校</strong> 流程：");
    const reviewWrap = appendMessage(`
      <div class="mb-4 ml-8 space-y-1.5 text-[11px]">
        <div class="flex items-center gap-2"><i data-lucide="loader" class="w-3 h-3 animate-spin text-[#00a0df]"></i>文字与标点校对 — 执行中</div>
        <div class="flex items-center gap-2"><i data-lucide="loader" class="w-3 h-3 animate-spin text-[#00a0df]"></i>知识准确性校验 — 执行中</div>
        <div class="flex items-center gap-2"><i data-lucide="loader" class="w-3 h-3 animate-spin text-[#00a0df]"></i>内容导向风险审查 — 执行中</div>
      </div>`);
    window.lucide?.createIcons();
    await sleep(1200, token);
    reviewWrap.innerHTML = `
      <div class="mb-4 ml-8 space-y-1.5 text-[11px]">
        <div class="flex items-center gap-2 text-[#35a92f]"><i data-lucide="circle-check" class="w-3 h-3"></i>文字与标点校对 — 修正 15 处</div>
        <div class="flex items-center gap-2 text-[#35a92f]"><i data-lucide="circle-check" class="w-3 h-3"></i>知识准确性校验 — 修正 1 处</div>
        <div class="flex items-center gap-2 text-[#35a92f]"><i data-lucide="circle-check" class="w-3 h-3"></i>内容导向风险审查 — 规避 5 处风险</div>
      </div>`;
    window.lucide?.createIcons();
    fileCard("工作总结分析报告（校对版）.docx", "Word · 862 KB");
    await sleep(600, token);

    setProgress(6, "最终定稿交付 · 100%", AGENTS.planner.name);
    agentMessage(AGENTS.planner, "全部任务已完成！以下是最终结果：");
    fileCard("工作总结分析报告（最终结果）.docx", "Word · 871 KB");
    workflowCarousel();
    ratingAndQuestions();
    scrollChat();
  }

  async function runQuickFlow(promptText, token) {
    els.workflowChat.innerHTML = "";
    els.workflowTodo.classList.add("hidden");
    updateStatusBar("快速生成中", AGENTS.writer.name, 0, 1, 15);

    userMessage(promptText);
    await sleep(500, token);
    statusLine("正在解析任务目标…", "info");
    await sleep(600, token);
    updateStatusBar("内容撰写中", AGENTS.writer.name, 0, 1, 55);
    toolLog([{ type: "edit", text: "正在生成文档…" }]);
    await sleep(900, token);
    updateStatusBar("质量校验中", AGENTS.editor.name, 0, 1, 85);
    await sleep(600, token);
    updateStatusBar("交付完成", AGENTS.writer.name, 1, 1, 100);
    agentMessage(AGENTS.writer, "已根据您的要求快速生成结果：");
    fileCard("生成结果.docx", "Word · 420 KB");
    ratingAndQuestions();
  }

  async function startWorkflowSimulation(promptText, mode) {
    if (running) abortToken++;
    const token = ++abortToken;
    running = true;

    els.homeView?.classList.add("hidden");
    els.workflowView?.classList.remove("hidden");
    document.getElementById("benefits")?.classList.add("hidden");

    try {
      if (mode === "交互模式") {
        await runInteractiveFlow(promptText, token);
      } else {
        await runQuickFlow(promptText, token);
      }
    } catch (e) {
      if (e.message !== "aborted") throw e;
    } finally {
      if (token === abortToken) running = false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
