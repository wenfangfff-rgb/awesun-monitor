const defaultCountry = "US";
const defaultLanguage = "en";

export async function collectExternalSources({ config, competitors, previous }) {
  const context = {
    config,
    competitors,
    previous,
    statuses: {},
    metrics: {},
    keywordInsights: [],
    creativeThemes: [],
    signals: [],
    socialSignals: [],
    reviewSignals: [],
    sentimentPainPoints: []
  };

  await collectDataForSeoSerp(context);
  await collectSemrush(context);
  await collectAppleLookup(context);
  await collectMetaAds(context);
  await collectYouTube(context);
  await collectX(context);

  context.sentimentPainPoints = buildSentimentPainPoints(context);

  return {
    statuses: context.statuses,
    metrics: context.metrics,
    keywordInsights: context.keywordInsights,
    creativeThemes: context.creativeThemes,
    signals: context.signals,
    socialSignals: context.socialSignals,
    reviewSignals: context.reviewSignals,
    sentimentPainPoints: context.sentimentPainPoints
  };
}

async function collectDataForSeoSerp(context) {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    context.statuses.dataForSeo = "not_configured";
    return;
  }

  const keywords = context.config.keywords || [];
  if (!keywords.length) {
    context.statuses.dataForSeo = "skipped_no_keywords";
    return;
  }

  try {
    const tasks = keywords.map((keyword) => ({
      keyword,
      location_code: context.config.locationCode || 2840,
      language_code: context.config.languageCode || defaultLanguage,
      device: context.config.device || "desktop",
      depth: context.config.serpDepth || 20
    }));

    const response = await postJson("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", tasks, {
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`
    });

    const taskResults = response.tasks || [];
    const insights = [];
    const creatives = [];

    for (const task of taskResults) {
      const keyword = task.data?.keyword || task.result?.[0]?.keyword;
      const items = task.result?.flatMap((result) => result.items || []) || [];
      if (!keyword || !items.length) continue;

      const organicItems = items.filter((item) => item.type === "organic");
      const paidItems = items.filter((item) => item.type === "paid" || item.type === "ads" || item.is_paid);
      const awesunRank = findBestRank(organicItems, context.config.ownedDomains || []);
      const competitorRank = findBestRank(
        organicItems,
        context.competitors.flatMap((competitor) => competitor.domains || domainFromUrl(competitor.website)).filter(Boolean)
      );

      insights.push({
        keyword,
        awesunRank,
        competitorRank,
        intent: inferKeywordIntent(keyword),
        opportunity: scoreOpportunity(awesunRank, competitorRank)
      });

      for (const item of paidItems.slice(0, 6)) {
        const competitor = findCompetitorByUrl(context.competitors, item.url || item.domain || "");
        creatives.push({
          competitorId: competitor?.id || "unknown",
          title: item.title || item.domain || "Google SERP Ad",
          channel: "Google Ads",
          tags: ["搜索广告", keyword],
          copy: [item.description, item.url].filter(Boolean).join(" ")
        });
      }
    }

    context.keywordInsights.push(...insights);
    context.creativeThemes.push(...creatives);
    context.statuses.dataForSeo = `ok_keywords_${insights.length}`;
  } catch (error) {
    context.statuses.dataForSeo = `error_${shortError(error)}`;
  }
}

async function collectSemrush(context) {
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) {
    context.statuses.semrush = "not_configured";
    return;
  }

  const database = context.config.semrushDatabase || "us";
  try {
    let rows = 0;
    for (const competitor of context.competitors) {
      const domain = competitor.primaryDomain || domainFromUrl(competitor.website);
      if (!domain) continue;

      const url = new URL("https://api.semrush.com/");
      url.searchParams.set("type", "domain_organic");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("domain", domain);
      url.searchParams.set("database", database);
      url.searchParams.set("display_limit", "10");
      url.searchParams.set("export_columns", "Ph,Po,Nq,Ur");

      const text = await fetchText(url);
      const parsed = parseSemrushTable(text);
      rows += parsed.length;
      if (!parsed.length) continue;

      const current = context.metrics[competitor.id] || {};
      context.metrics[competitor.id] = {
        ...current,
        keywords: Math.max(current.keywords || 0, parsed.length)
      };
    }
    context.statuses.semrush = `ok_rows_${rows}`;
  } catch (error) {
    context.statuses.semrush = `error_${shortError(error)}`;
  }
}

async function collectAppleLookup(context) {
  const configured = context.competitors.filter((competitor) => competitor.appStore?.iosAppId);
  if (!configured.length) {
    context.statuses.appleLookup = "skipped_no_ios_app_ids";
    return;
  }

  let count = 0;
  for (const competitor of configured) {
    try {
      const country = competitor.appStore?.country || defaultCountry;
      const url = new URL("https://itunes.apple.com/lookup");
      url.searchParams.set("id", competitor.appStore.iosAppId);
      url.searchParams.set("country", country.toLowerCase());

      const data = await fetchJson(url);
      const app = data.results?.[0];
      if (!app) continue;

      const current = context.metrics[competitor.id] || {};
      context.metrics[competitor.id] = {
        ...current,
        rating: round(app.averageUserRating, 1) || current.rating,
        reviews: app.userRatingCount || current.reviews,
        version: app.version || current.version,
        lastReleaseDate: app.currentVersionReleaseDate || current.lastReleaseDate
      };
      count += 1;
    } catch (error) {
      context.signals.push(buildIntegrationErrorSignal(competitor, "App Store", error));
    }
  }

  context.statuses.appleLookup = `ok_apps_${count}`;
}

async function collectMetaAds(context) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    context.statuses.metaAds = "not_configured";
    return;
  }

  const configured = context.competitors.filter((competitor) => competitor.meta?.searchTerms?.length || competitor.meta?.pageId);
  if (!configured.length) {
    context.statuses.metaAds = "skipped_no_meta_targets";
    return;
  }

  let count = 0;
  for (const competitor of configured) {
    try {
      const searchTerms = competitor.meta?.searchTerms?.join(" OR ") || competitor.name;
      const url = new URL("https://graph.facebook.com/v19.0/ads_archive");
      url.searchParams.set("access_token", token);
      url.searchParams.set("ad_type", "ALL");
      url.searchParams.set("ad_reached_countries", JSON.stringify([competitor.meta?.country || defaultCountry]));
      url.searchParams.set("search_terms", searchTerms);
      url.searchParams.set("limit", String(competitor.meta?.limit || 10));
      url.searchParams.set("fields", "id,page_name,ad_creation_time,ad_delivery_start_time,ad_snapshot_url,publisher_platforms,ad_creative_bodies,ad_creative_link_titles");
      if (competitor.meta?.pageId) url.searchParams.set("search_page_ids", competitor.meta.pageId);

      const data = await fetchJson(url);
      for (const ad of data.data || []) {
        context.creativeThemes.push({
          competitorId: competitor.id,
          title: ad.ad_creative_link_titles?.[0] || `${competitor.name} Meta Ad`,
          channel: "Meta Ads",
          tags: ad.publisher_platforms || ["Meta"],
          copy: [ad.ad_creative_bodies?.[0], ad.ad_snapshot_url].filter(Boolean).join(" ")
        });
        count += 1;
      }
    } catch (error) {
      context.signals.push(buildIntegrationErrorSignal(competitor, "Meta Ads", error));
    }
  }

  context.statuses.metaAds = `ok_ads_${count}`;
}

async function collectYouTube(context) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    context.statuses.youtube = "not_configured";
    return;
  }

  const configured = context.competitors.filter((competitor) => competitor.social?.youtubeChannelId);
  if (!configured.length) {
    context.statuses.youtube = "skipped_no_channels";
    return;
  }

  const publishedAfter = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  let count = 0;

  for (const competitor of configured) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("channelId", competitor.social.youtubeChannelId);
      url.searchParams.set("type", "video");
      url.searchParams.set("order", "date");
      url.searchParams.set("publishedAfter", publishedAfter);
      url.searchParams.set("maxResults", "10");
      url.searchParams.set("key", apiKey);

      const data = await fetchJson(url);
      for (const item of data.items || []) {
        const videoId = item.id?.videoId;
        context.socialSignals.push({
          competitorId: competitor.id,
          source: "YouTube",
          title: item.snippet?.title,
          summary: item.snippet?.description,
          url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
          publishedAt: item.snippet?.publishedAt
        });
        count += 1;
      }
    } catch (error) {
      context.signals.push(buildIntegrationErrorSignal(competitor, "YouTube", error));
    }
  }

  context.statuses.youtube = `ok_posts_${count}`;
}

async function collectX(context) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    context.statuses.x = "not_configured";
    return;
  }

  const configured = context.competitors.filter((competitor) => competitor.social?.xHandle);
  if (!configured.length) {
    context.statuses.x = "skipped_no_handles";
    return;
  }

  let count = 0;
  for (const competitor of configured) {
    try {
      const query = `from:${competitor.social.xHandle.replace(/^@/, "")} -is:retweet lang:en`;
      const url = new URL("https://api.twitter.com/2/tweets/search/recent");
      url.searchParams.set("query", query);
      url.searchParams.set("max_results", "10");
      url.searchParams.set("tweet.fields", "created_at,public_metrics");

      const data = await fetchJson(url, {
        Authorization: `Bearer ${token}`
      });

      for (const post of data.data || []) {
        context.socialSignals.push({
          competitorId: competitor.id,
          source: "X",
          title: post.text?.slice(0, 90),
          summary: post.text,
          url: `https://x.com/${competitor.social.xHandle.replace(/^@/, "")}/status/${post.id}`,
          publishedAt: post.created_at,
          metrics: post.public_metrics
        });
        count += 1;
      }
    } catch (error) {
      context.signals.push(buildIntegrationErrorSignal(competitor, "X", error));
    }
  }

  context.statuses.x = `ok_posts_${count}`;
}

function buildSentimentPainPoints(context) {
  const texts = [
    ...context.reviewSignals.map((item) => item.summary || ""),
    ...context.socialSignals.map((item) => item.summary || "")
  ].join(" ").toLowerCase();

  if (!texts.trim()) return [];

  const rules = [
    ["slow", "速度慢"],
    ["lag", "延迟"],
    ["disconnect", "连接中断"],
    ["price", "价格"],
    ["expensive", "价格高"],
    ["support", "客服支持"],
    ["security", "安全担忧"],
    ["mobile", "移动端体验"],
    ["permission", "权限复杂"]
  ];

  return rules.filter(([needle]) => texts.includes(needle)).map(([, label]) => label);
}

function findBestRank(items, domains) {
  const normalizedDomains = domains.map(normalizeDomain).filter(Boolean);
  for (const item of items) {
    const haystack = `${item.domain || ""} ${item.url || ""}`.toLowerCase();
    if (normalizedDomains.some((domain) => haystack.includes(domain))) {
      return item.rank_absolute || item.rank_group || item.position || null;
    }
  }
  return null;
}

function findCompetitorByUrl(competitors, value) {
  const lower = value.toLowerCase();
  return competitors.find((competitor) => {
    const domains = competitor.domains || [domainFromUrl(competitor.website)];
    return domains.map(normalizeDomain).filter(Boolean).some((domain) => lower.includes(domain));
  });
}

function buildIntegrationErrorSignal(competitor, source, error) {
  return {
    id: `integration-${source.toLowerCase().replace(/\s+/g, "-")}-${competitor.id}-${Date.now()}`,
    competitorId: competitor.id,
    type: "数据源异常",
    source,
    impact: "Low",
    title: `${competitor.name} ${source} 数据采集失败`,
    summary: shortError(error),
    recommendation: "检查 API key、账号权限、请求限额和该竞品配置字段。",
    time: "今日",
    detectedAt: new Date().toISOString()
  };
}

function scoreOpportunity(awesunRank, competitorRank) {
  if (!competitorRank) return "Medium";
  if (!awesunRank || awesunRank - competitorRank >= 8) return "High";
  if (awesunRank > competitorRank) return "Medium";
  return "Low";
}

function inferKeywordIntent(keyword) {
  if (/free|trial/i.test(keyword)) return "免费试用";
  if (/business|support|unattended/i.test(keyword)) return "B2B采购";
  if (/software|alternative/i.test(keyword)) return "购买比较";
  return "泛搜索";
}

async function postJson(url, payload, headers = {}) {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload)
  });
  return parseJsonResponse(response);
}

async function fetchJson(url, headers = {}) {
  const response = await fetchWithTimeout(url, { headers });
  return parseJsonResponse(response);
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : {};
}

function parseSemrushTable(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1 || /^ERROR/i.test(lines[0])) return [];
  const headers = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const values = line.split(";");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeDomain(value) {
  return String(value || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function round(value, digits) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function shortError(error) {
  return String(error?.message || error).replace(/\s+/g, " ").slice(0, 120);
}
