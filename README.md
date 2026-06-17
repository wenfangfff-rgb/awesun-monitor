# Awesun 竞品监控网页

这是一个面向海外运营的竞品监控原型。页面会优先读取 `data/latest.json`；如果直接双击打开 HTML 或每日数据不可用，则使用内置演示数据。

## 每日采集

```bash
npm run collect
```

采集脚本会读取 `config/competitors.json`，每天抓取竞品官网配置页，提取页面标题、H1、meta description、正文摘要 hash，并和上一版 `data/latest.json` 对比，生成新的市场动作信号。

## 免费方案采集

如果暂时不想使用 DataForSEO，可用免费优先脚本：

```bash
python3 scripts/free_collect.py
```

可选安装 App 商店开源库：

```bash
python3 -m pip install -r requirements-free.txt
```

免费脚本的数据源：

- SERP/广告：SerpApi 免费额度，配置 `SERPAPI_KEY` 后抓 Google 自然排名和广告位。
- iOS App：Apple iTunes Lookup 免费接口抓版本、评分、评论数；`app-store-scraper` 抓评论。
- Google Play：`google-play-scraper` 抓版本、评分、评论数和最新评论。
- YouTube：YouTube Data API v3，配置 `YOUTUBE_API_KEY` 和竞品 `social.youtubeChannelId` 后抓频道最新视频。

缺少 API key 或 Python 包时，脚本不会中断，会在 `data/latest.json` 的 `integrations` 里标记为 `not_configured`、`skipped_*` 或 missing package。

## 每日定时

macOS/Linux 可以用 cron 每天跑一次：

```bash
0 9 * * * cd /Users/peng/Documents/测试开发一个网页 && /usr/local/bin/node scripts/daily_collect.mjs
```

如果本机 Node 路径不同，先用 `which node` 查看后替换。当前脚本不依赖 npm 包。

## 后续 API 接入位

- SEO/SERP：DataForSEO 已接入，配置 `DATAFORSEO_LOGIN` 和 `DATAFORSEO_PASSWORD` 后会拉 Google Organic SERP，写入 `keywordInsights`，并把 SERP 广告写入 `creativeThemes`。
- Semrush：已接入域名自然关键词补充，配置 `SEMRUSH_API_KEY` 后会更新各竞品的 `metrics.*.keywords`。
- App Store：已接入 Apple iTunes Lookup，给竞品配置 `appStore.iosAppId` 后会更新评分、评论数、版本和更新时间。
- Meta Ads：已接入 Meta Ad Library，配置 `META_ACCESS_TOKEN` 后会按 `meta.searchTerms` 拉公开广告素材并写入 `creativeThemes`。
- YouTube：已接入 YouTube Data API，配置 `YOUTUBE_API_KEY` 和 `social.youtubeChannelId` 后会写入 `socialSignals`，并转换成页面里的市场信号。
- X：已接入 X Recent Search，配置 `X_BEARER_TOKEN` 和 `social.xHandle` 后会写入 `socialSignals`。

## 环境变量

复制 `.env.example` 到你自己的 shell 环境，或直接在命令前设置：

```bash
DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=xxx npm run collect
```

本项目没有引入 dotenv 依赖，所以 `.env.example` 只是填写说明；如果用 cron，建议在 cron 命令里显式传环境变量，或在 shell profile 中导出。

免费方案可用：

```bash
SERPAPI_KEY=xxx YOUTUBE_API_KEY=xxx python3 scripts/free_collect.py
```

## 配置字段

每个竞品可以补这些字段：

```json
{
  "primaryDomain": "teamviewer.com",
  "domains": ["teamviewer.com"],
  "appStore": {
    "iosAppId": "",
    "googlePackage": "",
    "country": "US"
  },
  "meta": {
    "searchTerms": ["TeamViewer"],
    "country": "US"
  },
  "social": {
    "xHandle": "TeamViewer",
    "youtubeChannelId": ""
  }
}
```

接入后只需要让采集脚本继续输出同一份 `data/latest.json`，页面不需要重构。
