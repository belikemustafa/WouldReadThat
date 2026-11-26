/* ==========================================================================
   WOULD READ THAT — Fast, Throttled Open Library API Client & Book Sorter
   ========================================================================== */

window.WRT_API = (() => {
  const CFG = window.WRT_CONFIG;
  const memCache = new Map();
  const docIndex = new Map();

  // Keep list queries lean (avoid huge isbn/publisher/subject/ia arrays that bloat Open Library Solr responses)
  const LIST_FIELDS = [
    'key',
    'title',
    'author_name',
    'first_publish_year',
    'cover_i',
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

  /* ---------- Normalization & Goodreads vs StoryGraph Calibration ---------- */
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

  function matchKnownAward(title) {
    const clean = String(title || '').toLowerCase().replace(/[’']/g, "'").trim();
    return CFG.KNOWN_AWARDS[clean] || '';
  }

  function enrichBookDoc(doc, overrides = {}) {
    const workId = extractWorkId(doc.key || overrides.workId);
    const title = String(doc.title || overrides.title || 'Untitled').trim();
    const authors =
      Array.isArray(doc.author_name) && doc.author_name.length
        ? doc.author_name
        : overrides.author
        ? [overrides.author]
        : ['Unknown Author'];
    const authorDisplay = authors.slice(0, 2).join(', ');
    const yearNum = Number(doc.first_publish_year || overrides.first_publish_year || 0);
    const displayYear = yearNum > 0 ? String(yearNum) : '—';
    const pages = Number(doc.number_of_pages_median || overrides.pages || 0) || null;
    const coverId = doc.cover_i || (Array.isArray(doc.covers) ? doc.covers.find((c) => c > 0) : null) || null;

    const rawAvg = Number(doc.ratings_average || 0);
    const ratingsCount = Number(doc.ratings_count || 0);
    const readinglogCount = Number(doc.readinglog_count || doc.want_to_read_count || 0);
    const editionCount = Number(doc.edition_count || 0);
    const popularityScore = readinglogCount * 2 + ratingsCount * 10 + editionCount;

    const awardBadge =
      matchKnownAward(title) ||
      overrides.awardBadge ||
      doc.awardBadge ||
      '';

    const verifiedCache = readCache(`verify_book_${workId}`);
    let goodreadsScore = verifiedCache?.goodreads ?? null;
    let storygraphScore = verifiedCache?.storygraph ?? null;

    // Calibrate from Open Library ratings whenever at least 1 rating exists
    if (rawAvg > 0 && (ratingsCount >= 1 || readinglogCount >= 5)) {
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
    const iaId = Array.isArray(doc.ia) && doc.ia.length ? doc.ia[0] : '';

    const enriched = {
      id: workId,
      key: `/works/${workId}`,
      displayTitle: title,
      authors,
      authorDisplay,
      yearNum,
      displayYear,
      pages,
      coverId,
      posterUrl: buildCoverUrl(coverId, 'M'),
      coverLargeUrl: buildCoverUrl(coverId, 'L'),
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
      ebookAccess: doc.ebook_access || '',
      aiReason: overrides.aiReason || ''
    };

    if (workId) docIndex.set(workId, enriched);
    return enriched;
  }

  // Deduplicate works with identical title + primary author, keeping the cover-bearing / most popular record
  function dedupeBooks(books) {
    const byKey = new Map();
    for (const b of books) {
      if (!b || !b.id) continue;
      const sig = `${b.displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}::${(b.authors[0] || '').toLowerCase().trim()}`;
      const existing = byKey.get(sig);
      if (!existing) {
        byKey.set(sig, b);
      } else {
        const bScore = (b.coverId ? 100000 : 0) + b.popularityScore;
        const eScore = (existing.coverId ? 100000 : 0) + existing.popularityScore;
        if (bScore > eScore) byKey.set(sig, b);
      }
    }
    return [...byKey.values()];
  }

  /* ---------- Universal Sorter ---------- */
  function sortAndSanitize(items, sortMode, preserveOrderOnDefault = false) {
    let list = [...items];

    if (sortMode === 'goodreads.desc' || sortMode === 'goodreads.asc') {
      list = list.filter((b) => b.hasGoodreads);
      return list.sort((a, b) =>
        sortMode === 'goodreads.desc'
          ? b.goodreadsScore - a.goodreadsScore || b.ratingsCount - a.ratingsCount
          : a.goodreadsScore - b.goodreadsScore || b.ratingsCount - a.ratingsCount
      );
    }

    if (sortMode === 'storygraph.desc' || sortMode === 'storygraph.asc') {
      list = list.filter((b) => b.hasStorygraph);
      return list.sort((a, b) =>
        sortMode === 'storygraph.desc'
          ? b.storygraphScore - a.storygraphScore || b.ratingsCount - a.ratingsCount
          : a.storygraphScore - b.storygraphScore || b.ratingsCount - a.ratingsCount
      );
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

  /* ---------- Resilient Open Library Fetch with Retry & Timeout ---------- */
  async function olFetch(path, params = {}, skipCache = false) {
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
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 14000);
        try {
          const res = await fetch(url.toString(), { signal: controller.signal });
          clearTimeout(timer);
          if (res.status === 429 || res.status >= 500) {
            lastErr = new Error(`Open Library Error ${res.status}`);
            await sleep(500 * (attempt + 1));
            continue;
          }
          if (!res.ok) throw new Error(`Open Library Error ${res.status}`);
          const data = await res.json();
          writeCache(cacheKey, data);
          return data;
        } catch (err) {
          clearTimeout(timer);
          lastErr = err;
          if (attempt < 2) await sleep(450 * (attempt + 1));
        }
      }
      throw lastErr || new Error('Open Library request failed');
    });
  }

  /* ---------- Home Spotlight & Collections (1 Fast Request Each) ---------- */
  async function fetchHeroSpotlight() {
    let data = await olFetch('/search.json', {
      ...CFG.HERO_QUERY,
      lang: 'en',
      fields: LIST_FIELDS
    });

    let docs = (data.docs || []).filter((d) => d.key && d.title);
    if (!docs.length) {
      data = await olFetch('/search.json', {
        q: 'subject:fiction',
        sort: 'readinglog',
        limit: 12,
        lang: 'en',
        fields: LIST_FIELDS
      });
      docs = (data.docs || []).filter((d) => d.key && d.title);
    }

    const enriched = dedupeBooks(docs.map((d) => enrichBookDoc(d)));
    const withCovers = enriched.filter((b) => b.coverId);
    return (withCovers.length >= 4 ? withCovers : enriched).slice(0, 6);
  }

  async function fetchCollection(collection) {
    const data = await olFetch('/search.json', {
      ...collection.params,
      lang: 'en',
      fields: LIST_FIELDS
    });
    const docs = (data.docs || []).filter((d) => d.key && d.title);
    const enriched = dedupeBooks(
      docs.map((d) => enrichBookDoc(d, { awardBadge: collection.awardHint || '' }))
    );
    // Float books with cover scans to the front of each shelf
    return enriched.sort((a, b) => Number(Boolean(b.coverId)) - Number(Boolean(a.coverId))).slice(0, 14);
  }

  /* ---------- Search & Author Autocomplete ---------- */
  async function searchBooks(query, page = 1, limit = 24) {
    const clean = query.trim();
    const compactIsbn = clean.replace(/[-\s]/g, '');
    const isIsbn = /^(97[89])?\d{9}[\dXx]$/.test(compactIsbn);
    const params = isIsbn
      ? { isbn: compactIsbn, page, limit, lang: 'en', fields: LIST_FIELDS }
      : { q: clean, page, limit, lang: 'en', fields: LIST_FIELDS };

    const data = await olFetch('/search.json', params);
    const rawDocs = (data.docs || []).filter((d) => d.key && d.title);
    const results = dedupeBooks(rawDocs.map((d) => enrichBookDoc(d)));
    const totalFound = Number(data.numFound || results.length);
    return {
      results,
      total_pages: Math.min(Math.max(1, Math.ceil(totalFound / limit)), 20),
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
  async function fetchBookDetails(workId) {
    const cleanId = extractWorkId(workId);
    const cachedDoc = docIndex.get(cleanId) || null;

    const tasks = [
      olFetch(`/works/${encodeURIComponent(cleanId)}.json`),
      olFetch(`/works/${encodeURIComponent(cleanId)}/ratings.json`)
    ];
    // Fetch publisher/ISBN/IA info on-demand for this single work if missing from list cache
    if (!cachedDoc || (!cachedDoc.publishers?.length && !cachedDoc.isbn)) {
      tasks.push(
        olFetch('/search.json', {
          q: `key:"/works/${cleanId}"`,
          limit: 1,
          lang: 'en',
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
      awardBadge: cachedDoc?.awardBadge || ''
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

  /* ---------- Filter Studio Discovery with Clean Lucene Queries ---------- */
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

  async function discoverWithFilters(filters, page = 1) {
    const clauses = [];

    const hasExplicitSubjects =
      filters.genres.length > 0 ||
      filters.authors.length > 0 ||
      filters.themes.length > 0 ||
      filters.publishers.length > 0 ||
      (filters.awards && filters.awards !== 'all');

    // Only apply default `fiction` format when no other primary facet was chosen,
    // or whenever the user explicitly switched to non-fiction / classics / poetry / graphic novels.
    const fmtCfg = CFG.FORMATS[filters.format];
    if (fmtCfg?.query && (filters.format !== 'fiction' || !hasExplicitSubjects)) {
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
      // Exclude malformed future-dated catalog entries on Newest sort
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
    const limit = 28;
    const langCfg = CFG.LANGUAGES.find((l) => l.code === filters.language);
    const params = {
      q,
      page,
      limit,
      lang: langCfg?.iso1 || 'en',
      fields: LIST_FIELDS
    };

    // Map UI sort to valid Open Library Solr sorts
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

    const data = await olFetch('/search.json', params);
    let results = dedupeBooks(
      (data.docs || [])
        .filter((d) => d.key && d.title)
        .map((d) => enrichBookDoc(d, { awardBadge: awardCfg?.badge || '' }))
    );

    results = applyLocalFilters(results, filters);
    results = sortAndSanitize(results, filters.sort);

    const totalFound = Number(data.numFound || results.length);
    return {
      results,
      total_pages: Math.min(Math.max(1, Math.ceil(totalFound / limit)), 20),
      total_results: totalFound
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
        const data = await olFetch('/search.json', {
          title: rec.title,
          author: rec.author,
          sort: 'readinglog',
          limit: 3,
          lang: 'en',
          fields: LIST_FIELDS
        });
        const match = (data.docs || []).find((d) => d.cover_i) || (data.docs || [])[0];
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
