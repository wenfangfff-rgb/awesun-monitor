#!/usr/bin/env python3
"""Free-first competitor collector.

This script updates data/latest.json with free or free-tier sources:
- SerpApi free tier for Google SERP organic rankings and ad positions.
- Apple iTunes Lookup plus app-store-scraper for iOS metadata and reviews.
- google-play-scraper for Google Play metadata and reviews.
- YouTube Data API v3 free quota for channel video updates.

All paid/credentialed sources are optional. Missing keys or packages are reported
in latest.json integrations instead of failing the whole daily run.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "competitors.json"
DEFAULT_OUTPUT = ROOT / "data" / "latest.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect free competitor monitoring data.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to competitors config JSON.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Path to latest JSON output.")
    parser.add_argument("--review-count", type=int, default=20, help="Reviews to fetch per app per store.")
    args = parser.parse_args()

    config = read_json(Path(args.config))
    output_path = Path(args.output)
    previous = read_json(output_path, default={})
    competitors = config.get("competitors", [])
    now = utc_now()

    integrations: dict[str, str] = dict(previous.get("integrations", {}))
    signals: list[dict[str, Any]] = []
    metrics: dict[str, dict[str, Any]] = dict(previous.get("metrics", {}))
    keyword_insights = list(previous.get("keywordInsights", []))
    creative_themes = list(previous.get("creativeThemes", []))
    social_signals = list(previous.get("socialSignals", []))
    review_signals = list(previous.get("reviewSignals", []))

    serp = collect_serpapi(config, competitors)
    integrations["serpApi"] = serp["status"]
    keyword_insights = serp["keywordInsights"] or keyword_insights
    if serp["status"].startswith("ok_"):
        creative_themes = merge_unique(serp["creativeThemes"], creative_key)
    else:
        creative_themes = merge_unique(creative_themes + serp["creativeThemes"], creative_key)
    source_signals: list[dict[str, Any]] = []
    source_signals.extend(serp["signals"])

    brand_serp = collect_brand_serp(config, competitors, previous)
    integrations["brandSerp"] = brand_serp["status"]
    brand_serp_snapshots = brand_serp["snapshots"] or previous.get("brandSerpSnapshots", {})
    brand_serp_changes = brand_serp["changes"] or previous.get("brandSerpChanges", [])
    source_signals.extend(brand_serp["signals"])

    website = collect_website_pages(competitors, previous)
    integrations["websitePages"] = website["status"]

    content = collect_content_sources(config, competitors, previous, brand_serp_snapshots)
    integrations["contentSources"] = content["status"]
    source_signals.extend(content["signals"])

    app_data = collect_apps(competitors, review_count=args.review_count)
    integrations.update(app_data["statuses"])
    metrics = merge_metrics(metrics, app_data["metrics"])
    review_signals = merge_unique(app_data["reviewSignals"] + review_signals, review_signal_key)
    source_signals.extend(review_to_market_signals(app_data["reviewSignals"]))

    youtube = collect_youtube(competitors)
    integrations["youtubeFree"] = youtube["status"]
    social_signals = merge_unique(social_signals + youtube["socialSignals"], signal_key)
    source_signals.extend(social_to_market_signals(youtube["socialSignals"]))
    signals = build_operational_signals(
        competitors,
        source_signals,
        website["changes"],
        website["snapshots"],
        content["changes"],
        content["items"],
        app_data["reviewSignals"],
        brand_serp_changes,
    )

    sentiment_pain_points = build_sentiment_pain_points(review_signals + social_signals)
    insights = build_free_insights(
        keyword_insights,
        creative_themes,
        social_signals,
        review_signals,
        brand_serp_changes,
        content["changes"],
    )

    output = {
        **previous,
        "date": now[:10],
        "generatedAt": now,
        "source": "free-collector",
        "competitors": strip_runtime_config(competitors),
        "metrics": metrics,
        "signals": dedupe_recent_signals(signals),
        "keywordInsights": keyword_insights,
        "creativeThemes": creative_themes,
        "brandSerpSnapshots": brand_serp_snapshots,
        "brandSerpChanges": brand_serp_changes,
        "websiteSnapshots": website["snapshots"],
        "contentItems": content["items"],
        "contentChanges": content["changes"],
        "socialSignals": social_signals,
        "reviewSignals": review_signals,
        "sentimentPainPoints": sentiment_pain_points or previous.get("sentimentPainPoints", []),
        "insights": insights,
        "integrations": integrations,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {output_path}")
    print(json.dumps(output["integrations"], ensure_ascii=False, indent=2))
    return 0


def collect_serpapi(config: dict[str, Any], competitors: list[dict[str, Any]]) -> dict[str, Any]:
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return empty_serp_result("not_configured")

    keywords = config.get("keywords", [])
    if not keywords:
        return empty_serp_result("skipped_no_keywords")

    owned_domains = [normalize_domain(item) for item in config.get("ownedDomains", [])]
    competitor_domains = {
        competitor["id"]: [normalize_domain(domain) for domain in competitor.get("domains", [])]
        or [normalize_domain(domain_from_url(competitor.get("website", "")))]
        for competitor in competitors
    }

    keyword_insights: list[dict[str, Any]] = []
    creative_themes: list[dict[str, Any]] = []
    signals: list[dict[str, Any]] = []
    errors = 0

    for keyword in keywords:
        try:
            data = fetch_json(
                "https://serpapi.com/search.json",
                {
                    "engine": "google",
                    "q": keyword,
                    "api_key": api_key,
                    "google_domain": config.get("googleDomain", "google.com"),
                    "gl": config.get("serpCountry", "us"),
                    "hl": config.get("languageCode", "en"),
                    "num": str(config.get("serpDepth", 20)),
                },
            )
        except Exception as exc:  # noqa: BLE001 - keep collector resilient.
            errors += 1
            signals.append(integration_error_signal("serpapi", "SerpApi", str(exc)))
            continue

        organic_results = data.get("organic_results", [])
        ad_results = collect_serp_ads(data)
        awesun_rank = best_rank_for_domains(organic_results, owned_domains)
        competitor_hits = {
            cid: best_rank_for_domains(organic_results, domains)
            for cid, domains in competitor_domains.items()
        }
        ranked_competitors = {cid: rank for cid, rank in competitor_hits.items() if rank}
        best_competitor_rank = min(ranked_competitors.values()) if ranked_competitors else None

        keyword_insights.append(
            {
                "keyword": keyword,
                "awesunRank": awesun_rank,
                "competitorRank": best_competitor_rank,
                "intent": infer_keyword_intent(keyword),
                "opportunity": score_opportunity(awesun_rank, best_competitor_rank),
                "source": "SerpApi",
            }
        )

        for ad in ad_results:
            competitor = find_competitor_for_url(competitors, ad.get("link") or ad.get("displayed_link") or "")
            creative_themes.append(
                {
                    "competitorId": competitor.get("id") if competitor else "unknown",
                    "title": ad.get("title") or "Google Search Ad",
                    "channel": "Google Ads",
                    "tags": ["SERP", keyword, f"pos:{ad.get('position', '?')}"],
                    "copy": " ".join(filter(None, [ad.get("description"), ad.get("snippet"), ad.get("link")])),
                }
            )

    status = f"ok_keywords_{len(keyword_insights)}"
    if errors:
        status += f"_errors_{errors}"
    return {
        "status": status,
        "keywordInsights": keyword_insights,
        "creativeThemes": creative_themes,
        "signals": signals,
    }


def empty_serp_result(status: str) -> dict[str, Any]:
    return {
        "status": status,
        "keywordInsights": [],
        "creativeThemes": [],
        "signals": [],
    }


def collect_brand_serp(
    config: dict[str, Any],
    competitors: list[dict[str, Any]],
    previous: dict[str, Any],
) -> dict[str, Any]:
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return empty_brand_serp_result("not_configured")

    markets = config.get("serpMarkets", {})
    if not markets:
        return empty_brand_serp_result("skipped_no_markets")

    previous_snapshots = previous.get("brandSerpSnapshots", {})
    snapshots: dict[str, Any] = {}
    changes: list[dict[str, Any]] = []
    signals: list[dict[str, Any]] = []
    errors = 0
    searches = 0

    for market, market_config in markets.items():
        templates = market_config.get("keywordTemplates", ["{brand}"])
        for competitor in competitors:
            for template in templates:
                keyword = template.format(brand=competitor["name"])
                snapshot_key = build_serp_key(market, competitor["id"], keyword)
                try:
                    data = fetch_json(
                        "https://serpapi.com/search.json",
                        {
                            "engine": "google",
                            "q": keyword,
                            "api_key": api_key,
                            "google_domain": market_config.get("googleDomain", "google.com"),
                            "gl": market_config.get("gl", "us"),
                            "hl": market_config.get("hl", "en"),
                            "num": str(market_config.get("num", 20)),
                        },
                    )
                    searches += 1
                except Exception as exc:  # noqa: BLE001
                    errors += 1
                    signals.append(integration_error_signal(competitor["id"], "Brand SERP", str(exc)))
                    continue

                snapshot = normalize_serp_snapshot(market, competitor, keyword, data)
                snapshots[snapshot_key] = snapshot
                previous_snapshot = previous_snapshots.get(snapshot_key)
                snapshot_changes = diff_serp_snapshots(previous_snapshot, snapshot)
                changes.extend(snapshot_changes)
                signals.extend(serp_changes_to_signals(competitor, market, keyword, snapshot_changes))

    status = f"ok_searches_{searches}"
    if errors:
        status += f"_errors_{errors}"
    return {
        "status": status,
        "snapshots": snapshots,
        "changes": changes,
        "signals": signals,
    }


def empty_brand_serp_result(status: str) -> dict[str, Any]:
    return {
        "status": status,
        "snapshots": {},
        "changes": [],
        "signals": [],
    }


def normalize_serp_snapshot(
    market: str,
    competitor: dict[str, Any],
    keyword: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    organic = [
        normalize_serp_item(item, "organic")
        for item in data.get("organic_results", [])[:20]
    ]
    ads = [
        normalize_serp_item(item, "ad")
        for item in collect_serp_ads(data)[:10]
    ]
    return {
        "market": market,
        "competitorId": competitor["id"],
        "competitorName": competitor["name"],
        "keyword": keyword,
        "collectedAt": utc_now(),
        "organic": organic,
        "ads": ads,
    }


def normalize_serp_item(item: dict[str, Any], result_type: str) -> dict[str, Any]:
    link = item.get("link") or item.get("url") or ""
    return {
        "type": result_type,
        "position": item.get("position") or item.get("rank") or item.get("block_position"),
        "title": item.get("title") or "",
        "url": link,
        "domain": normalize_domain(domain_from_url(link) or item.get("displayed_link") or item.get("source") or ""),
        "snippet": item.get("snippet") or item.get("description") or "",
    }


def diff_serp_snapshots(previous: dict[str, Any] | None, current: dict[str, Any]) -> list[dict[str, Any]]:
    if not previous:
        return [
            build_serp_change("baseline", current, item, None, item.get("position"))
            for item in current.get("organic", [])[:5]
        ]

    changes: list[dict[str, Any]] = []
    previous_by_url = {normalize_url(item.get("url")): item for item in previous.get("organic", []) if item.get("url")}
    current_by_url = {normalize_url(item.get("url")): item for item in current.get("organic", []) if item.get("url")}

    for url, item in current_by_url.items():
        old = previous_by_url.get(url)
        if not old:
            changes.append(build_serp_change("new", current, item, None, item.get("position")))
            continue
        old_position = old.get("position")
        new_position = item.get("position")
        if old_position and new_position and old_position != new_position:
            change_type = "up" if new_position < old_position else "down"
            changes.append(build_serp_change(change_type, current, item, old_position, new_position))
        if clean_compare(old.get("title")) != clean_compare(item.get("title")):
            changes.append(build_serp_change("title_changed", current, item, old_position, new_position, old.get("title")))

    for url, item in previous_by_url.items():
        if url not in current_by_url:
            changes.append(build_serp_change("gone", current, item, item.get("position"), None))

    return changes


def build_serp_change(
    change_type: str,
    snapshot: dict[str, Any],
    item: dict[str, Any],
    previous_position: int | None,
    current_position: int | None,
    previous_title: str | None = None,
) -> dict[str, Any]:
    return {
        "type": change_type,
        "market": snapshot["market"],
        "competitorId": snapshot["competitorId"],
        "competitorName": snapshot["competitorName"],
        "keyword": snapshot["keyword"],
        "title": item.get("title"),
        "previousTitle": previous_title,
        "url": item.get("url"),
        "domain": item.get("domain"),
        "previousPosition": previous_position,
        "currentPosition": current_position,
        "detectedAt": utc_now(),
        "impact": score_serp_change(change_type, previous_position, current_position),
    }


def score_serp_change(change_type: str, old_position: int | None, new_position: int | None) -> str:
    if change_type in {"new", "up"} and (new_position or 99) <= 10:
        return "High"
    if change_type == "gone" and (old_position or 99) <= 10:
        return "High"
    if change_type == "title_changed" and (new_position or old_position or 99) <= 10:
        return "Medium"
    return "Low"


def serp_changes_to_signals(
    competitor: dict[str, Any],
    market: str,
    keyword: str,
    changes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    signals = []
    for change in changes:
        if change["impact"] == "Low":
            continue
        market_label = {"US": "美国", "TW": "台湾", "Global": "全球"}.get(market, market)
        title_map = {
            "new": "新增搜索结果",
            "gone": "搜索结果消失",
            "up": "搜索排名上升",
            "down": "搜索排名下降",
            "title_changed": "搜索标题变化",
            "baseline": "建立搜索基线",
        }
        signals.append(
            {
                "id": f"serp-{competitor['id']}-{market}-{hash_text(keyword + (change.get('url') or '') + change['type'])[:8]}",
                "competitorId": competitor["id"],
                "type": "搜索结果变化",
                "source": "Google SERP",
                "impact": change["impact"],
                "title": f"{competitor['name']} {market_label} {title_map.get(change['type'], '搜索变化')}",
                "url": change.get("url") or "",
                "summary": f"{keyword}：{change.get('title') or change.get('url')}，位置 {change.get('previousPosition')} -> {change.get('currentPosition')}",
                "recommendation": "复核该结果是否影响品牌词、竞品对比词或下载转化路径，必要时调整 Awesun 内容页和投放关键词。",
                "time": "今日",
                "detectedAt": change["detectedAt"],
            }
        )
    return signals


def collect_website_pages(competitors: list[dict[str, Any]], previous: dict[str, Any]) -> dict[str, Any]:
    previous_snapshots = previous.get("websiteSnapshots", {})
    snapshots: dict[str, dict[str, Any]] = {}
    changes: list[dict[str, Any]] = []
    errors = 0

    for competitor in competitors:
        pages = competitor.get("websitePages") or [competitor.get("website", "")]
        competitor_snapshots: dict[str, Any] = {}
        old_competitor_snapshots = previous_snapshots.get(competitor["id"], {})
        for url in [page for page in pages if page]:
            try:
                snapshot = collect_website_snapshot(url)
            except Exception as exc:  # noqa: BLE001
                errors += 1
                snapshot = {
                    "url": url,
                    "ok": False,
                    "status": None,
                    "title": "",
                    "h1": "",
                    "description": str(exc)[:180],
                    "hash": "",
                    "size": 0,
                    "keywords": [],
                    "collectedAt": utc_now(),
                }
            competitor_snapshots[url] = snapshot
            old_snapshot = old_competitor_snapshots.get(url)
            if not old_snapshot:
                changes.append(build_website_change("baseline", competitor, snapshot, None))
            elif snapshot.get("ok") and old_snapshot.get("ok") and snapshot.get("hash") != old_snapshot.get("hash"):
                changes.append(build_website_change("changed", competitor, snapshot, old_snapshot))
        snapshots[competitor["id"]] = competitor_snapshots

    status = f"ok_pages_{sum(len(pages) for pages in snapshots.values())}"
    if errors:
        status += f"_errors_{errors}"
    return {"status": status, "snapshots": snapshots, "changes": changes}


def collect_website_snapshot(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "AwesunFreeCollector/0.1"})
    with urllib.request.urlopen(request, timeout=10) as response:
        html = response.read().decode("utf-8", errors="ignore")
        status = getattr(response, "status", 200)
    text = clean_html(html)
    return {
        "url": url,
        "ok": 200 <= status < 400,
        "status": status,
        "title": extract_html_tag(html, "title"),
        "h1": extract_html_tag(html, "h1"),
        "description": extract_meta_description(html),
        "hash": hash_text(text[:120000]),
        "size": len(html),
        "keywords": detect_page_themes(text),
        "collectedAt": utc_now(),
    }


def extract_html_tag(html: str, tag: str) -> str:
    match = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", html, flags=re.I | re.S)
    return clean_html(match.group(1))[:180] if match else ""


def extract_meta_description(html: str) -> str:
    patterns = (
        r"<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']+)[\"']",
        r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+name=[\"']description[\"']",
    )
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.I | re.S)
        if match:
            return clean_html(match.group(1))[:240]
    return ""


def detect_page_themes(text: str) -> list[str]:
    lower = text.lower()
    rules = [
        ("pricing", "价格/套餐"),
        ("price", "价格/套餐"),
        ("discount", "折扣"),
        ("off", "折扣"),
        ("coupon", "折扣"),
        ("download", "下载入口"),
        ("free trial", "免费试用"),
        ("trial", "免费试用"),
        ("enterprise", "企业版"),
        ("business", "企业版"),
        ("security", "安全"),
        ("remote support", "远程支持"),
        ("unattended", "无人值守"),
        ("ai", "AI"),
    ]
    themes = []
    for needle, label in rules:
        if needle in lower and label not in themes:
            themes.append(label)
    return themes


def build_website_change(
    change_type: str,
    competitor: dict[str, Any],
    snapshot: dict[str, Any],
    previous_snapshot: dict[str, Any] | None,
) -> dict[str, Any]:
    return {
        "type": change_type,
        "competitorId": competitor["id"],
        "competitorName": competitor["name"],
        "url": snapshot.get("url"),
        "title": snapshot.get("title") or snapshot.get("h1") or title_from_url(snapshot.get("url", "")),
        "previousTitle": (previous_snapshot or {}).get("title"),
        "description": snapshot.get("description") or snapshot.get("h1") or "",
        "keywords": snapshot.get("keywords") or [],
        "status": snapshot.get("status"),
        "impact": score_website_change(change_type, snapshot),
        "detectedAt": snapshot.get("collectedAt") or utc_now(),
    }


def score_website_change(change_type: str, snapshot: dict[str, Any]) -> str:
    themes = set(snapshot.get("keywords") or [])
    if themes & {"价格/套餐", "折扣", "下载入口", "免费试用"}:
        return "High" if change_type == "changed" else "Medium"
    if change_type == "changed":
        return "Medium"
    return "Low"


def collect_content_sources(
    config: dict[str, Any],
    competitors: list[dict[str, Any]],
    previous: dict[str, Any],
    serp_snapshots: dict[str, Any],
) -> dict[str, Any]:
    previous_items = previous.get("contentItems", [])
    previous_urls = {normalize_url(item.get("url")) for item in previous_items}
    has_content_baseline = bool(previous_items)
    items: list[dict[str, Any]] = []
    changes: list[dict[str, Any]] = []
    signals: list[dict[str, Any]] = []
    errors = 0

    for competitor in competitors:
        sources = competitor.get("contentSources") or infer_content_sources(competitor)
        for source in sources:
            try:
                source_items = collect_content_source(competitor, source)
            except Exception as exc:  # noqa: BLE001
                errors += 1
                signals.append(integration_error_signal(competitor["id"], "Content Source", str(exc)))
                continue
            for item in source_items:
                item["rankedKeywords"] = find_content_serp_presence(item["url"], serp_snapshots)
                items.append(item)
                if normalize_url(item["url"]) not in previous_urls:
                    recent_published = is_recent_iso(item.get("publishedDate"), days=7)
                    change_type = (
                        "suspected_new_content"
                        if recent_published
                        else "first_seen_content"
                        if has_content_baseline
                        else "baseline_content"
                    )
                    change = {
                        "type": change_type,
                        **item,
                        "impact": "High" if recent_published or item["rankedKeywords"] else "Low",
                        "detectedAt": utc_now(),
                    }
                    changes.append(change)
                    if change_type != "baseline_content":
                        signals.append(content_change_to_signal(change))

    status = f"ok_items_{len(items)}"
    if errors:
        status += f"_errors_{errors}"
    return {
        "status": status,
        "items": merge_unique(items, lambda item: normalize_url(item.get("url"))),
        "changes": changes,
        "signals": signals,
    }


def infer_content_sources(competitor: dict[str, Any]) -> list[dict[str, str]]:
    pages = competitor.get("websitePages", [])
    return [
        {"type": "blog", "url": url}
        for url in pages
        if any(token in url.lower() for token in ("blog", "resource", "news"))
    ]


def collect_content_source(competitor: dict[str, Any], source: dict[str, str]) -> list[dict[str, Any]]:
    url = source["url"]
    html = fetch_text(url)
    base_domain = normalize_domain(domain_from_url(url))
    links = extract_links(html, url)
    items = []
    detail_date_fetches = 0
    status_checks = 0
    for link in links:
        if len(items) >= 20:
            break
        normalized = normalize_url(link["url"])
        if not normalized or normalize_domain(domain_from_url(normalized)) != base_domain:
            continue
        if "{" in normalized or "}" in normalized or "{" in link["title"] or "}" in link["title"]:
            continue
        if not looks_like_content_url(normalized):
            continue
        if is_content_index_url(normalized):
            continue
        if status_checks < 6:
            status_checks += 1
            status = content_url_status(normalized)
            if status and status >= 400:
                continue
        content_title = link["title"] or title_from_url(normalized)
        if is_generic_content_title(content_title):
            content_title = title_from_url(normalized)
        published_date = detect_content_published_date(normalized, content_title, link.get("context", ""))
        if not published_date and detail_date_fetches < 2:
            detail_date_fetches += 1
            published_date = fetch_content_published_date(normalized)
        items.append(
            {
                "competitorId": competitor["id"],
                "competitorName": competitor["name"],
                "sourceType": source.get("type", "content"),
                "sourceUrl": url,
                "title": content_title,
                "url": normalized,
                "publishedDate": published_date,
                "market": competitor.get("market", "Global"),
                "collectedAt": utc_now(),
            }
        )
    return merge_unique(items[:20], lambda item: normalize_url(item.get("url")))


def extract_links(html: str, base_url: str) -> list[dict[str, str]]:
    links = []
    for match in re.finditer(r"<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", html, flags=re.I | re.S):
        href = urllib.parse.urljoin(base_url, match.group(1))
        title = clean_html(match.group(2))
        context = html[max(0, match.start() - 240) : match.end() + 240]
        links.append({"url": href, "title": title, "context": clean_html(context)})
    return links


def looks_like_content_url(url: str) -> bool:
    lower = urllib.parse.urlparse(url).path.lower()
    if "subscribe" in lower or "/newsletter" in lower:
        return False
    return any(token in lower for token in ("/blog", "/resource", "/resources", "/news", "/article"))


def is_content_index_url(url: str) -> bool:
    path = normalized_content_path(url)
    index_paths = {
        "/blog",
        "/blogs",
        "/news",
        "/newsletter",
        "/resource",
        "/resources",
        "/resource/blog",
        "/resources/news-insights",
        "/resources/events",
        "/resources/compare",
        "/resources/success-stories",
    }
    return path in index_paths


def normalized_content_path(url: str) -> str:
    path = urllib.parse.urlparse(url).path.rstrip("/").lower()
    segments = [segment for segment in path.split("/") if segment]
    if segments and re.fullmatch(r"[a-z]{2}(?:-[a-z]{2})?", segments[0]):
        segments = segments[1:]
    return "/" + "/".join(segments) if segments else "/"


def is_generic_content_title(title: str) -> bool:
    text = clean_compare(title)
    return text in {
        "",
        "learn more",
        "read more",
        "view more",
        "see more",
        "resources",
        "blog",
        "news",
        "newsletter",
        "subscribe",
        "events",
        "news and insights",
        "success stories",
        "trust center",
        "why teamviewer",
    }


def content_url_status(url: str) -> int | None:
    try:
        request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "AwesunFreeCollector/0.1"})
        with urllib.request.urlopen(request, timeout=2) as response:
            return getattr(response, "status", 200)
    except urllib.error.HTTPError as exc:
        return exc.code
    except Exception:
        return None


def detect_content_published_date(*values: str) -> str | None:
    text = " ".join(str(value or "") for value in values)
    for pattern in (
        r"\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b",
        r"\b(20\d{2})/(0?[1-9]|1[0-2])\b",
    ):
        match = re.search(pattern, text)
        if match:
            year, month = int(match.group(1)), int(match.group(2))
            day = int(match.group(3)) if len(match.groups()) >= 3 else 1
            try:
                return dt.date(year, month, day).isoformat()
            except ValueError:
                continue

    month_pattern = (
        r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"\s+([0-3]?\d),?\s+(20\d{2})\b"
    )
    match = re.search(month_pattern, text, flags=re.I)
    if match:
        for fmt in ("%B %d %Y", "%b %d %Y"):
            try:
                return dt.datetime.strptime(" ".join(match.groups()), fmt).date().isoformat()
            except ValueError:
                continue
    return None


def fetch_content_published_date(url: str) -> str | None:
    try:
        html = fetch_text(url, timeout=6)
    except Exception:
        return None

    candidates = []
    for pattern in (
        r"<meta[^>]+(?:property|name)=[\"'](?:article:published_time|date|publishdate|pubdate|datePublished)[\"'][^>]+content=[\"']([^\"']+)[\"']",
        r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"'](?:article:published_time|date|publishdate|pubdate|datePublished)[\"']",
        r"<time[^>]+datetime=[\"']([^\"']+)[\"']",
        r"\"datePublished\"\s*:\s*\"([^\"]+)\"",
        r"\"dateModified\"\s*:\s*\"([^\"]+)\"",
    ):
        candidates.extend(re.findall(pattern, html, flags=re.I))
    return detect_content_published_date(url, " ".join(candidates))


def find_content_serp_presence(url: str, serp_snapshots: dict[str, Any]) -> list[dict[str, Any]]:
    normalized = normalize_url(url)
    matches = []
    for snapshot in serp_snapshots.values():
        for item in snapshot.get("organic", []):
            if normalize_url(item.get("url")) == normalized:
                matches.append(
                    {
                        "market": snapshot.get("market"),
                        "keyword": snapshot.get("keyword"),
                        "position": item.get("position"),
                    }
                )
    return matches


def content_change_to_signal(change: dict[str, Any]) -> dict[str, Any]:
    is_suspected_new = change["type"] == "suspected_new_content"
    title = "疑似新发布内容" if is_suspected_new else "首次发现内容"
    summary_date = f"发布时间：{change['publishedDate']}。" if change.get("publishedDate") else "未识别到明确发布时间。"
    return {
        "id": f"content-{change['competitorId']}-{hash_text(change['url'])[:8]}",
        "competitorId": change["competitorId"],
        "type": "内容产出",
        "source": "Website Content",
        "impact": change["impact"],
        "title": f"{change['competitorName']} {title}",
        "url": change["url"],
        "summary": f"{summary_date}{change['title']} - {change['url']}",
        "recommendation": "复核该内容主题、目标关键词、CTA 和是否进入 Google 前 20，判断 Awesun 是否需要跟进同类内容。",
        "time": change.get("publishedDate") or "首次发现",
        "detectedAt": change["detectedAt"],
    }


def build_operational_signals(
    competitors: list[dict[str, Any]],
    source_signals: list[dict[str, Any]],
    website_changes: list[dict[str, Any]],
    website_snapshots: dict[str, Any],
    content_changes: list[dict[str, Any]],
    content_items: list[dict[str, Any]],
    app_reviews: list[dict[str, Any]],
    serp_changes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    competitor_names = {competitor["id"]: competitor["name"] for competitor in competitors}
    competitors_by_id = {competitor["id"]: competitor for competitor in competitors}
    output: list[dict[str, Any]] = []

    website_ops = [
        website_change_to_operational_signal(change)
        for change in website_changes
        if change.get("type") == "changed" or change.get("impact") != "Low"
    ]
    website_ops.extend(
        website_snapshot_to_operational_signal(competitors_by_id.get(competitor_id), snapshot)
        for competitor_id, pages in website_snapshots.items()
        for snapshot in pages.values()
        if snapshot.get("ok")
    )
    output.extend(take_balanced(website_ops, lambda item: item.get("competitorId"), per_key=2, total=16))

    content_ops: list[dict[str, Any]] = []
    for change in content_changes:
        if change.get("type") == "baseline_content":
            continue
        content_ops.append(content_change_to_operational_signal(change))
    content_ops.extend(
        content_item_to_operational_signal(item)
        for item in sorted(
            content_items,
            key=lambda item: item.get("publishedDate") or item.get("collectedAt") or "",
            reverse=True,
        )
    )
    output.extend(take_balanced(content_ops, lambda item: item.get("competitorId"), per_key=2, total=16))

    recent_reviews = [
        review
        for review in app_reviews
        if review.get("source") == "Google Play" and is_recent_iso(review.get("publishedAt"), days=7)
    ]
    for review in recent_reviews:
        output.append(review_to_operational_signal(review, competitor_names))

    serp_ops: list[dict[str, Any]] = []
    for change in serp_changes:
        if change.get("impact") in {"High", "Medium"} or (
            change.get("type") == "baseline" and (change.get("currentPosition") or 99) <= 5
        ):
            serp_ops.append(serp_change_to_operational_signal(change))
    output.extend(
        take_balanced(
            serp_ops,
            lambda item: f"{item.get('competitorId')}|{item.get('market')}",
            per_key=2,
            total=32,
        )
    )

    return dedupe_recent_signals(output)


def take_balanced(items: list[dict[str, Any]], key_fn, per_key: int, total: int) -> list[dict[str, Any]]:
    picked: list[dict[str, Any]] = []
    counts: dict[Any, int] = {}
    for item in items:
        key = key_fn(item)
        if counts.get(key, 0) >= per_key:
            continue
        picked.append(item)
        counts[key] = counts.get(key, 0) + 1
        if len(picked) >= total:
            return picked

    picked_ids = {id(item) for item in picked}
    for item in items:
        if id(item) in picked_ids:
            continue
        picked.append(item)
        if len(picked) >= total:
            break
    return picked


def website_change_to_operational_signal(change: dict[str, Any]) -> dict[str, Any]:
    competitor_name = change.get("competitorName") or "竞品"
    themes = "、".join(change.get("keywords") or []) or "页面文案/结构"
    changed = change.get("type") == "changed"
    title = (
        f"{competitor_name} 官网重点页发生变化：{change.get('title')}"
        if changed
        else f"{competitor_name} 官网重点页进入监控：{change.get('title')}"
    )
    previous = f"上一标题：{change.get('previousTitle')}。" if changed and change.get("previousTitle") else ""
    return {
        "id": f"op-website-{change.get('competitorId')}-{hash_text(str(change.get('url')) + str(change.get('type')))[:8]}",
        "competitorId": change.get("competitorId"),
        "type": "官网动作",
        "source": "Official Website",
        "impact": change.get("impact") or "Medium",
        "title": title,
        "url": change.get("url") or "",
        "summary": f"{previous}识别主题：{themes}。{change.get('description') or change.get('url') or ''}",
        "recommendation": "检查页面是否涉及价格、折扣、下载入口、产品主张或转化路径变化，必要时同步调整 Awesun 对比页和投放落地页。",
        "time": "页面变化" if changed else "监控基线",
        "detectedAt": change.get("detectedAt") or utc_now(),
    }


def website_snapshot_to_operational_signal(competitor: dict[str, Any] | None, snapshot: dict[str, Any]) -> dict[str, Any]:
    competitor_id = competitor.get("id") if competitor else ""
    competitor_name = competitor.get("name") if competitor else "竞品"
    themes = "、".join(snapshot.get("keywords") or []) or "页面文案/结构"
    title = snapshot.get("title") or snapshot.get("h1") or title_from_url(snapshot.get("url", ""))
    return {
        "id": f"op-website-snapshot-{competitor_id}-{hash_text(str(snapshot.get('url')))[:8]}",
        "competitorId": competitor_id,
        "type": "官网动作",
        "source": "Official Website",
        "impact": "Medium" if set(snapshot.get("keywords") or []) & {"价格/套餐", "折扣", "下载入口", "免费试用"} else "Low",
        "title": f"{competitor_name} 官网重点页进入监控：{title}",
        "url": snapshot.get("url") or "",
        "summary": f"当前页面主题：{themes}。{snapshot.get('description') or snapshot.get('h1') or snapshot.get('url') or ''}",
        "recommendation": "作为官网监控基线，后续页面标题、主张、价格/下载入口变化会进入推广动作时间线。",
        "time": "监控基线",
        "detectedAt": snapshot.get("collectedAt") or utc_now(),
    }


def content_change_to_operational_signal(change: dict[str, Any]) -> dict[str, Any]:
    competitor_name = change.get("competitorName") or "竞品"
    published = change.get("publishedDate")
    title = change.get("title") or title_from_url(change.get("url", ""))
    ranked = change.get("rankedKeywords") or []
    if published and is_recent_iso(published, days=7):
        action_title = f"{competitor_name} 发布新内容：{title}"
        time_label = published
        impact = "High"
        summary_prefix = f"识别到近 7 天内容更新，发布时间 {published}。"
    else:
        action_title = f"{competitor_name} 新发现内容资产：{title}"
        time_label = "首次发现"
        impact = "Medium" if ranked else "Low"
        summary_prefix = "本次采集首次发现该内容资产，尚未确认真实发布日期。"
    serp_text = f"已进入 {len(ranked)} 个监控 SERP。" if ranked else "暂未进入监控 SERP。"
    return {
        "id": f"op-content-{change.get('competitorId')}-{hash_text(change.get('url') or title)[:8]}",
        "competitorId": change.get("competitorId"),
        "type": "内容动作",
        "source": "Website Content",
        "impact": impact,
        "title": action_title,
        "url": change.get("url") or "",
        "summary": f"{summary_prefix}{serp_text}来源列表页：{change.get('sourceUrl') or '未记录'}",
        "recommendation": "复核标题、目标关键词、CTA 和竞品主张，判断 Awesun 是否需要跟进同类选题或对比页。",
        "time": time_label,
        "detectedAt": change.get("detectedAt") or utc_now(),
    }


def content_item_to_operational_signal(item: dict[str, Any]) -> dict[str, Any]:
    competitor_name = item.get("competitorName") or "竞品"
    title = item.get("title") or title_from_url(item.get("url", ""))
    published = item.get("publishedDate")
    ranked = item.get("rankedKeywords") or []
    date_text = f"识别到发布时间 {published}。" if published else "未识别到明确发布时间，按内容资产基线展示。"
    serp_text = f"已进入 {len(ranked)} 个监控 SERP。" if ranked else "暂未进入监控 SERP。"
    return {
        "id": f"op-content-item-{item.get('competitorId')}-{hash_text(item.get('url') or title)[:8]}",
        "competitorId": item.get("competitorId"),
        "type": "内容动作",
        "source": "Website Content",
        "impact": "Medium" if ranked else "Low",
        "title": f"{competitor_name} 内容资产进入监控：{title}",
        "url": item.get("url") or "",
        "summary": f"{date_text}{serp_text}来源列表页：{item.get('sourceUrl') or '未记录'}",
        "recommendation": "把该内容作为竞品内容库基线，后续新增、改版或进入 Google 搜索结果时再升级为重点动作。",
        "time": published or "监控基线",
        "detectedAt": item.get("publishedDate") or item.get("collectedAt") or utc_now(),
    }


def review_to_operational_signal(review: dict[str, Any], competitor_names: dict[str, str]) -> dict[str, Any]:
    competitor_id = review.get("competitorId")
    competitor_name = competitor_names.get(competitor_id, "竞品")
    rating = review.get("rating")
    version = review.get("version")
    summary = review.get("summary") or ""
    low_rating = (rating or 5) <= 2
    pain_point = infer_review_pain_point(summary)
    title = (
        f"{competitor_name} 出现低星评论：{pain_point}"
        if low_rating
        else f"{competitor_name} 新增 Google Play 用户反馈"
    )
    meta = "；".join(
        value
        for value in (
            f"版本 {version}" if version else "",
            f"评分 {rating} 星" if rating is not None else "",
            f"评论日期 {display_date(review.get('publishedAt'))}" if review.get("publishedAt") else "",
        )
        if value
    )
    return {
        "id": f"op-review-{competitor_id}-{hash_text(summary + str(review.get('publishedAt')))[:8]}",
        "competitorId": competitor_id,
        "type": "口碑动作",
        "source": "Google Play",
        "impact": "High" if low_rating else "Medium",
        "title": title,
        "url": "",
        "summary": f"{meta}。{summary}（来源：Google Play scraper，暂无直达链接）",
        "recommendation": "提取用户痛点，判断是否可用于 Awesun 商店文案、FAQ、对比页或投放反击素材。",
        "time": display_date(review.get("publishedAt")) or "未知日期",
        "detectedAt": review.get("publishedAt") or utc_now(),
        "sourceNote": "来源：Google Play scraper，暂无直达链接",
    }


def serp_change_to_operational_signal(change: dict[str, Any]) -> dict[str, Any]:
    market_label = {"US": "美国", "TW": "台湾", "Global": "全球"}.get(change.get("market"), change.get("market"))
    competitor_name = change.get("competitorName") or "竞品"
    keyword = change.get("keyword") or ""
    change_type = change.get("type")
    title_map = {
        "baseline": "建立搜索基线",
        "new": "新增搜索结果",
        "gone": "搜索结果消失",
        "up": "搜索排名上升",
        "down": "搜索排名下降",
        "title_changed": "搜索标题变化",
    }
    position_text = (
        f"当前位置 {change.get('currentPosition')}"
        if change_type == "baseline"
        else f"位置 {change.get('previousPosition')} -> {change.get('currentPosition')}"
    )
    return {
        "id": f"op-serp-{change.get('competitorId')}-{change.get('market')}-{hash_text(keyword + str(change.get('url')) + str(change_type))[:8]}",
        "competitorId": change.get("competitorId"),
        "market": change.get("market"),
        "type": "搜索动作",
        "source": "Google SERP",
        "impact": change.get("impact") or "Medium",
        "title": f"{competitor_name} 在 {market_label} Google {title_map.get(change_type, '搜索结果变化')}",
        "url": change.get("url") or "",
        "summary": f"关键词 {keyword}，结果「{change.get('title') or change.get('url')}」{position_text}。",
        "recommendation": "复核该结果是否影响品牌词、竞品对比词或下载转化路径，必要时调整 Awesun 内容页和投放关键词。",
        "time": "搜索基线" if change_type == "baseline" else display_date(change.get("detectedAt")) or "本次采集",
        "detectedAt": change.get("detectedAt") or utc_now(),
    }


def infer_review_pain_point(text: str) -> str:
    lower = text.lower()
    rules = [
        ("login", "登录体验"),
        ("slow", "速度慢"),
        ("lag", "延迟卡顿"),
        ("disconnect", "连接中断"),
        ("freeze", "卡死"),
        ("crash", "崩溃"),
        ("account", "账号限制"),
        ("free", "免费限制"),
        ("price", "价格/套餐"),
        ("support", "客服支持"),
    ]
    for needle, label in rules:
        if needle in lower:
            return label
    return "用户体验问题"


def collect_apps(competitors: list[dict[str, Any]], review_count: int) -> dict[str, Any]:
    statuses: dict[str, str] = {}
    metrics: dict[str, dict[str, Any]] = {}
    review_signals: list[dict[str, Any]] = []

    ios_count = 0
    ios_errors = 0
    gp_count = 0
    gp_errors = 0

    for competitor in competitors:
        app_store = competitor.get("appStore", {})
        ios_app_id = str(app_store.get("iosAppId") or "").strip()
        google_package = str(app_store.get("googlePackage") or "").strip()
        country = str(app_store.get("country") or "US").lower()
        language = str(app_store.get("language") or "en").lower()

        if ios_app_id:
            try:
                ios_meta = collect_ios_metadata(ios_app_id, country)
                if ios_meta:
                    metrics[competitor["id"]] = {
                        **metrics.get(competitor["id"], {}),
                        **ios_meta,
                    }
                reviews = collect_ios_reviews(competitor, ios_app_id, country, review_count)
                review_signals.extend(reviews)
                ios_count += 1
            except Exception as exc:  # noqa: BLE001
                ios_errors += 1
                review_signals.append(review_error_signal(competitor, "App Store", str(exc)))

        if google_package:
            try:
                gp_meta, reviews = collect_google_play(competitor, google_package, language, country, review_count)
                metrics[competitor["id"]] = {
                    **metrics.get(competitor["id"], {}),
                    **gp_meta,
                }
                review_signals.extend(reviews)
                gp_count += 1
            except Exception as exc:  # noqa: BLE001
                gp_errors += 1
                review_signals.append(review_error_signal(competitor, "Google Play", str(exc)))

    statuses["appStoreScraper"] = app_status("ok_ios_apps", ios_count, ios_errors)
    statuses["googlePlayScraper"] = app_status("ok_google_apps", gp_count, gp_errors)
    if ios_count == 0 and ios_errors == 0:
        statuses["appStoreScraper"] = "skipped_no_ios_app_ids"
    if gp_count == 0 and gp_errors == 0:
        statuses["googlePlayScraper"] = "skipped_no_google_packages"

    return {
        "statuses": statuses,
        "metrics": metrics,
        "reviewSignals": review_signals,
    }


def collect_ios_metadata(app_id: str, country: str) -> dict[str, Any]:
    data = fetch_json("https://itunes.apple.com/lookup", {"id": app_id, "country": country})
    results = data.get("results") or []
    if not results:
        return {}
    app = results[0]
    return {
        "rating": round_float(app.get("averageUserRating"), 1),
        "reviews": app.get("userRatingCount"),
        "version": app.get("version"),
        "lastReleaseDate": app.get("currentVersionReleaseDate"),
    }


def collect_ios_reviews(
    competitor: dict[str, Any],
    app_id: str,
    country: str,
    review_count: int,
) -> list[dict[str, Any]]:
    try:
        from app_store_scraper import AppStore  # type: ignore
    except ImportError:
        return [review_error_signal(competitor, "App Store", "missing package: app-store-scraper")]

    app = AppStore(country=country, app_name=competitor["name"], app_id=app_id)
    app.review(how_many=review_count)
    signals = []
    for review in app.reviews[:review_count]:
        signals.append(
            {
                "competitorId": competitor["id"],
                "source": "App Store",
                "title": review.get("title") or "iOS review",
                "summary": review.get("review") or "",
                "rating": review.get("rating"),
                "publishedAt": to_iso(review.get("date")),
            }
        )
    return signals


def collect_google_play(
    competitor: dict[str, Any],
    package_name: str,
    language: str,
    country: str,
    review_count: int,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        from google_play_scraper import Sort, app, reviews  # type: ignore
    except ImportError:
        return {}, [review_error_signal(competitor, "Google Play", "missing package: google-play-scraper")]

    detail = app(package_name, lang=language, country=country)
    review_rows, _ = reviews(package_name, lang=language, country=country, sort=Sort.NEWEST, count=review_count)
    metrics = {
        "rating": round_float(detail.get("score"), 1),
        "reviews": detail.get("reviews"),
        "version": detail.get("version"),
        "lastReleaseDate": to_iso(detail.get("updated")),
    }
    signals = [
        {
            "competitorId": competitor["id"],
            "source": "Google Play",
            "title": review_title("Google Play", row.get("score")),
            "summary": row.get("content") or "",
            "rating": row.get("score"),
            "version": row.get("reviewCreatedVersion"),
            "publishedAt": to_iso(row.get("at")),
            "sourceNote": "来源：Google Play scraper，暂无直达链接",
        }
        for row in review_rows
        if is_recent_iso(to_iso(row.get("at")), days=7)
    ]
    return metrics, signals


def collect_youtube(competitors: list[dict[str, Any]]) -> dict[str, Any]:
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        return {"status": "not_configured", "socialSignals": []}

    configured = [
        competitor
        for competitor in competitors
        if (competitor.get("social", {}).get("youtubeChannelId") or "").strip()
    ]
    if not configured:
        return {"status": "skipped_no_channels", "socialSignals": []}

    published_after = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=3)).isoformat().replace("+00:00", "Z")
    signals = []
    errors = 0

    for competitor in configured:
        channel_id = competitor["social"]["youtubeChannelId"].strip()
        try:
            data = fetch_json(
                "https://www.googleapis.com/youtube/v3/search",
                {
                    "part": "snippet",
                    "channelId": channel_id,
                    "type": "video",
                    "order": "date",
                    "publishedAfter": published_after,
                    "maxResults": "10",
                    "key": api_key,
                },
            )
        except Exception as exc:  # noqa: BLE001
            errors += 1
            signals.append(social_error_signal(competitor, "YouTube", str(exc)))
            continue

        for item in data.get("items", []):
            video_id = (item.get("id") or {}).get("videoId")
            snippet = item.get("snippet") or {}
            signals.append(
                {
                    "competitorId": competitor["id"],
                    "source": "YouTube",
                    "title": snippet.get("title"),
                    "summary": snippet.get("description"),
                    "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else "",
                    "publishedAt": snippet.get("publishedAt"),
                }
            )

    status = f"ok_posts_{len([s for s in signals if s.get('source') == 'YouTube'])}"
    if errors:
        status += f"_errors_{errors}"
    return {"status": status, "socialSignals": signals}


def collect_serp_ads(data: dict[str, Any]) -> list[dict[str, Any]]:
    results = []
    for key in ("ads", "ad_results", "top_ads", "bottom_ads", "inline_ads"):
        value = data.get(key)
        if isinstance(value, list):
            results.extend(value)
    return results


def best_rank_for_domains(results: list[dict[str, Any]], domains: list[str]) -> int | None:
    cleaned = [normalize_domain(domain) for domain in domains if domain]
    for item in results:
        haystack = " ".join(
            str(item.get(key, "")) for key in ("link", "displayed_link", "source", "domain")
        ).lower()
        if any(domain and domain in haystack for domain in cleaned):
            return item.get("position")
    return None


def find_competitor_for_url(competitors: list[dict[str, Any]], value: str) -> dict[str, Any] | None:
    lower = value.lower()
    for competitor in competitors:
        domains = competitor.get("domains") or [domain_from_url(competitor.get("website", ""))]
        if any(normalize_domain(domain) in lower for domain in domains):
            return competitor
    return None


def fetch_json(base_url: str, params: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = f"{base_url}?{query}" if query else base_url
    request = urllib.request.Request(url, headers={"User-Agent": "AwesunFreeCollector/0.1"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_text(url: str, timeout: int = 20) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "AwesunFreeCollector/0.1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="ignore")


def merge_metrics(base: dict[str, dict[str, Any]], patch: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    merged = {key: dict(value) for key, value in base.items()}
    for competitor_id, values in patch.items():
        merged[competitor_id] = {**merged.get(competitor_id, {}), **drop_none(values)}
    return merged


def merge_unique(items: list[dict[str, Any]], key_fn) -> list[dict[str, Any]]:
    seen = set()
    output = []
    for item in items:
        key = key_fn(item)
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def review_to_market_signals(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    signals = []
    for item in items:
        if not (item.get("summary") or item.get("title")):
            continue
        published_at = item.get("publishedAt")
        source_note = item.get("sourceNote") if not item.get("url") else ""
        summary = item.get("summary") or ""
        version = item.get("version")
        rating = item.get("rating")
        prefix = "；".join(
            value
            for value in (
                f"版本：{version}" if version else "",
                f"评分：{rating} 星" if rating is not None else "",
            )
            if value
        )
        if prefix and prefix not in summary:
            summary = f"{prefix}。{summary}".strip()
        if source_note and source_note not in summary:
            summary = f"{summary}（{source_note}）".strip()
        signals.append(
            {
                "id": f"review-{item.get('source', '').lower().replace(' ', '-')}-{item.get('competitorId')}-{hash_text(item.get('summary') or item.get('title') or '')[:8]}",
                "competitorId": item.get("competitorId"),
                "type": "口碑舆情",
                "source": item.get("source"),
                "impact": "High" if (item.get("rating") or 5) <= 2 else "Medium",
                "title": item.get("title") or "发现新评论",
                "url": item.get("url") or "",
                "summary": summary,
                "recommendation": "提取用户痛点，判断是否可用于 Awesun 商店文案、FAQ 或投放反击素材。",
                "time": display_date(published_at) or "未知日期",
                "detectedAt": published_at or utc_now(),
            }
        )
    return signals


def review_title(source: str, rating: Any) -> str:
    try:
        score = int(rating)
    except (TypeError, ValueError):
        score = 0
    if score and score <= 2:
        return f"{source} 低星评论"
    return f"{source} 新评论"


def social_to_market_signals(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": f"social-{item.get('source', '').lower()}-{item.get('competitorId')}-{hash_text(item.get('url') or item.get('title') or '')[:8]}",
            "competitorId": item.get("competitorId"),
            "type": "社媒/PR",
            "source": item.get("source"),
            "impact": "Medium",
            "title": item.get("title") or "发现新社媒动态",
            "url": item.get("url") or "",
            "summary": item.get("summary") or item.get("url") or "",
            "recommendation": "复核内容主题和互动表现，判断是否跟进社媒、PR 或内容选题。",
            "time": "今日",
            "detectedAt": item.get("publishedAt") or utc_now(),
        }
        for item in items
        if item.get("title") or item.get("summary")
    ]


def build_free_insights(
    keyword_insights: list[dict[str, Any]],
    creative_themes: list[dict[str, Any]],
    social_signals: list[dict[str, Any]],
    review_signals: list[dict[str, Any]],
    serp_changes: list[dict[str, Any]] | None = None,
    content_changes: list[dict[str, Any]] | None = None,
) -> list[dict[str, str]]:
    high_keywords = [item for item in keyword_insights if item.get("opportunity") == "High"]
    negative_reviews = [item for item in review_signals if (item.get("rating") or 5) <= 2]
    high_serp_changes = [item for item in (serp_changes or []) if item.get("impact") == "High"]
    ranked_content = [item for item in (content_changes or []) if item.get("rankedKeywords")]
    return [
        {
            "title": "免费 SERP 监控",
            "level": "High" if high_keywords else "Medium",
            "body": f"SerpApi 当前识别到 {len(high_keywords)} 个高优先级关键词机会、{len(high_serp_changes)} 条高优先级搜索结果变化；优先复核品牌词和竞品词前 20 条。",
        },
        {
            "title": "免费广告素材监控",
            "level": "High" if creative_themes else "Low",
            "body": f"当前累计 {len(creative_themes)} 条 Google SERP 广告素材，可用于提炼竞品 CTA、价格和场景主张。",
        },
        {
            "title": "内容产出与效果",
            "level": "High" if content_changes else "Medium",
            "body": f"当前发现 {len(content_changes or [])} 条新增内容，其中 {len(ranked_content)} 条已在监控 SERP 中出现；优先跟进进入前 20 的竞品内容。",
        },
        {
            "title": "免费商店与社媒监控",
            "level": "High" if negative_reviews or social_signals else "Medium",
            "body": f"当前累计 {len(review_signals)} 条评论和 {len(social_signals)} 条 YouTube 动态；低星评论可沉淀为 Awesun 反击卖点。",
        },
    ]


def build_sentiment_pain_points(items: list[dict[str, Any]]) -> list[str]:
    text = " ".join(str(item.get("summary") or "") for item in items).lower()
    rules = [
        ("slow", "速度慢"),
        ("lag", "延迟"),
        ("disconnect", "连接中断"),
        ("crash", "崩溃"),
        ("price", "价格"),
        ("expensive", "价格高"),
        ("support", "客服支持"),
        ("security", "安全担忧"),
        ("mobile", "移动端体验"),
        ("permission", "权限复杂"),
    ]
    return [label for needle, label in rules if needle in text]


def dedupe_recent_signals(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    newest = []
    for item in reversed(items):
        key = signal_key(item)
        if key in seen:
            continue
        seen.add(key)
        newest.append(item)
    newest.sort(key=signal_sort_value, reverse=True)
    return newest[:200]


def signal_sort_value(item: dict[str, Any]) -> str:
    value = item.get("detectedAt") or item.get("publishedAt") or item.get("time") or ""
    parsed = parse_iso_date(value)
    return parsed.isoformat() if parsed else str(value)


def strip_runtime_config(competitors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    hidden = {"websitePages", "appStore", "meta", "social"}
    return [{key: value for key, value in competitor.items() if key not in hidden} for competitor in competitors]


def score_opportunity(awesun_rank: int | None, competitor_rank: int | None) -> str:
    if not competitor_rank:
        return "Medium"
    if not awesun_rank or awesun_rank - competitor_rank >= 8:
        return "High"
    if awesun_rank > competitor_rank:
        return "Medium"
    return "Low"


def infer_keyword_intent(keyword: str) -> str:
    if any(token in keyword.lower() for token in ("free", "trial")):
        return "免费试用"
    if any(token in keyword.lower() for token in ("business", "support", "unattended")):
        return "B2B采购"
    if any(token in keyword.lower() for token in ("software", "alternative")):
        return "购买比较"
    return "泛搜索"


def integration_error_signal(competitor_id: str, source: str, message: str) -> dict[str, Any]:
    return {
        "id": f"integration-{competitor_id}-{hash_text(source + message)[:8]}",
        "competitorId": competitor_id,
        "type": "数据源异常",
        "source": source,
        "impact": "Low",
        "title": f"{source} 数据采集失败",
        "summary": message[:160],
        "recommendation": "检查 API key、请求额度、配置字段或网络状态。",
        "time": "今日",
        "detectedAt": utc_now(),
    }


def review_error_signal(competitor: dict[str, Any], source: str, message: str) -> dict[str, Any]:
    return {
        "competitorId": competitor["id"],
        "source": source,
        "title": f"{competitor['name']} {source} 评论采集失败",
        "summary": message[:160],
        "rating": None,
        "publishedAt": utc_now(),
    }


def social_error_signal(competitor: dict[str, Any], source: str, message: str) -> dict[str, Any]:
    return {
        "competitorId": competitor["id"],
        "source": source,
        "title": f"{competitor['name']} {source} 动态采集失败",
        "summary": message[:160],
        "url": "",
        "publishedAt": utc_now(),
    }


def app_status(prefix: str, count: int, errors: int) -> str:
    status = f"{prefix}_{count}"
    if errors:
        status += f"_errors_{errors}"
    return status


def creative_key(item: dict[str, Any]) -> str:
    return "|".join(str(item.get(key, "")) for key in ("competitorId", "channel", "title", "copy"))


def signal_key(item: dict[str, Any]) -> str:
    return "|".join(str(item.get(key, "")) for key in ("competitorId", "source", "summary", "url"))


def review_signal_key(item: dict[str, Any]) -> str:
    return "|".join(str(item.get(key, "")) for key in ("competitorId", "source", "summary", "publishedAt"))


def build_serp_key(market: str, competitor_id: str, keyword: str) -> str:
    return f"{market}|{competitor_id}|{keyword}"


def normalize_url(value: str | None) -> str:
    if not value:
        return ""
    parsed = urllib.parse.urlparse(value)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/")
    return urllib.parse.urlunparse((scheme, netloc, path, "", "", ""))


def clean_compare(value: str | None) -> str:
    return " ".join(str(value or "").lower().split())


def parse_iso_date(value: Any) -> dt.date | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return dt.datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        detected = detect_content_published_date(text)
        if detected:
            return dt.date.fromisoformat(detected)
    return None


def is_recent_iso(value: Any, days: int) -> bool:
    parsed = parse_iso_date(value)
    if not parsed:
        return False
    today = dt.datetime.now(dt.timezone.utc).date()
    return dt.timedelta(days=0) <= today - parsed <= dt.timedelta(days=days)


def display_date(value: Any) -> str | None:
    parsed = parse_iso_date(value)
    return parsed.isoformat() if parsed else None


def clean_html(value: str) -> str:
    import re

    text = re.sub(r"<[^>]+>", " ", value)
    text = text.replace("&amp;", "&").replace("&nbsp;", " ").replace("&quot;", '"')
    return " ".join(text.split())


def title_from_url(url: str) -> str:
    path = urllib.parse.urlparse(url).path.strip("/")
    if not path:
        return url
    return path.split("/")[-1].replace("-", " ").replace("_", " ").title()


def normalize_domain(value: str) -> str:
    value = str(value or "").lower()
    value = value.replace("https://", "").replace("http://", "")
    value = value.removeprefix("www.")
    return value.split("/")[0]


def domain_from_url(value: str) -> str:
    try:
        parsed = urllib.parse.urlparse(value)
        return parsed.netloc.removeprefix("www.")
    except Exception:
        return ""


def drop_none(values: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if value is not None}


def round_float(value: Any, digits: int) -> float | None:
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return None


def to_iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, dt.datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return value.isoformat()
    if isinstance(value, (int, float)):
        try:
            return dt.datetime.fromtimestamp(value, tz=dt.timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return None
    return str(value)


def hash_text(value: str) -> str:
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(path: Path, default: Any | None = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        if default is not None:
            return default
        raise


if __name__ == "__main__":
    raise SystemExit(main())
