import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectExternalSources } from "./integrations/external_sources.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(rootDir, process.env.CONFIG_PATH || "config/competitors.json");
const outputPath = resolve(rootDir, process.env.OUTPUT_PATH || "data/latest.json");
const timeoutMs = 15000;

const config = JSON.parse(await readFile(configPath, "utf8"));
const previous = await readJsonIfExists(outputPath);
const generatedAt = new Date().toISOString();
const previousSnapshots = previous?.websiteSnapshots || {};

const competitors = config.competitors.map(normalizeCompetitor);
const websiteSnapshots = {};
const signals = [];

for (const competitor of competitors) {
  const pages = competitor.websitePages?.length ? competitor.websitePages : [competitor.website];
  websiteSnapshots[competitor.id] = {};

  for (const url of pages.filter(Boolean)) {
    const snapshot = await collectWebsiteSnapshot(url);
    websiteSnapshots[competitor.id][url] = snapshot;

    const previousSnapshot = previousSnapshots[competitor.id]?.[url];
    const changed = previousSnapshot && previousSnapshot.hash !== snapshot.hash;
    const firstSeen = !previousSnapshot;

    if (changed || firstSeen) {
      signals.push(buildWebsiteSignal({ competitor, snapshot, previousSnapshot, firstSeen }));
    }
  }
}

const external = await collectExternalSources({ config, competitors, previous });
const metrics = mergeMetrics(buildMetrics(competitors, previous?.metrics || {}), external.metrics);
const keywordInsights = external.keywordInsights.length
  ? external.keywordInsights
  : buildKeywordInsights(config.keywords || [], previous?.keywordInsights || []);
const creativeThemes = mergeUniqueByKey([...(previous?.creativeThemes || []), ...external.creativeThemes], creativeKey);
const allSignals = [...signals, ...external.signals, ...socialSignalsToSignals(external.socialSignals), ...reviewSignalsToSignals(external.reviewSignals)];
const sentimentPainPoints = external.sentimentPainPoints.length
  ? external.sentimentPainPoints
  : previous?.sentimentPainPoints || ["连接不稳定", "价格上涨", "移动端体验", "权限复杂", "延迟", "客服响应", "安全担忧"];
const insights = buildInsights(allSignals, keywordInsights, external);

const output = {
  date: generatedAt.slice(0, 10),
  generatedAt,
  source: "daily-collector",
  competitors: competitors.map(({ websitePages, ...competitor }) => competitor),
  metrics,
  signals: allSignals,
  keywordInsights,
  creativeThemes,
  insights,
  socialSignals: external.socialSignals,
  reviewSignals: external.reviewSignals,
  sentimentPainPoints,
  websiteSnapshots,
  integrations: {
    website: "enabled",
    ...external.statuses
  }
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(`Generated ${outputPath}`);
console.log(`Signals: ${signals.length}`);

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function normalizeCompetitor(competitor) {
  return {
    id: competitor.id || slugify(competitor.name),
    name: competitor.name,
    website: competitor.website,
    storeLink: competitor.storeLink || "",
    primaryDomain: competitor.primaryDomain || domainFromUrl(competitor.website),
    domains: competitor.domains || [domainFromUrl(competitor.website)].filter(Boolean),
    market: competitor.market || "Global",
    platforms: competitor.platforms?.length ? competitor.platforms : ["Web"],
    priority: competitor.priority || "Medium",
    notes: competitor.notes || "",
    websitePages: competitor.websitePages || [],
    appStore: competitor.appStore || {},
    meta: competitor.meta || {},
    social: competitor.social || {}
  };
}

async function collectWebsiteSnapshot(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "AwesunCompetitorMonitor/0.1 (+daily internal market research)"
      },
      signal: controller.signal
    });
    const html = await response.text();
    const normalizedText = normalizeText(stripHtml(html));

    return {
      url,
      ok: response.ok,
      status: response.status,
      title: extractTag(html, "title"),
      h1: extractTag(html, "h1"),
      description: extractMetaDescription(html),
      hash: hash(normalizedText),
      size: html.length,
      keywords: detectPageThemes(normalizedText),
      collectedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: 0,
      title: "",
      h1: "",
      description: "",
      hash: "",
      size: 0,
      keywords: [],
      error: error.name === "AbortError" ? "timeout" : error.message,
      collectedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildWebsiteSignal({ competitor, snapshot, previousSnapshot, firstSeen }) {
  const title = firstSeen ? `${competitor.name} 建立官网监控基线` : `${competitor.name} 官网页面发生变化`;
  const themes = snapshot.keywords.length ? `检测到主题：${snapshot.keywords.join("、")}。` : "";
  const previousTitle = previousSnapshot?.title && previousSnapshot.title !== snapshot.title ? `标题从「${previousSnapshot.title}」变为「${snapshot.title}」。` : "";

  return {
    id: `web-${competitor.id}-${hash(snapshot.url).slice(0, 8)}-${Date.now()}`,
    competitorId: competitor.id,
    type: firstSeen ? "监控基线" : "官网变化",
    source: "Website",
    impact: firstSeen ? "Low" : inferImpact(snapshot),
    title,
    url: snapshot.url,
    summary: `${snapshot.url} ${previousTitle || themes || "页面内容 hash 已更新。"}`.trim(),
    recommendation: firstSeen
      ? "这是首次采集，明天开始会自动识别官网内容变化。"
      : "建议复核页面首屏、CTA、价格和下载入口，判断是否需要调整 Awesun 的内容或投放动作。",
    time: "今日",
    detectedAt: snapshot.collectedAt
  };
}

function inferImpact(snapshot) {
  const text = `${snapshot.title} ${snapshot.h1} ${snapshot.description} ${snapshot.keywords.join(" ")}`.toLowerCase();
  if (/(price|pricing|discount|sale|deal|free|trial|download)/.test(text)) return "High";
  if (/(security|support|business|enterprise|remote)/.test(text)) return "Medium";
  return "Low";
}

function buildMetrics(competitors, previousMetrics) {
  return competitors.reduce((acc, competitor, index) => {
    const previous = previousMetrics[competitor.id] || {};
    const pages = websiteSnapshots[competitor.id] || {};
    const changedPages = Object.values(pages).filter((page) => {
      const old = previousSnapshots[competitor.id]?.[page.url];
      return old && old.hash !== page.hash;
    }).length;

    acc[competitor.id] = {
      rank: previous.rank || 8 + index,
      delta: changedPages,
      rating: previous.rating || 4.3,
      reviews: previous.reviews || 100 + index * 35,
      keywords: previous.keywords || 60 + index * 18,
      ads: previous.ads || Math.min(90, 35 + changedPages * 12 + index * 5),
      social: previous.social || 40 + index * 4,
      sentiment: previous.sentiment || 68
    };
    return acc;
  }, {});
}

function buildKeywordInsights(keywords, previousKeywordInsights) {
  if (previousKeywordInsights.length) return previousKeywordInsights;
  return keywords.map((keyword, index) => ({
    keyword,
    awesunRank: 12 + index * 3,
    competitorRank: 3 + index,
    intent: inferKeywordIntent(keyword),
    opportunity: index < 2 ? "High" : "Medium"
  }));
}

function buildInsights(todaySignals, todayKeywords, external = {}) {
  const changedWebsites = todaySignals.filter((signal) => signal.type === "官网变化").length;
  const highKeywords = todayKeywords.filter((item) => item.opportunity === "High").length;
  const adCreatives = external.creativeThemes?.length || 0;
  const socialPosts = external.socialSignals?.length || 0;

  return [
    {
      title: "今日官网变化",
      level: changedWebsites ? "High" : "Low",
      body: changedWebsites
        ? `今日发现 ${changedWebsites} 个竞品官网页面变化，优先检查价格、下载入口和首屏 CTA。`
        : "今日未发现已配置官网页面的实质变化，建议继续观察商店和广告渠道。"
    },
    {
      title: "今日 SEO 机会",
      level: highKeywords ? "High" : "Medium",
      body: `当前有 ${highKeywords} 个高优先级关键词，建议用于 Awesun 对比页、博客和商店文案。`
    },
    {
      title: "后续接入建议",
      level: adCreatives || socialPosts ? "High" : "Medium",
      body: adCreatives || socialPosts
        ? `今日新增 ${adCreatives} 条广告素材和 ${socialPosts} 条社媒动态，建议复核竞品新主张。`
        : "接入 DataForSEO、AppTweak 或 Semrush 后，可把关键词排名、应用商店排名和广告标题写入同一份 daily JSON。"
    }
  ];
}

function extractTag(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  return match ? cleanText(match[1]) : "";
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function cleanText(value) {
  return normalizeText(value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function detectPageThemes(text) {
  const lower = text.toLowerCase();
  const themes = [
    ["pricing", "价格/套餐"],
    ["discount", "折扣"],
    ["free trial", "免费试用"],
    ["download", "下载入口"],
    ["enterprise", "企业版"],
    ["security", "安全"],
    ["remote support", "远程支持"],
    ["unattended", "无人值守访问"]
  ];
  return themes.filter(([needle]) => lower.includes(needle)).map(([, label]) => label);
}

function inferKeywordIntent(keyword) {
  if (/free|trial/i.test(keyword)) return "免费试用";
  if (/business|support|unattended/i.test(keyword)) return "B2B采购";
  if (/software|alternative/i.test(keyword)) return "购买比较";
  return "泛搜索";
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function mergeMetrics(base, patch) {
  const output = { ...base };
  for (const [competitorId, metrics] of Object.entries(patch || {})) {
    output[competitorId] = {
      ...(output[competitorId] || {}),
      ...metrics
    };
  }
  return output;
}

function mergeUniqueByKey(items, keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function creativeKey(item) {
  return [item.competitorId, item.channel, item.title, item.copy].join("|");
}

function socialSignalsToSignals(items) {
  return items.map((item) => ({
    id: `social-${item.source.toLowerCase()}-${item.competitorId}-${hash(item.url || item.title || Date.now()).slice(0, 8)}`,
    competitorId: item.competitorId,
    type: "社媒/PR",
    source: item.source,
    impact: "Medium",
    title: item.title || "发现新的社媒动态",
    summary: item.summary || item.url || "",
    recommendation: "建议复核内容主题、互动表现和 CTA，判断是否跟进社媒或内容选题。",
    time: "今日",
    detectedAt: item.publishedAt || new Date().toISOString()
  }));
}

function reviewSignalsToSignals(items) {
  return items.map((item) => ({
    id: `review-${item.source.toLowerCase()}-${item.competitorId}-${hash(item.url || item.summary || Date.now()).slice(0, 8)}`,
    competitorId: item.competitorId,
    type: "口碑舆情",
    source: item.source,
    impact: item.rating && item.rating <= 2 ? "High" : "Medium",
    title: item.title || "发现新的用户评论",
    summary: item.summary || "",
    recommendation: "提取用户痛点，判断是否可用于 Awesun 商店文案、FAQ 或投放反击素材。",
    time: "今日",
    detectedAt: item.publishedAt || new Date().toISOString()
  }));
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
