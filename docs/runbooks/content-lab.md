# Runbook — Content Lab (Rome's content autopilot)

Owner-only tab `/team/content-lab`. Built in phases; each phase is verified before the next starts.

| Phase | Status | What |
|---|---|---|
| 1 | **Live (2026-10-19)** | Trend Radar + Pattern Analyzer — read-only, no video processing, nothing posts |
| 2 | Not started | Clip Factory review screen (upload, $0 transcription, clip proposals, manual approval) |
| 3 | Not started | Auto-edit (FFmpeg cuts, burned captions, hook overlay) + Publish Queue with approval gate |

## Phase 1 — how it works
- **Data ($0, official API):** `lib/contentLab/instagram.ts`. Competitor accounts via Business Discovery (last 25 posts of each Business/Creator account). Niche hashtags via Hashtag Search `top_media` — Meta caps one IG account at **30 unique hashtags per rolling 7 days** (`allowedHashtags` enforces it; re-querying a tag within the week is free) and requires the **Instagram Public Content Access** feature on the Meta app. Rome's own posts via `/{ig-user}/media`.
- **Token:** the team owner's Meta connection (`integration_connections` provider `meta`). Scopes added: `instagram_basic`, `instagram_manage_insights` (plus existing `pages_show_list`, `pages_read_engagement`). **Rome must reconnect Meta** in Integrations after this change for the new scopes. The Meta app needs the Instagram Graph API product; in Development mode it works for app admins/testers without App Review.
- **Scoring (pure, tested):** `lib/contentLab/analyze.ts` — hook = first meaningful caption line; hook type (question, number/list, contrarian, how-to, curiosity gap, POV, build story, result claim); CTA incl. comment keyword; hashtags; format from media type (talking head / screen recording can't be read from the API → Rome tags reels by hand); velocity = (likes+comments)/hours since posting (1h floor). "Why it's working" lists only computed facts (velocity vs niche median, comment ratio, CTA, hook type, hook length).
- **Patterns:** `lib/contentLab/patterns.ts` — medians by hook type, CTA (comments; **saves are not public for other accounts**), format, ET post hour, top-quartile hashtags, comment keywords; groups with < 3 posts never "win". Testable variables: hook text, CTA keyword, hashtags, thumbnail frame (by eye — not in the API), post time. Packaging principle (Rome's @angus.sewell observation: identical clips 23 → 11,865 likes) shown on top.
- **Refresh:** daily, riding on the existing daily `plan-refill` cron (`contentLab` in its JSON result), plus "Refresh now". Result in `content_lab_settings.last_result` (per-account and per-hashtag errors).
- **Tables:** migration `20261019_content_lab.sql` — `content_lab_settings`, `content_watch_accounts`, `content_posts`, `content_post_snapshots` (owner-only RLS). **Apply it in Supabase before the tab works** (the tab says "Database setup pending" until then).
- **API:** `GET/POST /api/team/content-lab` (owner only): `save_niches`, `add_account`, `remove_account`, `toggle_account`, `tag_format`, `refresh`.
