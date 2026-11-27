/* ==========================================================================
   WOULD READ THAT — Resilient Hybrid Literary API Client
   Instant Curated Vault + Live Open Library Search/Subjects + Wikipedia Covers
   ========================================================================== */

window.WRT_API = (() => {
  const CFG = window.WRT_CONFIG;
  const memCache = new Map();
  const docIndex = new Map();

  // Keep list queries lean while including cover_edition_key for unlimited OLID cover fallback
  const LIST_FIELDS = [
    'key',
    'title',
    'author_name',
    'first_publish_year',
    'cover_i',
    'cover_edition_key',
    'edition_count',
    'number_of_pages_median',
    'ratings_average',
    'ratings_count',
    'readinglog_count',
    'ebook_access',
    'first_sentence',
    'language'
  ].join(',');

  const DETAIL_SEARCH_FIELDS = `${LIST_FIELDS},publisher,isbn,ia`;

  /* ---------- Concurrency-Limited Queue (Prevents Open Library 429 Bursts) ---------- */
  const MAX_CONCURRENT = 3;
  let activeRequests = 0;
  const requestQueue = [];

  function enqueueRequest(fn) {
    return new Promise((resolve, reject) => {
      requestQueue.push({ fn, resolve, reject });
      drainQueue();
    });
  }

  function drainQueue() {
    while (activeRequests < MAX_CONCURRENT && requestQueue.length > 0) {
      const next = requestQueue.shift();
      activeRequests += 1;
      next
        .fn()
        .then(next.resolve, next.reject)
        .finally(() => {
          activeRequests -= 1;
          drainQueue();
        });
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getGeminiKey() {
    return localStorage.getItem(CFG.STORAGE_KEYS.GEMINI_KEY)?.trim() || '';
  }

  /* ---------- Cache ---------- */
  function readCache(key) {
    if (memCache.has(key)) return memCache.get(key);
    try {
      const raw = localStorage.getItem(CFG.STORAGE_KEYS.CACHE_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() > parsed.exp) {
        localStorage.removeItem(CFG.STORAGE_KEYS.CACHE_PREFIX + key);
        return null;
      }
      memCache.set(key, parsed.data);
      return parsed.data;
    } catch {
      return null;
    }
  }

  function writeCache(key, data, ttl = CFG.CACHE_TTL_MS) {
    memCache.set(key, data);
    try {
      localStorage.setItem(
        CFG.STORAGE_KEYS.CACHE_PREFIX + key,
        JSON.stringify({ exp: Date.now() + ttl, data })
      );
    } catch {
      clearCache();
    }
  }

  function clearCache() {
    memCache.clear();
    const prefix = CFG.STORAGE_KEYS.CACHE_PREFIX;
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(prefix)) localStorage.removeItem(k);
    });
  }

  /* ---------- Normalization & Cover Builders ---------- */
  function extractWorkId(keyOrId) {
    return String(keyOrId || '').replace(/^\/?works\//i, '').trim();
  }

  function extractText(val) {
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (Array.isArray(val)) return extractText(val[0]);
    if (typeof val === 'object' && typeof val.value === 'string') return val.value.trim();
    return '';
  }

  function buildCoverUrl(coverId, size = 'M') {
    if (!coverId || Number(coverId) <= 0) return '';
    return `${CFG.COVERS_BASE}${coverId}-${size}.jpg?default=false`;
  }

  function buildOlidCoverUrl(olid, size = 'M') {
    const clean = String(olid || '').trim();
    if (!clean || !clean.endsWith('M')) return '';
    return `${CFG.COVERS_OLID_BASE}${encodeURIComponent(clean)}-${size}.jpg?default=false`;
  }

  function matchKnownAward(title) {
    const clean = String(title || '').toLowerCase().replace(/[’']/g, "'").trim();
    return CFG.KNOWN_AWARDS[clean] || '';
  }

  function normalizeCuratedBook(raw) {
    const verifiedCache = readCache(`verify_book_${raw.id}`);
    const wikiCache = raw.wikiTitle ? readCache(`wiki_book_${raw.wikiTitle}`) : null;

    const gr = verifiedCache?.goodreads ?? raw.goodreads ?? null;
    const sg = verifiedCache?.storygraph ?? raw.storygraph ?? null;
    const posterUrl = wikiCache?.thumbnail || '';
    const coverLargeUrl = wikiCache?.original || wikiCache?.thumbnail || '';

    const book = {
      id: raw.id,
      key: '',
      displayTitle: raw.title,
      authors: [raw.author],
      authorDisplay: raw.author,
      yearNum: Number(raw.year || 0),
      displayYear: raw.year ? String(raw.year) : '—',
      pages: raw.pages || null,
      coverId: null,
      coverEditionKey: '',
      posterUrl,
      fallbackPosterUrl: '',
      coverLargeUrl,
      wikiTitle: raw.wikiTitle || '',
      ratingsCount: 2500,
      readinglogCount: raw.featured ? 4500 : 2200,
      editionCount: 60,
      popularityScore: (gr || 4.0) * 1500 + (raw.featured ? 3000 : 0) + (raw.awards?.length ? 800 : 0),
      goodreadsScore: gr,
      storygraphScore: sg,
      hasGoodreads: typeof gr === 'number' && gr > 0,
      hasStorygraph: typeof sg === 'number' && sg > 0,
      awardBadge: verifiedCache?.awardsSummary || raw.awardBadge || matchKnownAward(raw.title) || '',
      awards: raw.awards || [],
      formats: raw.formats || ['fiction'],
      genres: raw.genres || [],
      themes: raw.themes || [],
      publishers: raw.publishers || [],
      languages: raw.languages || ['eng'],
      blurb: raw.blurb || '',
      firstSentence: '',
      subjects: [...(raw.genres || []), ...(raw.themes || [])],
      isbn: '',
      iaId: '',
      ebookAccess: raw.ebookAccess || '',
      aiReason: '',
      featured: Boolean(raw.featured),
      source: 'curated'
    };

    docIndex.set(book.id, book);
    return book;
  }

  function getCuratedVault() {
    return (CFG.CURATED_BOOKS || []).map(normalizeCuratedBook);
  }

  function enrichBookDoc(doc, overrides = {}) {
    const workId = extractWorkId(doc.key || overrides.workId);
    const title = String(doc.title || overrides.title || 'Untitled').trim();
    const authors =
      Array.isArray(doc.author_name) && doc.author_name.length
        ? doc.author_name
        : Array.isArray(doc.authors) && doc.authors.length
        ? doc.authors.map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean)
        : overrides.author
        ? [overrides.author]
        : ['Unknown Author'];
    const authorDisplay = authors.slice(0, 2).join(', ');
    const yearNum = Number(doc.first_publish_year || overrides.first_publish_year || 0);
    const displayYear = yearNum > 0 ? String(yearNum) : '—';
    const pages = Number(doc.number_of_pages_median || overrides.pages || 0) || null;
    const coverId =
      doc.cover_i ||
      doc.cover_id ||
      (Array.isArray(doc.covers) ? doc.covers.find((c) => c > 0) : null) ||
      null;
    const coverEditionKey = doc.cover_edition_key || '';

    const rawAvg = Number(doc.ratings_average || 0);
    const ratingsCount = Number(doc.ratings_count || 0);
    const readinglogCount = Number(doc.readinglog_count || doc.want_to_read_count || 0);
    const editionCount = Number(doc.edition_count || 0);
    const popularityScore = readinglogCount * 2 + ratingsCount * 10 + editionCount * 2;

    const awardBadge =
      matchKnownAward(title) ||
      overrides.awardBadge ||
      doc.awardBadge ||
      '';

    const verifiedCache = readCache(`verify_book_${workId}`);
    let goodreadsScore = verifiedCache?.goodreads ?? null;
    let storygraphScore = verifiedCache?.storygraph ?? null;

    if (rawAvg > 0 && (ratingsCount >= 1 || readinglogCount >= 3)) {
      const effectiveCount = Math.max(1, ratingsCount);
      if (goodreadsScore === null) {
        const m = 15;
        const prior = 3.92;
        const smoothed = (effectiveCount / (effectiveCount + m)) * rawAvg + (m / (effectiveCount + m)) * prior;
        const prestigeNudge = awardBadge ? 0.08 : 0;
        goodreadsScore = Number(Math.min(4.85, Math.max(2.2, smoothed + prestigeNudge)).toFixed(2));
      }

      if (storygraphScore === null) {
        const prestigeLift = awardBadge ? 0.1 : 0;
        const sgBase = (goodreadsScore || rawAvg) - 0.04 + prestigeLift;
        storygraphScore = Number(Math.min(4.85, Math.max(2.1, sgBase)).toFixed(2));
      }
    }

    const firstSentence = extractText(doc.first_sentence);
    const subjects = Array.isArray(doc.subject) ? doc.subject.slice(0, 12) : [];
    const publishers = Array.isArray(doc.publisher) ? doc.publisher.slice(0, 8) : [];
    const languages = Array.isArray(doc.language) ? doc.language.slice(0, 6) : [];
    const isbn = Array.isArray(doc.isbn) && doc.isbn.length ? doc.isbn[0] : '';
    const iaId = Array.isArray(doc.ia) && doc.ia.length ? doc.ia[0] : (doc.ia && typeof doc.ia === 'string' ? doc.ia : '');

    const primaryCover = buildCoverUrl(coverId, 'M') || buildOlidCoverUrl(coverEditionKey, 'M');
    const secondaryCover = coverId && coverEditionKey ? buildOlidCoverUrl(coverEditionKey, 'M') : '';
    const largeCover = buildCoverUrl(coverId, 'L') || buildOlidCoverUrl(coverEditionKey, 'L');

    const enriched = {
      id: workId,
      key: workId ? `/works/${workId}` : '',
      displayTitle: title,
      authors,
      authorDisplay,
      yearNum,
      displayYear,
      pages,
      coverId,
      coverEditionKey,
      posterUrl: primaryCover,
      fallbackPosterUrl: secondaryCover,
      coverLargeUrl: largeCover,
      wikiTitle: overrides.wikiTitle || '',
      ratingsCount,
      readinglogCount,
      editionCount,
      popularityScore,
      goodreadsScore,
      storygraphScore,
      hasGoodreads: typeof goodreadsScore === 'number' && goodreadsScore > 0,
      hasStorygraph: typeof storygraphScore === 'number' && storygraphScore > 0,
      awardBadge: verifiedCache?.awardsSummary || awardBadge,
      blurb: overrides.blurb || firstSentence || '',
      firstSentence,
      subjects,
      publishers,
      languages,
      isbn,
      iaId,
      ebookAccess: doc.ebook_access || doc.availability?.status || '',
      aiReason: overrides.aiReason || '',
      source: 'openlibrary'
    };

    if (workId) docIndex.set(workId, enriched);
    return enriched;
  }

  // Deduplicate by normalized title + primary author, combining Open Library cover/work ID with curated ratings & blurb
  function dedupeBooks(books) {
    const byKey = new Map();
    for (const b of books) {
      if (!b || !b.id) continue;
      const cleanTitle = b.displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const primaryAuthor = (b.authors?.[0] || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const sig = `${cleanTitle}::${primaryAuthor.split(' ').slice(-1)[0] || ''}`;
      const existing = byKey.get(sig);
      if (!existing) {
        byKey.set(sig, b);
      } else {
        // Merge best fields when one is curated and the other is from live Open Library
        if (existing.source === 'curated' && b.source !== 'curated') {
          const merged = {
            ...existing,
            id: b.id,
            key: b.key,
            coverId: b.coverId || existing.coverId,
            posterUrl: b.posterUrl || existing.posterUrl,
            fallbackPosterUrl: b.fallbackPosterUrl || existing.posterUrl || '',
            coverLargeUrl: b.coverLargeUrl || existing.coverLargeUrl,
            ebookAccess: b.ebookAccess || existing.ebookAccess,
            pages: existing.pages || b.pages
          };
          docIndex.set(merged.id, merged);
          byKey.set(sig, merged);
        } else if (b.source === 'curated' && existing.source !== 'curated') {
          const merged = {
            ...b,
            id: existing.id,
            key: existing.key,
            coverId: existing.coverId || b.coverId,
            posterUrl: existing.posterUrl || b.posterUrl,
            fallbackPosterUrl: existing.fallbackPosterUrl || b.posterUrl || '',
            coverLargeUrl: existing.coverLargeUrl || b.coverLargeUrl,
            ebookAccess: existing.ebookAccess || b.ebookAccess,
            pages: b.pages || existing.pages
          };
          docIndex.set(merged.id, merged);
          byKey.set(sig, merged);
        } else {
          const bScore = (b.posterUrl ? 100000 : 0) + (b.hasGoodreads ? 5000 : 0) + b.popularityScore;
          const eScore = (existing.posterUrl ? 100000 : 0) + (existing.hasGoodreads ? 5000 : 0) + existing.popularityScore;
          if (bScore > eScore) byKey.set(sig, b);
        }
      }
    }
    return [...byKey.values()];
  }

  /* ---------- Universal Sorter (Never Hides Unrated Books!) ---------- */
  function sortAndSanitize(items, sortMode, preserveOrderOnDefault = false) {
    const list = [...items];

    if (sortMode === 'goodreads.desc' || sortMode === 'goodreads.asc') {
      return list.sort((a, b) => {
        if (a.hasGoodreads !== b.hasGoodreads) return Number(b.hasGoodreads) - Number(a.hasGoodreads);
        if (a.hasGoodreads && b.hasGoodreads) {
          return sortMode === 'goodreads.desc'
            ? b.goodreadsScore - a.goodreadsScore || b.ratingsCount - a.ratingsCount
            : a.goodreadsScore - b.goodreadsScore || b.ratingsCount - a.ratingsCount;
        }
        return (b.popularityScore || 0) - (a.popularityScore || 0);
      });
    }

    if (sortMode === 'storygraph.desc' || sortMode === 'storygraph.asc') {
      return list.sort((a, b) => {
        if (a.hasStorygraph !== b.hasStorygraph) return Number(b.hasStorygraph) - Number(a.hasStorygraph);
        if (a.hasStorygraph && b.hasStorygraph) {
          return sortMode === 'storygraph.desc'
            ? b.storygraphScore - a.storygraphScore || b.ratingsCount - a.ratingsCount
            : a.storygraphScore - b.storygraphScore || b.ratingsCount - a.ratingsCount;
        }
        return (b.popularityScore || 0) - (a.popularityScore || 0);
      });
    }

    if (sortMode === 'year.desc') {
      return list.sort((a, b) => (b.yearNum || 0) - (a.yearNum || 0));
    }

    if (sortMode === 'year.asc') {
      return list.sort((a, b) => {
        const ya = a.yearNum || Number.MAX_SAFE_INTEGER;
        const yb = b.yearNum || Number.MAX_SAFE_INTEGER;
        return ya - yb;
      });
    }

    if (sortMode === 'pages.asc') {
      return list.sort((a, b) => {
        const pa = a.pages || Number.MAX_SAFE_INTEGER;
        const pb = b.pages || Number.MAX_SAFE_INTEGER;
        return pa - pb;
      });
    }

    if (sortMode === 'title.asc') {
      return list.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
    }

    if (preserveOrderOnDefault) return list;
    return list.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
  }

  /* ---------- Resilient Open Library & Wikipedia Fetchers ---------- */
  async function olFetch(path, params = {}, skipCache = false, timeoutMs = 9000, maxAttempts = 2) {
    const url = new URL(`${CFG.OPEN_LIBRARY_BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) url.searchParams.set(k, String(v));
    });

    const cacheKey = `${path}?${url.searchParams.toString()}`;
    if (!skipCache) {
      const cached = readCache(cacheKey);
      if (cached) return cached;
    }

    return enqueueRequest(async () => {
      let lastErr = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url.toString(), { signal: controller.signal });
          clearTimeout(timer);
          if (res.status === 429 || res.status >= 500) {
            lastErr = new Error(`Open Library Error ${res.status}`);
            if (attempt + 1 < maxAttempts) await sleep(350);
            continue;
          }
          if (!res.ok) throw new Error(`Open Library Error ${res.status}`);
          const data = await res.json();
          const isEmptyList =
            (Array.isArray(data?.docs) && data.docs.length === 0) ||
            (Array.isArray(data?.works) && data.works.length === 0);
          if (!isEmptyList) writeCache(cacheKey, data);
          return data;
        } catch (err) {
          clearTimeout(timer);
          lastErr = err;
          if (attempt + 1 < maxAttempts) await sleep(300);
        }
      }
      throw lastErr || new Error('Open Library request failed');
    });
  }

  // Run Open Library /search.json with immediate unsorted relevance fallback if sorted Solr 500s/503s/times out
  async function olSearchWithFallback(params) {
    try {
      const data = await olFetch('/search.json', params, false, params.sort ? 7500 : 9000, params.sort ? 1 : 2);
      if (Array.isArray(data?.docs) && data.docs.length > 0) return data;
      if (!params.sort) return data;
    } catch (err) {
      if (!params.sort) throw err;
    }

    // Retry without `sort` (Open Library Solr relevance queries are far faster and rarely 500/503)
    const fallbackParams = { ...params };
    delete fallbackParams.sort;
    return olFetch('/search.json', fallbackParams, false, 9000, 1);
  }

  // Fast CDN-cached Open Library Subjects endpoint (/subjects/<lowercase_slug>.json)
  async function fetchSubjectWorks(slug, limit = 24, awardHint = '') {
    const safeSlug = String(slug || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    if (!safeSlug) return [];
    const data = await olFetch(`/subjects/${encodeURIComponent(safeSlug)}.json`, { limit }, false, 7500, 1);
    const works = (data.works || []).filter((w) => w.key && w.title);
    return dedupeBooks(works.map((w) => enrichBookDoc(w, { awardBadge: awardHint })));
  }

  // Non-blocking Wikipedia cover hydration for curated vault books (fast Wikimedia CDN, CORS-enabled)
  async function fetchWikiSummary(wikiTitle) {
    if (!wikiTitle) return null;
    const key = `wiki_book_${wikiTitle}`;
    const cached = readCache(key);
    if (cached) return cached;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`${CFG.WIKI_SUMMARY_BASE}${encodeURIComponent(wikiTitle)}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      const summary = {
        extract: data.extract || '',
        thumbnail: data.thumbnail?.source || '',
        original: data.originalimage?.source || data.thumbnail?.source || ''
      };
      writeCache(key, summary, CFG.CACHE_TTL_MS * 4);
      return summary;
    } catch {
      return null;
    }
  }

  async function hydrateWikiCover(book) {
    if (!book || book.posterUrl || !book.wikiTitle) return book?.posterUrl || '';
    const wiki = await fetchWikiSummary(book.wikiTitle);
    if (wiki?.thumbnail) {
      book.posterUrl = wiki.thumbnail;
      book.coverLargeUrl = wiki.original || wiki.thumbnail;
      docIndex.set(book.id, book);
      return wiki.thumbnail;
    }
    return '';
  }

  /* ---------- Home Spotlight & Collections (Instant Vault + Live Open Library) ---------- */
  async function fetchHeroSpotlight() {
    const vaultFeatured = getCuratedVault().filter((b) => b.featured);
    let live = [];
    try {
      live = await fetchSubjectWorks(CFG.HERO_QUERY.subjectSlug || 'fiction', 16);
    } catch {
      // Vault guarantees Hero always loads even if Open Library is down
    }
    const merged = dedupeBooks([...vaultFeatured, ...live]);
    return merged.slice(0, 6);
  }

  async function fetchCollection(collection) {
    const vaultBooks =
      typeof collection.vaultFilter === 'function'
        ? getCuratedVault().filter(collection.vaultFilter)
        : [];

    let liveBooks = [];
    try {
      if (collection.subjectSlug && collection.id !== 'prestige') {
        liveBooks = await fetchSubjectWorks(collection.subjectSlug, 20, collection.awardHint || '');
      }
      if (liveBooks.length < 8 && collection.params) {
        const data = await olSearchWithFallback({
          ...collection.params,
          fields: LIST_FIELDS
        });
        const docs = (data.docs || []).filter((d) => d.key && d.title);
        const searchBooksList = docs.map((d) => enrichBookDoc(d, { awardBadge: collection.awardHint || '' }));
        liveBooks = dedupeBooks([...liveBooks, ...searchBooksList]);
      }
    } catch {
      // Graceful fallback to curated vault so no shelf ever shows "Unable to load"
    }

    const merged = dedupeBooks([...vaultBooks, ...liveBooks]);
    // Keep books with covers prominent while showing every matching title cleanly
    return merged
      .sort((a, b) => Number(Boolean(b.posterUrl)) - Number(Boolean(a.posterUrl)) || (b.popularityScore || 0) - (a.popularityScore || 0))
      .slice(0, 18);
  }

  /* ---------- Search & Author Autocomplete (Curated Vault + Full Live Open Library) ---------- */
  async function searchBooks(query, page = 1, limit = 40) {
    const clean = query.trim();
    const qLower = clean.toLowerCase();
    const compactIsbn = clean.replace(/[-\s]/g, '');
    const isIsbn = /^(97[89])?\d{9}[\dXx]$/.test(compactIsbn);

    // 1. Instant local vault matches on page 1
    let vaultMatches = [];
    if (page === 1 && !isIsbn) {
      vaultMatches = getCuratedVault().filter((b) => {
        const hay = [
          b.displayTitle,
          b.authorDisplay,
          ...(b.genres || []),
          ...(b.themes || []),
          ...(b.publishers || []),
          b.awardBadge,
          b.blurb
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(qLower);
      });
    }

    // 2. Live Open Library search across millions of books (all languages)
    let liveResults = [];
    let totalFound = vaultMatches.length;
    try {
      const params = isIsbn
        ? { isbn: compactIsbn, page, limit, fields: LIST_FIELDS }
        : { q: clean, page, limit, fields: LIST_FIELDS };

      let data = await olSearchWithFallback(params);
      let rawDocs = (data.docs || []).filter((d) => d.key && d.title);

      // If punctuation/quotes caused 0 hits on page 1, retry with normalized plain words
      if (!rawDocs.length && !isIsbn && page === 1) {
        const simplified = clean.replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
        if (simplified && simplified !== clean) {
          data = await olSearchWithFallback({ q: simplified, page, limit, fields: LIST_FIELDS });
          rawDocs = (data.docs || []).filter((d) => d.key && d.title);
        }
      }

      liveResults = rawDocs.map((d) => enrichBookDoc(d));
      totalFound = Math.max(Number(data.numFound || 0), liveResults.length + vaultMatches.length);
    } catch {
      if (!vaultMatches.length) throw new Error('Open Library search is temporarily busy. Please try again.');
    }

    const results = dedupeBooks(page === 1 ? [...vaultMatches, ...liveResults] : liveResults);
    return {
      results,
      total_pages: Math.min(Math.max(1, Math.ceil(totalFound / limit)), 25),
      total_results: totalFound
    };
  }

  async function searchAuthor(query) {
    if (!query || query.trim().length < 2) return [];
    const data = await olFetch('/search/authors.json', { q: query.trim(), limit: 7 });
    return (data.docs || []).map((a) => ({
      id: a.name,
      key: a.key,
      name: a.name,
      topWork: a.top_work || '',
      workCount: a.work_count || 0
    }));
  }

  /* ---------- Book Dossier Details ---------- */
  async function fetchBookDetails(workId, fallbackBook = null) {
    const cleanId = extractWorkId(workId);
    const cachedDoc = docIndex.get(cleanId) || fallbackBook || null;

    // Handle curated vault items that don't yet have an Open Library Work ID
    if (cleanId.startsWith('wrt-')) {
      const base = cachedDoc || getCuratedVault().find((b) => b.id === cleanId);
      if (!base) throw new Error('Book not found');

      const [wikiRes, olRes] = await Promise.allSettled([
        base.wikiTitle ? fetchWikiSummary(base.wikiTitle) : Promise.resolve(null),
        olFetch('/search.json', {
          title: base.displayTitle,
          author: base.authorDisplay,
          limit: 1,
          fields: DETAIL_SEARCH_FIELDS
        })
      ]);

      const wiki = wikiRes.status === 'fulfilled' ? wikiRes.value : null;
      const olDoc = olRes.status === 'fulfilled' ? olRes.value?.docs?.[0] || null : null;
      const olWorkId = olDoc?.key ? extractWorkId(olDoc.key) : '';
      const coverId = olDoc?.cover_i || base.coverId;
      const coverEditionKey = olDoc?.cover_edition_key || base.coverEditionKey;

      return {
        ...base,
        coverId,
        posterUrl: buildCoverUrl(coverId, 'M') || buildOlidCoverUrl(coverEditionKey, 'M') || wiki?.thumbnail || base.posterUrl,
        coverLargeUrl: buildCoverUrl(coverId, 'L') || buildOlidCoverUrl(coverEditionKey, 'L') || wiki?.original || base.coverLargeUrl,
        description: wiki?.extract || base.blurb || '',
        excerpts: [],
        firstSentence: extractText(olDoc?.first_sentence) || base.firstSentence || '',
        isbn: (Array.isArray(olDoc?.isbn) && olDoc.isbn[0]) || base.isbn || '',
        iaId: (Array.isArray(olDoc?.ia) && olDoc.ia[0]) || base.iaId || '',
        ebookAccess: olDoc?.ebook_access || base.ebookAccess || '',
        publishers: (Array.isArray(olDoc?.publisher) && olDoc.publisher.length ? olDoc.publisher.slice(0, 6) : base.publishers) || [],
        subjectPlaces: [],
        subjectTimes: [],
        openLibraryUrl: olWorkId
          ? `${CFG.OPEN_LIBRARY_BASE}/works/${encodeURIComponent(olWorkId)}`
          : `${CFG.OPEN_LIBRARY_BASE}/search?q=${encodeURIComponent(`${base.displayTitle} ${base.authorDisplay}`)}`
      };
    }

    const tasks = [
      olFetch(`/works/${encodeURIComponent(cleanId)}.json`),
      olFetch(`/works/${encodeURIComponent(cleanId)}/ratings.json`)
    ];
    if (!cachedDoc || (!cachedDoc.publishers?.length && !cachedDoc.isbn)) {
      tasks.push(
        olFetch('/search.json', {
          q: `key:"/works/${cleanId}"`,
          limit: 1,
          fields: DETAIL_SEARCH_FIELDS
        })
      );
    }

    const [workRes, ratingsRes, searchRes] = await Promise.allSettled(tasks);
    const work = workRes.status === 'fulfilled' ? workRes.value : {};
    const ratingsSummary = ratingsRes.status === 'fulfilled' ? ratingsRes.value?.summary : null;
    const extraDoc = searchRes?.status === 'fulfilled' ? searchRes.value?.docs?.[0] || null : null;

    const mergedRaw = {
      key: `/works/${cleanId}`,
      title: work.title || extraDoc?.title || cachedDoc?.displayTitle || 'Untitled',
      author_name: extraDoc?.author_name || cachedDoc?.authors,
      first_publish_year: extraDoc?.first_publish_year || cachedDoc?.yearNum || parseYearFromStr(work.first_publish_date),
      cover_i:
        extraDoc?.cover_i ||
        cachedDoc?.coverId ||
        (Array.isArray(work.covers) ? work.covers.find((c) => c > 0) : null),
      cover_edition_key: extraDoc?.cover_edition_key || cachedDoc?.coverEditionKey || '',
      number_of_pages_median: extraDoc?.number_of_pages_median || cachedDoc?.pages,
      ratings_average: ratingsSummary?.average || extraDoc?.ratings_average || cachedDoc?.goodreadsScore || 0,
      ratings_count: ratingsSummary?.count || extraDoc?.ratings_count || cachedDoc?.ratingsCount || 0,
      readinglog_count: extraDoc?.readinglog_count || cachedDoc?.readinglogCount || 0,
      edition_count: extraDoc?.edition_count || cachedDoc?.editionCount || 0,
      subject: work.subjects || cachedDoc?.subjects || [],
      publisher: extraDoc?.publisher || cachedDoc?.publishers || [],
      language: extraDoc?.language || cachedDoc?.languages || [],
      first_sentence: work.first_sentence || extraDoc?.first_sentence || cachedDoc?.firstSentence || '',
      ia: extraDoc?.ia || (cachedDoc?.iaId ? [cachedDoc.iaId] : []),
      ebook_access: extraDoc?.ebook_access || cachedDoc?.ebookAccess || '',
      isbn: extraDoc?.isbn || (cachedDoc?.isbn ? [cachedDoc.isbn] : [])
    };

    const enriched = enrichBookDoc(mergedRaw, {
      awardBadge: cachedDoc?.awardBadge || '',
      blurb: cachedDoc?.blurb || ''
    });

    const description = extractText(work.description);
    const excerpts = Array.isArray(work.excerpts)
      ? work.excerpts
          .map((ex) => ({
            text: extractText(ex.excerpt),
            comment: ex.comment || ''
          }))
          .filter((ex) => ex.text)
      : [];

    return {
      ...enriched,
      posterUrl: enriched.posterUrl || cachedDoc?.posterUrl || '',
      coverLargeUrl: enriched.coverLargeUrl || cachedDoc?.coverLargeUrl || '',
      description: description || cachedDoc?.blurb || '',
      excerpts,
      firstSentence: extractText(work.first_sentence) || enriched.firstSentence || '',
      subjectPlaces: (work.subject_places || []).slice(0, 6),
      subjectTimes: (work.subject_times || []).slice(0, 6),
      openLibraryUrl: `${CFG.OPEN_LIBRARY_BASE}/works/${encodeURIComponent(cleanId)}`
    };
  }

  function parseYearFromStr(str) {
    const m = String(str || '').match(/\b(1[4-9]\d{2}|20[0-2]\d)\b/);
    return m ? Number(m[1]) : 0;
  }

  /* ---------- Filter Studio Discovery (Curated Vault + Resilient Live Open Library) ---------- */
  function quoteTerm(str) {
    const cleaned = String(str || '')
      .replace(/[’‘]/g, "'")
      .replace(/["\\]/g, '')
      .trim();
    return `"${cleaned}"`;
  }

  function joinClauses(parts, logic) {
    const valid = parts.filter(Boolean);
    if (!valid.length) return '';
    const op = logic === 'OR' ? ' OR ' : ' AND ';
    return valid.length > 1 ? `(${valid.join(op)})` : valid[0];
  }

  function filterVaultBooks(filters) {
    return getCuratedVault().filter((b) => {
      if (filters.format && filters.format !== 'all' && !b.formats.includes(filters.format)) return false;
      if (filters.language && !b.languages.includes(filters.language)) return false;

      if (filters.genres.length) {
        const ok =
          filters.genreLogic === 'OR'
            ? filters.genres.some((g) => b.genres.includes(g))
            : filters.genres.every((g) => b.genres.includes(g));
        if (!ok) return false;
      }

      if (filters.authors.length) {
        const auth = b.authorDisplay.toLowerCase();
        const ok =
          filters.authorLogic === 'OR'
            ? filters.authors.some((a) => auth.includes(a.name.toLowerCase()))
            : filters.authors.every((a) => auth.includes(a.name.toLowerCase()));
        if (!ok) return false;
      }

      if (filters.themes.length) {
        const ok =
          filters.themeLogic === 'OR'
            ? filters.themes.some((t) => b.themes.includes(t))
            : filters.themes.every((t) => b.themes.includes(t));
        if (!ok) return false;
      }

      if (filters.publishers.length) {
        const pubs = b.publishers.map((p) => p.toLowerCase());
        const ok =
          filters.publisherLogic === 'OR'
            ? filters.publishers.some((p) => pubs.some((bp) => bp.includes(p.id.toLowerCase()) || bp.includes(p.name.toLowerCase())))
            : filters.publishers.every((p) => pubs.some((bp) => bp.includes(p.id.toLowerCase()) || bp.includes(p.name.toLowerCase())));
        if (!ok) return false;
      }

      if (filters.awards && filters.awards !== 'all' && !b.awards.includes(filters.awards)) return false;
      if (filters.yearFrom && b.yearNum && b.yearNum < Number(filters.yearFrom)) return false;
      if (filters.yearTo && b.yearNum && b.yearNum > Number(filters.yearTo)) return false;
      if (filters.maxPages && filters.maxPages < 900 && b.pages && b.pages > Number(filters.maxPages)) return false;
      if (filters.minGoodreads > 0 && (!b.hasGoodreads || b.goodreadsScore < filters.minGoodreads)) return false;
      if (filters.minStorygraph > 0 && (!b.hasStorygraph || b.storygraphScore < filters.minStorygraph)) return false;

      if (filters.availability.length) {
        const ok = filters.availability.some((mode) => {
          if (mode === 'public') return b.ebookAccess === 'public';
          if (mode === 'borrowable') return b.ebookAccess === 'borrowable' || b.ebookAccess === 'public';
          return Boolean(b.ebookAccess);
        });
        if (!ok) return false;
      }

      return true;
    });
  }

  async function discoverWithFilters(filters, page = 1) {
    const vaultMatches = page === 1 ? filterVaultBooks(filters) : [];

    const clauses = [];
    const hasExplicitSubjects =
      filters.genres.length > 0 ||
      filters.authors.length > 0 ||
      filters.themes.length > 0 ||
      filters.publishers.length > 0 ||
      (filters.awards && filters.awards !== 'all');

    const fmtCfg = CFG.FORMATS[filters.format];
    if (fmtCfg?.query && (filters.format !== 'all' && (filters.format !== 'fiction' || !hasExplicitSubjects))) {
      clauses.push(fmtCfg.query);
    }

    if (filters.language) {
      clauses.push(`language:${filters.language}`);
    }

    if (filters.genres.length) {
      const genreParts = filters.genres.map((id) => {
        const g = CFG.GENRES.find((item) => item.id === id);
        return g?.query || `subject:${quoteTerm(id)}`;
      });
      clauses.push(joinClauses(genreParts, filters.genreLogic));
    }

    if (filters.authors.length) {
      const authorParts = filters.authors.map((a) => `author:${quoteTerm(a.name)}`);
      clauses.push(joinClauses(authorParts, filters.authorLogic));
    }

    if (filters.themes.length) {
      const themeParts = filters.themes.map((id) => {
        const found = CFG.THEMES_MOODS.find((t) => t.id === id);
        return `subject:${quoteTerm(found ? found.query : id)}`;
      });
      clauses.push(joinClauses(themeParts, filters.themeLogic));
    }

    if (filters.publishers.length) {
      const pubParts = filters.publishers.map((p) => `publisher:${quoteTerm(p.id || p.name)}`);
      clauses.push(joinClauses(pubParts, filters.publisherLogic));
    }

    const awardCfg = CFG.AWARDS_PRESETS.find((a) => a.id === filters.awards);
    if (awardCfg?.query) {
      clauses.push(awardCfg.query);
    }

    if (filters.yearFrom || filters.yearTo) {
      const from = filters.yearFrom || '*';
      const to = filters.yearTo || '*';
      clauses.push(`first_publish_year:[${from} TO ${to}]`);
    } else if (filters.sort === 'year.desc') {
      clauses.push(`first_publish_year:[1900 TO ${new Date().getFullYear()}]`);
    }

    if (filters.maxPages && filters.maxPages < 900) {
      clauses.push(`number_of_pages_median:[1 TO ${filters.maxPages}]`);
    }

    if (filters.availability.length) {
      const accessParts = filters.availability.map((mode) => {
        if (mode === 'public') return 'ebook_access:public';
        if (mode === 'borrowable') return 'ebook_access:borrowable';
        return 'has_fulltext:true';
      });
      clauses.push(joinClauses(accessParts, 'OR'));
    }

    const q = clauses.length ? clauses.join(' AND ') : 'subject:fiction';
    const limit = 40;
    const langCfg = CFG.LANGUAGES.find((l) => l.code === filters.language);
    const params = {
      q,
      page,
      limit,
      fields: LIST_FIELDS
    };
    if (filters.language && langCfg?.iso1) {
      params.lang = langCfg.iso1;
    }

    // Map UI sort to valid Open Library Solr sorts (with automatic unsorted fallback if Solr slows down)
    if (filters.sort === 'goodreads.desc' || filters.sort === 'storygraph.desc') {
      params.sort = 'rating';
    } else if (filters.sort === 'goodreads.asc' || filters.sort === 'storygraph.asc') {
      params.sort = 'rating asc';
    } else if (filters.sort === 'year.desc') {
      params.sort = 'new';
    } else if (filters.sort === 'year.asc') {
      params.sort = 'old';
    } else if (filters.sort === 'title.asc') {
      params.sort = 'title';
    } else {
      params.sort = 'readinglog';
    }

    let liveResults = [];
    let totalFound = vaultMatches.length;

    try {
      const data = await olSearchWithFallback(params);
      liveResults = (data.docs || [])
        .filter((d) => d.key && d.title)
        .map((d) => enrichBookDoc(d, { awardBadge: awardCfg?.badge || '' }));
      totalFound = Math.max(Number(data.numFound || 0), liveResults.length + vaultMatches.length);
    } catch {
      // Fallback to fast Open Library Subjects endpoint when Solr is unavailable
      if (page === 1 && !filters.authors.length && !filters.publishers.length) {
        const genreSlug = filters.genres.length === 1
          ? CFG.GENRES.find((g) => g.id === filters.genres[0])?.subjectSlug
          : fmtCfg?.subjectSlug;
        if (genreSlug) {
          try {
            liveResults = await fetchSubjectWorks(genreSlug, 36, awardCfg?.badge || '');
            totalFound = Math.max(totalFound, liveResults.length + vaultMatches.length);
          } catch {
            // Keep curated vault matches cleanly
          }
        }
      }
    }

    const filteredLive = applyLocalFilters(liveResults, filters);
    let results = dedupeBooks(page === 1 ? [...vaultMatches, ...filteredLive] : filteredLive);
    results = sortAndSanitize(results, filters.sort);

    return {
      results,
      total_pages: Math.min(Math.max(1, Math.ceil(totalFound / limit)), 25),
      total_results: Math.max(totalFound, results.length)
    };
  }

  function applyLocalFilters(items, filters) {
    return items.filter((book) => {
      if (filters.minGoodreads > 0 && (!book.hasGoodreads || book.goodreadsScore < filters.minGoodreads)) return false;
      if (filters.minStorygraph > 0 && (!book.hasStorygraph || book.storygraphScore < filters.minStorygraph)) return false;
      if (filters.yearFrom && book.yearNum && book.yearNum < Number(filters.yearFrom)) return false;
      if (filters.yearTo && book.yearNum && book.yearNum > Number(filters.yearTo)) return false;
      if (filters.maxPages && filters.maxPages < 900 && book.pages && book.pages > Number(filters.maxPages)) return false;
      return true;
    });
  }

  /* ---------- Google Gemini Search Grounding (Optional) ---------- */
  async function geminiGroundedJson(promptText, cacheKey) {
    const geminiKey = getGeminiKey();
    if (!geminiKey) return null;

    if (cacheKey) {
      const cached = readCache(cacheKey);
      if (cached) return cached;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${CFG.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 }
      })
    });

    if (!res.ok) return null;
    const payload = await res.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (cacheKey) writeCache(cacheKey, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  async function aiNaturalLanguageDiscover(userPrompt) {
    const prompt = `You are a literary archivist and bookseller. Using Google Search to verify facts, return a JSON array of up to 8 exact book recommendations matching: "${userPrompt}".
Return ONLY valid JSON with objects containing: {"title": string, "author": string, "reason": string}.`;

    const recs = await geminiGroundedJson(prompt, `ai_books_${userPrompt.toLowerCase()}`);
    if (!Array.isArray(recs) || !recs.length) return null;

    const settled = await Promise.allSettled(
      recs.slice(0, 8).map(async (rec) => {
        const data = await olSearchWithFallback({
          title: rec.title,
          author: rec.author,
          sort: 'readinglog',
          limit: 3,
          fields: LIST_FIELDS
        });
        const match = (data.docs || []).find((d) => d.cover_i || d.cover_edition_key) || (data.docs || [])[0];
        if (!match) return null;
        return enrichBookDoc(match, { author: rec.author, aiReason: rec.reason || '' });
      })
    );

    return dedupeBooks(settled.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value));
  }

  async function verifyBookPrestige(workId, title, author) {
    const prompt = `Verify the exact Goodreads rating (out of 5), StoryGraph rating (out of 5), and major literary prizes won (Booker, Pulitzer, Nobel, Hugo, Nebula, National Book Award, Women's Prize) for the book "${title}" by ${author}.
Return ONLY JSON: {"goodreads": number|null, "storygraph": number|null, "awardsSummary": string}`;
    return geminiGroundedJson(prompt, `verify_book_${extractWorkId(workId)}`);
  }

  return {
    getGeminiKey,
    clearCache,
    sortAndSanitize,
    hydrateWikiCover,
    fetchHeroSpotlight,
    fetchCollection,
    fetchBookDetails,
    searchBooks,
    searchAuthor,
    discoverWithFilters,
    aiNaturalLanguageDiscover,
    verifyBookPrestige
  };
})();
