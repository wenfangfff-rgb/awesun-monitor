const accentColors = ["#1f8a70", "#d85d3f", "#2388a8", "#c28a12", "#6c5aa8", "#8a6d3b", "#bd3d35", "#2f6f9f"];

const defaultCompetitors = [
  {
    id: "teamviewer",
    name: "TeamViewer",
    website: "https://www.teamviewer.com/",
    storeLink: "https://apps.apple.com/",
    market: "Global",
    platforms: ["Web", "App Store", "Google Play", "Ads", "Social"],
    priority: "High",
    notes: "企业远程支持与跨设备访问的强势品牌。",
  },
  {
    id: "anydesk",
    name: "AnyDesk",
    website: "https://anydesk.com/",
    storeLink: "https://play.google.com/",
    market: "Global",
    platforms: ["Web", "App Store", "Google Play", "Ads", "Social"],
    priority: "High",
    notes: "强调轻量、低延迟和快速连接。",
  },
  {
    id: "splashtop",
    name: "Splashtop",
    website: "https://www.splashtop.com/",
    storeLink: "https://apps.apple.com/",
    market: "US",
    platforms: ["Web", "App Store", "Google Play", "Ads", "Social"],
    priority: "High",
    notes: "教育、企业 IT 与 MSP 场景较强。",
  },
  {
    id: "remotepc",
    name: "RemotePC",
    website: "https://www.remotepc.com/",
    storeLink: "https://play.google.com/",
    market: "US",
    platforms: ["Web", "App Store", "Google Play", "Ads"],
    priority: "Medium",
    notes: "价格型定位明显，常用折扣促销拉动转化。",
  },
  {
    id: "rustdesk",
    name: "RustDesk",
    website: "https://rustdesk.com/",
    storeLink: "https://play.google.com/",
    market: "Global",
    platforms: ["Web", "Google Play", "Social"],
    priority: "Medium",
    notes: "开源、自托管和开发者社区心智突出。",
  },
  {
    id: "chrome-remote-desktop",
    name: "Chrome Remote Desktop",
    website: "https://remotedesktop.google.com/",
    storeLink: "https://chromewebstore.google.com/",
    market: "Global",
    platforms: ["Web", "Social"],
    priority: "Medium",
    notes: "免费与 Google 生态入口带来高自然认知。",
  },
  {
    id: "zoho-assist",
    name: "Zoho Assist",
    website: "https://www.zoho.com/assist/",
    storeLink: "https://apps.apple.com/",
    market: "US",
    platforms: ["Web", "App Store", "Google Play", "Ads", "Social"],
    priority: "Medium",
    notes: "远程支持与 ITSM 工具链联动清晰。",
  },
  {
    id: "deskin",
    name: "DeskIn",
    website: "https://www.deskin.io/",
    storeLink: "https://play.google.com/store/apps/details?id=com.zuler.deskin",
    market: "TW",
    platforms: ["Web", "App Store", "Google Play", "Ads", "Social"],
    priority: "Medium",
    notes: "面向个人和团队的远程桌面工具，台湾市场纳入重点观察。",
  },
];

const metricSeed = {
  teamviewer: { rank: 3, delta: 2, rating: 4.7, reviews: 842, keywords: 214, ads: 86, social: 73, sentiment: 78 },
  anydesk: { rank: 5, delta: -1, rating: 4.5, reviews: 624, keywords: 179, ads: 72, social: 64, sentiment: 71 },
  splashtop: { rank: 8, delta: 4, rating: 4.6, reviews: 386, keywords: 136, ads: 68, social: 52, sentiment: 74 },
  remotepc: { rank: 11, delta: 6, rating: 4.3, reviews: 212, keywords: 92, ads: 61, social: 37, sentiment: 66 },
  rustdesk: { rank: 16, delta: 3, rating: 4.2, reviews: 188, keywords: 81, ads: 20, social: 58, sentiment: 70 },
  "chrome-remote-desktop": { rank: 2, delta: 0, rating: 4.1, reviews: 510, keywords: 123, ads: 8, social: 45, sentiment: 63 },
  "zoho-assist": { rank: 10, delta: -2, rating: 4.4, reviews: 254, keywords: 118, ads: 55, social: 41, sentiment: 69 },
  deskin: { rank: 14, delta: 1, rating: 4.5, reviews: 96, keywords: 74, ads: 34, social: 28, sentiment: 72 },
};

const baseSignals = [
  {
    id: "s1",
    competitorId: "remotepc",
    type: "促销活动",
    source: "Website",
    impact: "High",
    title: "RemotePC 推出年度折扣落地页",
    summary: "首页 CTA 从免费试用切换为限时折扣，企业版价格锚点更突出。",
    recommendation: "Awesun 可测试价格对比型落地页，并把跨平台连接稳定性作为差异化证明。",
    time: "12 分钟前",
  },
  {
    id: "s2",
    competitorId: "splashtop",
    type: "SEO内容",
    source: "Blog",
    impact: "Medium",
    title: "Splashtop 更新 remote support for MSP 主题内容",
    summary: "新增 MSP 场景关键词组合，强化 IT 服务商的批量设备管理诉求。",
    recommendation: "补齐 MSP、unattended access、secure remote support 三组内容集群。",
    time: "38 分钟前",
  },
  {
    id: "s3",
    competitorId: "teamviewer",
    type: "应用商店",
    source: "App Store",
    impact: "Medium",
    title: "TeamViewer 商店关键词排名上升",
    summary: "remote access 与 remote control app 两个关键词排名进入前 3。",
    recommendation: "检查 Awesun 商店标题、副标题和截图文案是否覆盖同类高意图词。",
    time: "1 小时前",
  },
  {
    id: "s4",
    competitorId: "anydesk",
    type: "广告素材",
    source: "YouTube",
    impact: "High",
    title: "AnyDesk 强化低延迟远程桌面素材",
    summary: "素材主张集中在 fast remote desktop、low latency、work from anywhere。",
    recommendation: "Awesun 投放可加入性能实测画面，避免只讲功能清单。",
    time: "2 小时前",
  },
  {
    id: "s5",
    competitorId: "rustdesk",
    type: "社媒/PR",
    source: "X",
    impact: "Low",
    title: "RustDesk 社区讨论自托管部署",
    summary: "开发者用户围绕自托管、安全和开源透明度展开讨论。",
    recommendation: "沉淀安全、隐私、权限控制内容，覆盖技术型用户疑虑。",
    time: "3 小时前",
  },
];

const keywordInsights = [
  { keyword: "remote desktop software", awesunRank: 18, competitorRank: 3, intent: "购买比较", opportunity: "High" },
  { keyword: "free remote access app", awesunRank: 12, competitorRank: 2, intent: "免费试用", opportunity: "High" },
  { keyword: "unattended remote access", awesunRank: 21, competitorRank: 6, intent: "企业功能", opportunity: "Medium" },
  { keyword: "remote support for business", awesunRank: 16, competitorRank: 5, intent: "B2B采购", opportunity: "Medium" },
  { keyword: "low latency remote desktop", awesunRank: 25, competitorRank: 7, intent: "性能诉求", opportunity: "High" },
];

const creativeThemes = [
  { competitorId: "anydesk", title: "Fast Remote Access", channel: "YouTube", tags: ["速度", "低延迟", "移动办公"], copy: "用短视频演示跨设备连接速度，CTA 指向免费试用。" },
  { competitorId: "remotepc", title: "Save on RemotePC", channel: "Google Ads", tags: ["折扣", "价格", "年度套餐"], copy: "突出限时折扣和多设备授权，落地页承接价格比较。" },
  { competitorId: "zoho-assist", title: "Remote Support for IT", channel: "LinkedIn", tags: ["IT支持", "企业", "工单"], copy: "面向 IT 管理者，强调远程排障与团队协作。" },
  { competitorId: "splashtop", title: "Secure Access for Teams", channel: "Meta", tags: ["安全", "团队", "合规"], copy: "素材围绕安全远控和团队访问权限展开。" },
];

const insightCards = [
  {
    title: "内容机会",
    level: "High",
    body: "围绕 remote desktop software、free remote access app、low latency remote desktop 建立对比型内容页，承接高意图自然搜索。",
  },
  {
    title: "投放机会",
    level: "Medium",
    body: "竞品素材集中在速度、价格和企业支持。Awesun 可以用性能演示+安全权限作为组合卖点测试。",
  },
  {
    title: "商店优化",
    level: "High",
    body: "应用商店截图应优先展示跨端连接、远程文件传输、无人值守访问和安全授权，减少泛功能描述。",
  },
];

const sentimentPainPoints = ["连接不稳定", "价格上涨", "移动端体验", "权限复杂", "延迟", "客服响应", "安全担忧"];
const tabs = ["概览", "推广", "排名", "SEO", "广告", "舆情"];
const platformOptions = ["Web", "App Store", "Google Play", "Ads", "Social"];

let liveMetricSeed = { ...metricSeed };
let liveSignals = [...baseSignals];
let liveKeywordInsights = [...keywordInsights];
let liveCreativeThemes = [...creativeThemes];
let liveInsightCards = [...insightCards];
let liveSentimentPainPoints = [...sentimentPainPoints];
let liveSerpChanges = [];
let liveContentChanges = [];

const state = {
  competitors: loadCompetitors(),
  selectedId: null,
  market: "US",
  platforms: new Set(platformOptions),
  drawerType: "competitor",
  drawerSignal: null,
  activeTab: "概览",
  tick: 0,
  dataGeneratedAt: null,
  dataSource: "demo",
};

const els = {
  competitorList: document.querySelector("#competitorList"),
  competitorCount: document.querySelector("#competitorCount"),
  platformFilters: document.querySelector("#platformFilters"),
  metricGrid: document.querySelector("#metricGrid"),
  signalTimeline: document.querySelector("#signalTimeline"),
  rankingTable: document.querySelector("#rankingTable"),
  keywordGrid: document.querySelector("#keywordGrid"),
  creativeWall: document.querySelector("#creativeWall"),
  serpChangeList: document.querySelector("#serpChangeList"),
  contentChangeList: document.querySelector("#contentChangeList"),
  insightGrid: document.querySelector("#insightGrid"),
  sentimentBox: document.querySelector("#sentimentBox"),
  lastUpdated: document.querySelector("#lastUpdated"),
  drawer: document.querySelector("#detailDrawer"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  drawerKicker: document.querySelector("#drawerKicker"),
  drawerTitle: document.querySelector("#drawerTitle"),
  drawerBody: document.querySelector("#drawerBody"),
  tabBar: document.querySelector("#tabBar"),
  modalBackdrop: document.querySelector("#modalBackdrop"),
  form: document.querySelector("#competitorForm"),
  modalTitle: document.querySelector("#modalTitle"),
  toast: document.querySelector("#toast"),
};

function loadCompetitors() {
  const saved = localStorage.getItem("awesun-competitors");
  if (!saved) return defaultCompetitors;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultCompetitors;
  } catch {
    return defaultCompetitors;
  }
}

function saveCompetitors() {
  localStorage.setItem("awesun-competitors", JSON.stringify(state.competitors));
}

async function loadDailyData() {
  if (window.location.protocol === "file:") return;

  try {
    const response = await fetch("data/latest.json", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    applyDailyData(data);
    showToast("已加载每日汇总数据。");
  } catch (error) {
    console.info("Daily data is unavailable, using demo data.", error);
  }
}

function applyDailyData(data) {
  if (Array.isArray(data.competitors) && data.competitors.length && !localStorage.getItem("awesun-competitors")) {
    state.competitors = data.competitors.map(normalizeCompetitor);
  }

  liveMetricSeed = normalizeMetrics(data.metrics);
  liveSignals = Array.isArray(data.signals) ? data.signals.map(normalizeSignal) : liveSignals;
  liveKeywordInsights = Array.isArray(data.keywordInsights) ? data.keywordInsights : liveKeywordInsights;
  liveCreativeThemes = Array.isArray(data.creativeThemes) ? data.creativeThemes : liveCreativeThemes;
  liveInsightCards = Array.isArray(data.insights) ? data.insights : liveInsightCards;
  liveSentimentPainPoints = Array.isArray(data.sentimentPainPoints) ? data.sentimentPainPoints : liveSentimentPainPoints;
  liveSerpChanges = Array.isArray(data.brandSerpChanges) ? data.brandSerpChanges : liveSerpChanges;
  liveContentChanges = Array.isArray(data.contentChanges) ? data.contentChanges : liveContentChanges;
  state.dataGeneratedAt = data.generatedAt || data.date || null;
  state.dataSource = data.source || "daily-json";
  render();
}

function normalizeCompetitor(competitor) {
  return {
    id: competitor.id || slugify(competitor.name),
    name: competitor.name || "Unknown",
    website: competitor.website || "",
    storeLink: competitor.storeLink || "",
    market: competitor.market || "Global",
    platforms: Array.isArray(competitor.platforms) && competitor.platforms.length ? competitor.platforms : ["Web"],
    priority: competitor.priority || "Medium",
    notes: competitor.notes || "",
  };
}

function normalizeMetrics(metrics) {
  if (Array.isArray(metrics)) {
    return metrics.reduce((acc, metric) => {
      if (metric.competitorId) acc[metric.competitorId] = metric;
      return acc;
    }, {});
  }
  if (metrics && typeof metrics === "object") return metrics;
  return liveMetricSeed;
}

function normalizeSignal(signal) {
  const sourceNote = signal.sourceNote || (signal.source === "Google Play" && !signal.url ? "来源：Google Play scraper，暂无直达链接" : "");
  const summary = signal.summary || "";
  return {
    id: signal.id || `signal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    competitorId: signal.competitorId,
    type: signal.type || "市场动作",
    source: signal.source || "Daily Collector",
    impact: signal.impact || "Medium",
    title: signal.title || "发现新的市场动作",
    summary: sourceNote && !summary.includes(sourceNote) ? `${summary}（${sourceNote}）` : summary,
    recommendation: signal.recommendation || "建议人工复核该变化，并判断是否需要跟进内容、商店或投放动作。",
    time: normalizeSignalTime(signal),
    detectedAt: signal.detectedAt || signal.publishedAt || "",
    sourceNote,
    url: signal.url || "",
  };
}

function metricFor(id, index = 0) {
  const base = liveMetricSeed[id] || {
    rank: 18 + index,
    delta: index % 2 ? -2 : 3,
    rating: 4.2,
    reviews: 120 + index * 24,
    keywords: 60 + index * 9,
    ads: 28 + index * 7,
    social: 32 + index * 5,
    sentiment: 65,
  };
  const wobble = ((state.tick + index) % 4) - 1;
  return {
    ...base,
    rank: Math.max(1, base.rank - wobble),
    delta: base.delta + (state.tick % 3 === 0 ? 1 : 0),
    ads: Math.min(100, base.ads + state.tick),
    social: Math.min(100, base.social + Math.floor(state.tick / 2)),
  };
}

function visibleCompetitors() {
  return state.competitors.filter((competitor) => {
    const marketMatch = state.market === "Global" || competitor.market === state.market || competitor.market === "Global";
    const platformMatch = competitor.platforms.some((platform) => state.platforms.has(platform));
    return marketMatch && platformMatch;
  });
}

function signalsForVisibleCompetitors() {
  const ids = new Set(visibleCompetitors().map((competitor) => competitor.id));
  return sortSignals(liveSignals.filter((signal) => ids.has(signal.competitorId) && signalFitsDisplayWindow(signal)));
}

function signalFitsDisplayWindow(signal) {
  if (signal.type === "口碑舆情") {
    return isRecentDate(signal.detectedAt || signal.time, 7);
  }
  return true;
}

function sortSignals(signals) {
  return [...signals].sort((a, b) => signalTimestamp(b) - signalTimestamp(a));
}

function signalTimestamp(signal) {
  const date = parseDateOnly(signal.detectedAt || signal.publishedAt || signal.time);
  return date ? date.getTime() : 0;
}

function getCompetitor(id) {
  return state.competitors.find((competitor) => competitor.id === id);
}

function accentFor(id) {
  const index = Math.max(0, state.competitors.findIndex((competitor) => competitor.id === id));
  return accentColors[index % accentColors.length];
}

function priorityText(priority) {
  return { High: "高", Medium: "中", Low: "低" }[priority] || priority;
}

function marketLabel(market) {
  return { US: "美国", TW: "台湾", Global: "全球" }[market] || market;
}

function impactClass(level) {
  return level === "High" ? "hot" : level === "Medium" ? "good" : "";
}

function render() {
  if (!state.selectedId && state.competitors.length) state.selectedId = state.competitors[0].id;
  if (state.selectedId && !getCompetitor(state.selectedId)) state.selectedId = state.competitors[0]?.id || null;

  renderPlatformFilters();
  renderCompetitors();
  renderMetrics();
  renderSignals();
  renderRankings();
  renderKeywords();
  renderCreatives();
  renderSerpChanges();
  renderContentChanges();
  renderInsights();
  renderSentiment();
  updateTimestamp();

  if (els.drawer.classList.contains("open")) renderDrawer();
}

function renderPlatformFilters() {
  els.platformFilters.innerHTML = platformOptions
    .map(
      (platform) => `
        <label class="filter-chip">
          <input type="checkbox" value="${platform}" ${state.platforms.has(platform) ? "checked" : ""}>
          <span>${platform}</span>
        </label>
      `,
    )
    .join("");
}

function renderCompetitors() {
  els.competitorCount.textContent = state.competitors.length;
  if (!state.competitors.length) {
    els.competitorList.innerHTML = `<div class="empty-state">暂无竞品，点击上方按钮添加。</div>`;
    return;
  }

  els.competitorList.innerHTML = state.competitors
    .map((competitor) => {
      const active = competitor.id === state.selectedId ? "active" : "";
      return `
        <button class="competitor-item ${active}" style="--accent:${accentFor(competitor.id)}" data-id="${competitor.id}" type="button">
          <span class="competitor-item-header">
            <span class="competitor-name">${escapeHtml(competitor.name)}</span>
            <span class="priority">${priorityText(competitor.priority)}</span>
          </span>
          <span class="competitor-meta">
            <span>${marketLabel(competitor.market)}</span>
            <span>${competitor.platforms.slice(0, 2).join(" / ")}</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderMetrics() {
  const competitors = visibleCompetitors();
  const signals = signalsForVisibleCompetitors();
  const totalAds = competitors.reduce((sum, competitor, index) => sum + metricFor(competitor.id, index).ads, 0);
  const topMover = competitors.reduce(
    (best, competitor, index) => {
      const metric = metricFor(competitor.id, index);
      return Math.abs(metric.delta) > Math.abs(best.delta) ? { name: competitor.name, delta: metric.delta } : best;
    },
    { name: "--", delta: 0 },
  );
  const highKeywords = liveKeywordInsights.filter((item) => item.opportunity === "High").length;

  const metrics = [
    { label: "竞品活跃度", value: `${Math.round(totalAds / Math.max(1, competitors.length))}`, change: "广告/社媒综合指数", accent: "var(--green)" },
    { label: "排名最大波动", value: topMover.delta > 0 ? `+${topMover.delta}` : `${topMover.delta}`, change: topMover.name, accent: "var(--coral)" },
    { label: "SEO机会词", value: highKeywords, change: "高优先级内容缺口", accent: "var(--amber)" },
    { label: "本次采集动作", value: signals.length, change: "来自当前 daily JSON", accent: "var(--cyan)" },
  ];

  els.metricGrid.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric-card" style="--accent:${metric.accent}">
          <p class="metric-label">${metric.label}</p>
          <p class="metric-value">${metric.value}</p>
          <span class="metric-change">${metric.change}</span>
        </article>
      `,
    )
    .join("");
}

function renderSignals() {
  const signals = signalsForVisibleCompetitors();
  if (!signals.length) {
    els.signalTimeline.innerHTML = `<div class="empty-state">当前筛选下暂无推广动作。</div>`;
    return;
  }

  els.signalTimeline.innerHTML = signals
    .map((signal) => {
      const competitor = getCompetitor(signal.competitorId);
      return `
        <article class="signal-card" style="--accent:${accentFor(signal.competitorId)}">
          <span class="signal-dot"></span>
          <button type="button" data-signal-id="${signal.id}">
            <span class="signal-meta">
              <span>${signal.time}</span>
              <span>${competitor?.name || "Unknown"}</span>
              <span>${signal.source}</span>
              <span>${signal.impact}</span>
            </span>
            <p class="signal-title">${signal.title}</p>
            <p class="signal-summary">${signal.summary}</p>
            ${sourceUrlForSignal(signal) ? `<span class="source-link">查看来源</span>` : ""}
          </button>
        </article>
      `;
    })
    .join("");
}

function renderRankings() {
  const competitors = visibleCompetitors();
  if (!competitors.length) {
    els.rankingTable.innerHTML = `<div class="empty-state">暂无可展示排名。</div>`;
    return;
  }

  els.rankingTable.innerHTML = competitors
    .map((competitor, index) => {
      const metric = metricFor(competitor.id, index);
      const deltaClass = metric.delta >= 0 ? "up" : "down";
      const delta = metric.delta >= 0 ? `+${metric.delta}` : metric.delta;
      return `
        <div class="rank-row" style="--accent:${accentFor(competitor.id)}">
          <div class="rank-name"><span class="color-pin"></span><span>${escapeHtml(competitor.name)}</span></div>
          <div class="rank-value">#${metric.rank}</div>
          <div class="rank-delta ${deltaClass}">${delta}</div>
          <div class="bar" aria-label="关键词覆盖"><span style="--width:${Math.min(100, metric.keywords / 2.2)}%"></span></div>
        </div>
      `;
    })
    .join("");
}

function renderKeywords() {
  if (!liveKeywordInsights.length) {
    els.keywordGrid.innerHTML = `<div class="empty-state">今日暂无关键词数据。</div>`;
    return;
  }

  els.keywordGrid.innerHTML = liveKeywordInsights
    .map(
      (item) => `
        <article class="keyword-card">
          <div class="keyword-top">
            <span class="keyword-name">${item.keyword}</span>
            <span class="badge ${impactClass(item.opportunity)}">${item.opportunity}</span>
          </div>
          <div class="tiny-meta">
            <span>Awesun #${item.awesunRank}</span>
            <span>竞品最好 #${item.competitorRank}</span>
            <span>${item.intent}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderCreatives() {
  const visibleIds = new Set(visibleCompetitors().map((competitor) => competitor.id));
  const creatives = liveCreativeThemes.filter((theme) => visibleIds.has(theme.competitorId));
  if (!creatives.length) {
    els.creativeWall.innerHTML = `<div class="empty-state">当前筛选下暂无广告素材。</div>`;
    return;
  }

  els.creativeWall.innerHTML = creatives
    .map((theme) => {
      const competitor = getCompetitor(theme.competitorId);
      return `
        <article class="creative-card" style="--accent:${accentFor(theme.competitorId)}">
          <div class="creative-top">
            <span class="creative-title">${theme.title}</span>
            <span class="badge">${theme.channel}</span>
          </div>
          <p>${theme.copy}</p>
          <div class="creative-tags">
            <span class="badge">${competitor?.name || "Unknown"}</span>
            ${theme.tags.map((tag) => `<span class="badge">${tag}</span>`).join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSerpChanges() {
  const visibleIds = new Set(visibleCompetitors().map((competitor) => competitor.id));
  const changes = liveSerpChanges.filter((change) => visibleIds.has(change.competitorId)).slice(0, 8);
  if (!changes.length) {
    els.serpChangeList.innerHTML = `<div class="empty-state">当前筛选下暂无搜索结果变化。</div>`;
    return;
  }

  els.serpChangeList.innerHTML = changes
    .map((change) => {
      const position = `${change.previousPosition ?? "-"} → ${change.currentPosition ?? "-"}`;
      return `
        <article class="change-card">
          <div class="keyword-top">
            <span class="change-title">${changeTitle(change)}</span>
            <span class="badge ${impactClass(change.impact)}">${change.impact}</span>
          </div>
          <p>${change.keyword} · ${position} · ${change.domain || ""}</p>
          <div class="tiny-meta">
            <span>${marketLabel(change.market)}</span>
            <span>${change.competitorName || getCompetitor(change.competitorId)?.name || "Unknown"}</span>
            <span>${change.type}</span>
            ${change.url ? `<a class="detail-link" href="${change.url}" target="_blank" rel="noopener noreferrer">打开结果</a>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderContentChanges() {
  const visibleIds = new Set(visibleCompetitors().map((competitor) => competitor.id));
  const changes = liveContentChanges.filter((change) => visibleIds.has(change.competitorId));
  if (!changes.length) {
    els.contentChangeList.innerHTML = `<div class="empty-state">当前筛选下暂无内容发现。</div>`;
    return;
  }

  const suspectedNew = changes.filter((change) => contentChangeKind(change) === "suspectedNew").slice(0, 4);
  const firstSeen = changes.filter((change) => contentChangeKind(change) !== "suspectedNew").slice(0, 6);
  const renderGroup = (title, items, emptyText) => `
    <div class="content-group">
      <div class="tiny-meta content-group-title"><span>${title}</span></div>
      ${
        items.length
          ? items.map(renderContentCard).join("")
          : `<div class="empty-state compact-empty">${emptyText}</div>`
      }
    </div>
  `;

  els.contentChangeList.innerHTML = [
    renderGroup("疑似新发布内容", suspectedNew, "未识别到最近 7 天发布的内容。"),
    renderGroup("首次发现 / 监控基线", firstSeen, "暂无首次发现内容。"),
  ].join("");
}

function renderContentCard(change) {
  const ranked = change.rankedKeywords?.length ? `已进入 ${change.rankedKeywords.length} 个监控 SERP` : "暂未进入监控 SERP";
  const published = change.publishedDate ? `发布 ${formatDateOnly(change.publishedDate)}` : "未识别发布时间";
  const kind = contentChangeKind(change);
  const typeLabel = kind === "suspectedNew" ? "疑似新发布" : kind === "baseline" ? "监控基线" : "首次发现";
  const contentLink = change.url
    ? `<a class="detail-link" href="${change.url}" target="_blank" rel="noopener noreferrer">${change.url}</a>`
    : "";
  const sourceLink = change.sourceUrl
    ? `<a class="detail-link" href="${change.sourceUrl}" target="_blank" rel="noopener noreferrer">来源列表页</a>`
    : "";
  return `
    <article class="content-card">
      <div class="keyword-top">
        <span class="content-title">${change.title}</span>
        <span class="badge ${kind === "suspectedNew" ? "good" : ""}">${typeLabel}</span>
      </div>
      <p>${contentLink}</p>
      <div class="tiny-meta">
        <span>${change.competitorName}</span>
        <span>${marketLabel(change.market)}</span>
        <span>${change.sourceType}</span>
        <span>${published}</span>
        <span>${ranked}</span>
        ${sourceLink}
      </div>
    </article>
  `;
}

function contentChangeKind(change) {
  if (change.type === "suspected_new_content") return "suspectedNew";
  if (change.type === "baseline_content") return "baseline";
  if (change.type === "new_content" && !change.publishedDate) return "baseline";
  if (isRecentDate(change.publishedDate, 7)) return "suspectedNew";
  return "firstSeen";
}

function isRecentDate(value, days) {
  const date = parseDateOnly(value);
  if (!date) return false;
  const today = parseDateOnly(state.dataGeneratedAt) || new Date();
  const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.floor((todayUtc - dateUtc) / 86400000);
  return diffDays >= 0 && diffDays <= days;
}

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value) {
  const date = parseDateOnly(value);
  return date ? date.toLocaleDateString("zh-CN", { hour12: false }) : "";
}

function normalizeSignalTime(signal) {
  if (signal.time && signal.time !== "今日") return signal.time;
  const date = signal.publishedAt || signal.detectedAt;
  return formatDateOnly(date) || signal.time || "本次采集";
}

function renderInsights() {
  if (!liveInsightCards.length) {
    els.insightGrid.innerHTML = `<div class="empty-state">今日暂无自动洞察。</div>`;
    return;
  }

  els.insightGrid.innerHTML = liveInsightCards
    .map(
      (insight) => `
        <article class="insight-card">
          <header>
            <h4>${insight.title}</h4>
            <span class="badge ${impactClass(insight.level)}">${insight.level}</span>
          </header>
          <p>${insight.body}</p>
        </article>
      `,
    )
    .join("");
}

function changeTitle(change) {
  const labels = {
    baseline: "建立搜索基线",
    new: "新增搜索结果",
    gone: "搜索结果消失",
    up: "搜索排名上升",
    down: "搜索排名下降",
    title_changed: "搜索标题变化",
  };
  return `${labels[change.type] || "搜索变化"}：${change.title || change.url || ""}`;
}

function renderSentiment() {
  const competitors = visibleCompetitors();
  const avg = Math.round(
    competitors.reduce((sum, competitor, index) => sum + metricFor(competitor.id, index).sentiment, 0) / Math.max(1, competitors.length),
  );
  els.sentimentBox.innerHTML = `
    <div class="sentiment-row">
      <div>
        <p class="eyebrow">Positive Sentiment</p>
        <strong>${avg || 0}%</strong>
      </div>
      <span class="badge ${avg >= 70 ? "good" : "hot"}">${avg >= 70 ? "稳定" : "需关注"}</span>
    </div>
    <div class="bar"><span style="--width:${avg || 0}%; --accent:var(--green)"></span></div>
    <div class="word-cloud">
      ${liveSentimentPainPoints.map((word) => `<span>${word}</span>`).join("")}
    </div>
  `;
}

function renderDrawer() {
  if (state.drawerType === "signal") {
    renderSignalDrawer();
    return;
  }
  renderCompetitorDrawer();
}

function renderCompetitorDrawer() {
  const competitor = getCompetitor(state.selectedId);
  if (!competitor) {
    closeDrawer();
    return;
  }
  const metric = metricFor(competitor.id);
  els.drawerKicker.textContent = "Competitor";
  els.drawerTitle.textContent = competitor.name;
  renderTabs();

  const contentByTab = {
    概览: `
      <article class="detail-card"><h4>监控备注</h4><p>${escapeHtml(competitor.notes || "暂无备注。")}</p></article>
      <article class="detail-card"><h4>覆盖平台</h4><p>${competitor.platforms.join(" / ")}</p></article>
      <article class="detail-card"><h4>关键指标</h4><p>排名 #${metric.rank}，评分 ${metric.rating}，关键词覆盖 ${metric.keywords}，广告活跃度 ${metric.ads}。</p></article>
    `,
    推广: signalListForDrawer(competitor.id, "推广动作"),
    排名: `
      <article class="detail-card"><h4>商店排名</h4><p>当前排名 #${metric.rank}，近 24 小时变化 ${metric.delta >= 0 ? "+" : ""}${metric.delta}，评论量 ${metric.reviews}k。</p></article>
      <article class="detail-card"><h4>监控建议</h4><p>关注标题、截图首屏、评分波动和版本更新频率，记录排名异常时的促销或投放动作。</p></article>
    `,
    SEO: `
      <article class="detail-card"><h4>内容缺口</h4><p>重点比较 remote desktop software、unattended remote access、remote support for business 等高意图词。</p></article>
      <article class="detail-card"><h4>页面变化</h4><p>监控首页 H1、价格页、下载页、博客标题和 CTA 变化，识别竞品新的转化主张。</p></article>
    `,
    广告: creativeListForDrawer(competitor.id),
    舆情: `
      <article class="detail-card"><h4>情绪得分</h4><p>正向情绪约 ${metric.sentiment}%，主要负面点集中在连接稳定、价格、移动端体验和权限配置。</p></article>
      <article class="detail-card"><h4>Awesun 机会</h4><p>把稳定性、安全授权和客服响应做成明确证据，可用于商店截图、广告素材和对比页。</p></article>
    `,
  };

  els.drawerBody.innerHTML = `
    <div class="drawer-section">${contentByTab[state.activeTab]}</div>
    <div class="drawer-actions">
      <button class="ghost-button" type="button" data-edit-id="${competitor.id}">编辑竞品</button>
      <button class="danger-button" type="button" data-delete-id="${competitor.id}">删除竞品</button>
    </div>
  `;
}

function renderSignalDrawer() {
  const signal = state.drawerSignal;
  const competitor = getCompetitor(signal.competitorId);
  const sourceUrl = sourceUrlForSignal(signal);
  els.drawerKicker.textContent = `${signal.type} / ${signal.source}`;
  els.drawerTitle.textContent = signal.title;
  els.tabBar.innerHTML = "";
  els.drawerBody.innerHTML = `
    <div class="drawer-section">
      <article class="detail-card"><h4>来源竞品</h4><p>${competitor?.name || "Unknown"} · ${signal.time} · 影响等级 ${signal.impact}</p></article>
      <article class="detail-card"><h4>市场动作</h4><p>${signal.summary}</p></article>
      ${
        sourceUrl
          ? `<article class="detail-card"><h4>来源链接</h4><p><a class="detail-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceUrl}</a></p></article>`
          : ""
      }
      <article class="detail-card"><h4>建议动作</h4><p>${signal.recommendation}</p></article>
    </div>
  `;
}

function renderTabs() {
  els.tabBar.innerHTML = tabs
    .map(
      (tab) => `
        <button class="tab-button ${tab === state.activeTab ? "active" : ""}" type="button" data-tab="${tab}">${tab}</button>
      `,
    )
    .join("");
}

function signalListForDrawer(competitorId) {
  const signals = sortSignals(liveSignals.filter((signal) => signal.competitorId === competitorId && signalFitsDisplayWindow(signal)));
  if (!signals.length) return `<article class="detail-card"><h4>暂无推广动作</h4><p>当前模拟数据还没有记录该竞品的新动作。</p></article>`;
  return signals
    .map((signal) => {
      const sourceUrl = sourceUrlForSignal(signal);
      return `
        <article class="detail-card">
          <h4>${signal.title}</h4>
          <p class="tiny-meta"><span>${signal.time}</span><span>${signal.source}</span><span>${signal.impact}</span></p>
          <p>${signal.summary}</p>
          ${
            sourceUrl
              ? `<p><a class="detail-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">查看来源</a></p>`
              : signal.sourceNote
              ? `<p class="tiny-meta"><span>${signal.sourceNote}</span></p>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function creativeListForDrawer(competitorId) {
  const creatives = liveCreativeThemes.filter((theme) => theme.competitorId === competitorId);
  if (!creatives.length) return `<article class="detail-card"><h4>暂无广告素材</h4><p>当前模拟数据还没有记录该竞品的新素材。</p></article>`;
  return creatives
    .map(
      (theme) => `
        <article class="detail-card">
          <h4>${theme.title}</h4>
          <p>${theme.channel}：${theme.copy}</p>
        </article>
      `,
    )
    .join("");
}

function openDrawer(type = "competitor", payload = null) {
  state.drawerType = type;
  state.drawerSignal = payload;
  els.drawerBackdrop.hidden = false;
  els.drawer.classList.add("open");
  els.drawer.setAttribute("aria-hidden", "false");
  renderDrawer();
}

function closeDrawer() {
  els.drawer.classList.remove("open");
  els.drawer.setAttribute("aria-hidden", "true");
  els.drawerBackdrop.hidden = true;
}

function openModal(competitor = null) {
  els.form.reset();
  els.modalTitle.textContent = competitor ? "编辑竞品" : "添加竞品";
  document.querySelector("#competitorId").value = competitor?.id || "";
  document.querySelector("#nameInput").value = competitor?.name || "";
  document.querySelector("#websiteInput").value = competitor?.website || "";
  document.querySelector("#storeInput").value = competitor?.storeLink || "";
  document.querySelector("#marketInput").value = competitor?.market || "US";
  document.querySelector("#priorityInput").value = competitor?.priority || "High";
  document.querySelector("#notesInput").value = competitor?.notes || "";
  document.querySelectorAll('input[name="platforms"]').forEach((input) => {
    input.checked = competitor ? competitor.platforms.includes(input.value) : true;
  });
  els.modalBackdrop.hidden = false;
  document.querySelector("#nameInput").focus();
}

function closeModal() {
  els.modalBackdrop.hidden = true;
}

function handleFormSubmit(event) {
  event.preventDefault();
  const formData = new FormData(els.form);
  const id = formData.get("competitorId") || slugify(formData.get("name"));
  const platforms = formData.getAll("platforms");
  const competitor = {
    id,
    name: formData.get("name").trim(),
    website: formData.get("website").trim(),
    storeLink: formData.get("storeLink").trim(),
    market: formData.get("market"),
    priority: formData.get("priority"),
    platforms: platforms.length ? platforms : ["Web"],
    notes: formData.get("notes").trim(),
  };

  const existingIndex = state.competitors.findIndex((item) => item.id === id);
  if (existingIndex >= 0) state.competitors[existingIndex] = competitor;
  else state.competitors.push(competitor);

  state.selectedId = competitor.id;
  saveCompetitors();
  closeModal();
  render();
  openDrawer("competitor");
  showToast(existingIndex >= 0 ? "竞品信息已更新。" : "竞品已添加到监控列表。");
}

function deleteCompetitor(id) {
  const competitor = getCompetitor(id);
  if (!competitor) return;
  const ok = window.confirm(`确认删除 ${competitor.name}？`);
  if (!ok) return;
  state.competitors = state.competitors.filter((item) => item.id !== id);
  state.selectedId = state.competitors[0]?.id || null;
  saveCompetitors();
  closeDrawer();
  render();
  showToast("竞品已删除。");
}

function updateTimestamp() {
  if (state.dataGeneratedAt) {
    els.lastUpdated.textContent = new Date(state.dataGeneratedAt).toLocaleString("zh-CN", { hour12: false });
    return;
  }
  els.lastUpdated.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function slugify(value) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `competitor-${Date.now()}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sourceUrlForSignal(signal) {
  if (signal.url) return signal.url;
  const match = String(signal.summary || "").match(/https?:\/\/[^\s，。)）]+/);
  return match ? match[0] : "";
}

document.querySelector("#openAddModal").addEventListener("click", () => openModal());
document.querySelector("#closeModal").addEventListener("click", closeModal);
document.querySelector("#cancelModal").addEventListener("click", closeModal);
document.querySelector("#closeDrawer").addEventListener("click", closeDrawer);
document.querySelector("#drawerBackdrop").addEventListener("click", closeDrawer);
document.querySelector("#refreshSignals").addEventListener("click", () => {
  loadDailyData().then(() => {
    if (state.dataSource === "demo") showToast("当前使用演示数据，请先运行每日采集脚本。");
  });
});
document.querySelector("#exportReport").addEventListener("click", () => {
  showToast("周报已生成：包含排名波动、SEO机会词、推广动作与建议动作。");
});

document.querySelectorAll('input[name="market"]').forEach((input) => {
  input.addEventListener("change", (event) => {
    state.market = event.target.value;
    render();
  });
});

els.platformFilters.addEventListener("change", (event) => {
  if (!event.target.matches('input[type="checkbox"]')) return;
  if (event.target.checked) state.platforms.add(event.target.value);
  else state.platforms.delete(event.target.value);
  render();
});

els.competitorList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  state.selectedId = button.dataset.id;
  state.activeTab = "概览";
  render();
  openDrawer("competitor");
});

els.signalTimeline.addEventListener("click", (event) => {
  const button = event.target.closest("[data-signal-id]");
  if (!button) return;
  const signal = liveSignals.find((item) => item.id === button.dataset.signalId);
  if (signal) openDrawer("signal", signal);
});

els.tabBar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  state.activeTab = button.dataset.tab;
  renderDrawer();
});

els.drawerBody.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  const deleteButton = event.target.closest("[data-delete-id]");
  if (editButton) openModal(getCompetitor(editButton.dataset.editId));
  if (deleteButton) deleteCompetitor(deleteButton.dataset.deleteId);
});

els.form.addEventListener("submit", handleFormSubmit);
els.modalBackdrop.addEventListener("click", (event) => {
  if (event.target === els.modalBackdrop) closeModal();
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeModal();
  closeDrawer();
});

setInterval(updateTimestamp, 30000);

render();
loadDailyData();
