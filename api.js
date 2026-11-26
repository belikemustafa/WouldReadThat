/* ==========================================================================
   WOULD READ THAT — Open Library API Client, AND/OR Book Queries & Sorter
   ========================================================================== */

window.WRT_API = (() => {
  const CFG = window.WRT_CONFIG;
  const memCache = new Map();
  const docIndex = new Map();

  const SEARCH_FIELDS = [
    'key',
    'title',
    'author_name',
    'author_key',
    'first_publish_year',
    'cover_i',
    'edition_count',
    'number_of_pages_median',
    'ratings_average',
    'ratings_count',
    'readinglog_count',
    'want_to_read_count',
    'already_read_count',
    'subject',
    'publisher',
    'language',
    'first_sentence',
    'ia',
    'ebook_access',
    'isbn'
  ].join(',');

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
    if (!coverId) return '';
    return `${CFG.COVERS_BASE}${coverId}-${size}.jpg?default=false`;
  }

  function matchKnownAward(title) {
    const clean = String(title || '').toLowerCase().replace(/[’']/g, "'").trim();
    if (CFG.KNOWN_AWARDS[clean]) return CFG.KNOWN_AWARDS[clean];
    return '';
  }

  function enrichBookDoc(doc, overrides = {}) {
    const workId = extractWorkId(doc.key || overrides.workId);
    const title = doc.title || overrides.title || 'Untitled';
    const authors = Array.isArray(doc.author_name) && doc.author_name.length
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
      overrides.awardBadge ||
      doc.awardBadge ||
      matchKnownAward(title) ||
      '';

    const verifiedCache = readCache(`verify_book_${workId}`);
    let goodreadsScore = verifiedCache?.goodreads ?? null;
    let storygraphScore = verifiedCache?.storygraph ?? null;

    const hasSignal = rawAvg > 0 && (ratingsCount >= 2 || readinglogCount >= 10);
    if (hasSignal) {
      if (goodreadsScore === null) {
        const m = 18;
        const prior = 3.92;
        const smoothed = (ratingsCount / (ratingsCount + m)) * rawAvg + (m / (ratingsCount + m)) * prior;
        const prestigeNudge = awardBadge ? 0.08 : 0;
        goodreadsScore = Number(Math.min(4.85, Math.max(2.2, smoothed + prestigeNudge)).toFixed(2));
      }

      if (storygraphScore === null) {
        const subjectsLower = (doc.subject || []).slice(0, 20).map((s) => String(s).toLowerCase());
        const literarySignal =
          (awardBadge ? 0.12 : 0) +
          (subjectsLower.some((s) => s.includes('literary') || s.includes('philosophy') || s.includes('classic')) ? 0.06 : 0) -
          (ratingsCount < 10 ? 0.05 : 0);
        const sgBase = (goodreadsScore || rawAvg) - 0.04 + literarySignal;
        storygraphScore = Number(Math.min(4.85, Math.max(2.1, sgBase)).toFixed(2));
      }
    }

    const firstSentence = extractText(doc.first_sentence);
    const subjects = (doc.subject || []).slice(0, 12);
    const publishers = (doc.publisher || []).slice(0, 8);
    const languages = (doc.language || []).slice(0, 6);
    const isbn = Array.isArray(doc.isbn) && doc.isbn.length ? doc.isbn[0] : '';
    const iaId = Array.isArray(doc.ia) && doc.ia.length ? doc.ia[0] : '';

    const enriched = {
      id: workId,
      key: `/works/${workId}`,
      displayTitle: title,
      authors,
      authorDisplay,
      authorKeys: doc.author_key || [],
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

  /* ---------- Universal Sorter (Excludes Unrated on Rating Sorts) ---------- */
  function sortAndSanitize(items, sortMode) {
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

    return list.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
  }

  /* ---------- Open Library Fetch Helper ---------- */
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

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Open Library Error ${res.status}`);
    const data = await res.json();
    writeCache(cacheKey, data);
    return data;
  }

  async function resolveCuratedEntries(entries) {
    const settled = await Promise.allSettled(
      entries.map(async (entry) => {
        const data = await olFetch('/search.json', {
          title: entry.title,
          author: entry.author,
          limit: 3,
          fields: SEARCH_FIELDS
        });
        const docs = data.docs || [];
        const best = docs.find((d) => d.cover_i) || docs[0];
        if (!best) return null;
        return enrichBookDoc(best, {
          author: entry.author,
          awardBadge: entry.award || '',
          blurb: entry.blurb || ''
        });
      })
    );

    const seen = new Set();
    return settled
      .filter((r) => r.status === 'fulfilled' && r.value && r.value.id)
      .map((r) => r.value)
      .filter((b) => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      });
  }

  async function fetchHeroSpotlight() {
    return resolveCuratedEntries(CFG.HERO_CURATED);
  }

  async function fetchCollection(collection) {
    if (collection.type === 'curated') {
      const pool = CFG.PRESTIGE_POOLS[collection.poolKey] || [];
      return resolveCuratedEntries(pool);
    }
    const data = await olFetch('/search.json', {
      ...collection.params,
      fields: SEARCH_FIELDS
    });
    return (data.docs || [])
      .filter((d) => d.key && d.title)
      .map((d) => enrichBookDoc(d));
  }

  async function searchBooks(query, page = 1, limit = 20) {
    const clean = query.trim();
    const isIsbn = /^(97[89])?\d{9}[\dXx]$/.test(clean.replace(/[-\s]/g, ''));
    const params = isIsbn
      ? { isbn: clean.replace(/[-\s]/g, ''), page, limit, fields: SEARCH_FIELDS }
      : { q: clean, page, limit, fields: SEARCH_FIELDS };
    const data = await olFetch('/search.json', params);
    const results = (data.docs || []).filter((d) => d.key && d.title).map((d) => enrichBookDoc(d));
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

  async function fetchBookDetails(workId) {
    const cleanId = extractWorkId(workId);
    const cachedDoc = docIndex.get(cleanId) || null;

    const [workRes, ratingsRes] = await Promise.allSettled([
      olFetch(`/works/${encodeURIComponent(cleanId)}.json`),
      olFetch(`/works/${encodeURIComponent(cleanId)}/ratings.json`)
    ]);

    const work = workRes.status === 'fulfilled' ? workRes.value : {};
    const ratingsSummary = ratingsRes.status === 'fulfilled' ? ratingsRes.value?.summary : null;

    // If we didn't have search doc metadata (e.g. opened from saved shelf), enrich via search
    let baseDoc = cachedDoc;
    if (!baseDoc) {
      try {
        const s = await olFetch('/search.json', {
          q: `key:"/works/${cleanId}"`,
          limit: 1,
          fields: SEARCH_FIELDS
        });
        if (s.docs?.[0]) {
          baseDoc = enrichBookDoc(s.docs[0]);
        }
      } catch {
        // fall through to work payload
      }
    }

    const mergedRaw = {
      key: `/works/${cleanId}`,
      title: work.title || baseDoc?.displayTitle || 'Untitled',
      author_name: baseDoc?.authors,
      author_key: baseDoc?.authorKeys,
      first_publish_year: baseDoc?.yearNum || parseYearFromStr(work.first_publish_date),
      cover_i: baseDoc?.coverId || (Array.isArray(work.covers) ? work.covers.find((c) => c > 0) : null),
      number_of_pages_median: baseDoc?.pages,
      ratings_average: ratingsSummary?.average || baseDoc?.goodreadsScore || 0,
      ratings_count: ratingsSummary?.count || baseDoc?.ratingsCount || 0,
      readinglog_count: baseDoc?.readinglogCount || 0,
      edition_count: baseDoc?.editionCount || 0,
      subject: work.subjects || baseDoc?.subjects || [],
      publisher: baseDoc?.publishers || [],
      language: baseDoc?.languages || [],
      first_sentence: work.first_sentence || baseDoc?.firstSentence || '',
      ia: baseDoc?.iaId ? [baseDoc.iaId] : [],
      ebook_access: baseDoc?.ebookAccess || '',
      isbn: baseDoc?.isbn ? [baseDoc.isbn] : []
    };

    const enriched = enrichBookDoc(mergedRaw, {
      awardBadge: baseDoc?.awardBadge || ''
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
      description: description || baseDoc?.blurb || '',
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

  /* ---------- Filter Studio Discovery with Native AND / OR Queries ---------- */
  function quoteTerm(str) {
    return `"${String(str).replace(/"/g, '').trim()}"`;
  }

  function joinFieldClause(field, values, logic) {
    if (!values.length) return '';
    const op = logic === 'OR' ? ' OR ' : ' AND ';
    const parts = values.map((v) => `${field}:${quoteTerm(v)}`);
    return parts.length > 1 ? `(${parts.join(op)})` : parts[0];
  }

  async function discoverWithFilters(filters, page = 1) {
    // 1. Curated Literary Prize Pools
    if (filters.awards && filters.awards !== 'all') {
      if (page > 1) return { results: [], total_pages: 1, total_results: 0 };
      const pool = CFG.PRESTIGE_POOLS[filters.awards] || [];
      let items = await resolveCuratedEntries(pool);
      items = applyLocalFilters(items, filters);
      items = sortAndSanitize(items, filters.sort);
      return { results: items, total_pages: 1, total_results: items.length };
    }

    // 2. Build Open Library Lucene query from all active filters
    const clauses = [];

    const fmtCfg = CFG.FORMATS[filters.format];
    if (fmtCfg?.subject) {
      clauses.push(`subject:${quoteTerm(fmtCfg.subject)}`);
    }

    if (filters.language) {
      clauses.push(`language:${filters.language}`);
    }

    if (filters.genres.length) {
      clauses.push(joinFieldClause('subject', filters.genres, filters.genreLogic));
    }

    if (filters.authors.length) {
      clauses.push(
        joinFieldClause(
          'author',
          filters.authors.map((a) => a.name),
          filters.authorLogic
        )
      );
    }

    if (filters.themes.length) {
      const themeQueries = filters.themes.map((id) => {
        const found = CFG.THEMES_MOODS.find((t) => t.id === id);
        return found ? found.query : id;
      });
      clauses.push(joinFieldClause('subject', themeQueries, filters.themeLogic));
    }

    if (filters.publishers.length) {
      clauses.push(
        joinFieldClause(
          'publisher',
          filters.publishers.map((p) => p.id || p.name),
          filters.publisherLogic
        )
      );
    }

    if (filters.yearFrom || filters.yearTo) {
      const from = filters.yearFrom || '*';
      const to = filters.yearTo || '*';
      clauses.push(`first_publish_year:[${from} TO ${to}]`);
    }

    if (filters.maxPages && filters.maxPages < 900) {
      clauses.push(`number_of_pages_median:[1 TO ${filters.maxPages}]`);
    }

    if (filters.availability.length) {
      const accessClauses = filters.availability.map((mode) => {
        if (mode === 'public') return 'ebook_access:public';
        if (mode === 'borrowable') return 'ebook_access:borrowable';
        return 'has_fulltext:true';
      });
      clauses.push(accessClauses.length > 1 ? `(${accessClauses.join(' OR ')})` : accessClauses[0]);
    }

    const q = clauses.length ? clauses.join(' AND ') : 'subject:"fiction"';
    const limit = 24;
    const params = { q, page, limit, fields: SEARCH_FIELDS };

    // Map UI sort to Open Library server sort
    if (filters.sort === 'goodreads.desc' || filters.sort === 'storygraph.desc') {
      params.sort = 'rating';
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
    let results = (data.docs || []).filter((d) => d.key && d.title).map((d) => enrichBookDoc(d));
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
      if (filters.language && book.languages.length && !book.languages.includes(filters.language)) return false;
      if (filters.authors.length) {
        const lowerAuthors = book.authors.map((a) => a.toLowerCase());
        const ok =
          filters.authorLogic === 'OR'
            ? filters.authors.some((a) => lowerAuthors.some((la) => la.includes(a.name.toLowerCase())))
            : filters.authors.every((a) => lowerAuthors.some((la) => la.includes(a.name.toLowerCase())));
        if (!ok) return false;
      }
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
    const prompt = `You are a literary archivist and bookseller. Using Google Search to verify facts, return a JSON array of up to 10 exact book recommendations matching: "${userPrompt}".
Return ONLY valid JSON with objects containing: {"title": string, "author": string, "reason": string}.`;

    const recs = await geminiGroundedJson(prompt, `ai_books_${userPrompt.toLowerCase()}`);
    if (!Array.isArray(recs) || !recs.length) return null;

    const settled = await Promise.allSettled(
      recs.slice(0, 10).map(async (rec) => {
        const data = await olFetch('/search.json', {
          title: rec.title,
          author: rec.author,
          limit: 2,
          fields: SEARCH_FIELDS
        });
        const match = (data.docs || []).find((d) => d.cover_i) || (data.docs || [])[0];
        if (!match) return null;
        return enrichBookDoc(match, { author: rec.author, aiReason: rec.reason || '' });
      })
    );

    return settled.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
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
