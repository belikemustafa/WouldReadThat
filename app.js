/* ==========================================================================
   WOULD READ THAT — Mobile-First Literary Archive Application Controller
   Large Filter Sheets, AND/OR Toggles, Tap-Again Deselect, Reading Room & Auth
   ========================================================================== */

(() => {
  const CFG = window.WRT_CONFIG;
  const API = window.WRT_API;

  const SVG_LAUREL = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 4C3.5 7 3.5 14 8 19M17 4c3.5 3 3.5 10-1 15M8 19h8"/></svg>`;
  const SVG_SG_BARS = `<svg viewBox="0 0 18 14" width="13" height="11" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="1.5" y="6" width="3" height="7" rx="0.8"/><rect x="7" y="2" width="3" height="11" rx="0.8"/><rect x="12.5" y="4.5" width="3" height="8.5" rx="0.8"/></svg>`;

  const state = {
    view: 'home',
    heroItems: [],
    heroIndex: 0,
    heroTimer: null,
    discoverPage: 1,
    discoverTotalPages: 1,
    discoverMode: 'filter',
    discoverSeq: 0,
    currentResults: [],
    lastQuery: '',
    shelfFilter: 'all',
    activeUser: localStorage.getItem(CFG.STORAGE_KEYS.ACTIVE_USER) || null,
    authMode: 'login',
    filters: createDefaultFilters()
  };

  function createDefaultFilters() {
    return {
      format: 'all',
      genres: [],
      genreLogic: 'AND',
      minGoodreads: 0,
      minStorygraph: 0,
      language: '',
      authors: [],
      authorLogic: 'OR',
      themes: [],
      themeLogic: 'AND',
      publishers: [],
      publisherLogic: 'OR',
      era: 'all',
      yearFrom: '',
      yearTo: '',
      awards: 'all',
      maxPages: 900,
      availability: [],
      sort: 'popularity.desc'
    };
  }

  const $ = (id) => document.getElementById(id);

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    applySavedAppearance();
    renderSettingsControls();
    renderFilterControls();
    bindGlobalEvents();
    updateAuthUI();
    updateShelfBadge();
    loadHomeContent();
  });

  /* ---------- Appearance & Settings ---------- */
  function applySavedAppearance() {
    const theme = localStorage.getItem(CFG.STORAGE_KEYS.THEME) || 'abyssal-carbon';
    const accent = localStorage.getItem(CFG.STORAGE_KEYS.ACCENT) || 'royal-gold';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
  }

  function renderSettingsControls() {
    const curTheme = document.documentElement.getAttribute('data-theme');
    const curAccent = document.documentElement.getAttribute('data-accent');

    $('themeSelectorGrid').innerHTML = CFG.THEMES.map(
      (t) => `
      <button type="button" class="swatch-btn ${curTheme === t.id ? 'active' : ''}" data-set-theme="${t.id}">
        <span class="swatch-dot" style="background:${t.swatch}"></span>
        <span>${t.name}</span>
      </button>`
    ).join('');

    $('accentSelectorGrid').innerHTML = CFG.ACCENTS.map(
      (a) => `
      <button type="button" class="swatch-btn ${curAccent === a.id ? 'active' : ''}" data-set-accent="${a.id}">
        <span class="swatch-dot" style="background:${a.swatch}"></span>
        <span>${a.name}</span>
      </button>`
    ).join('');

    $('geminiKeyInput').value = localStorage.getItem(CFG.STORAGE_KEYS.GEMINI_KEY) || '';
  }

  function openSettings() {
    renderSettingsControls();
    $('settingsDrawer').classList.remove('hidden');
  }

  function closeSettings() {
    $('settingsDrawer').classList.add('hidden');
  }

  /* ---------- View Switching ---------- */
  function switchView(viewName, { skipAutoDiscover = false } = {}) {
    state.view = viewName;
    closeAllPopovers();
    document.querySelectorAll('.view-section').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewName));
    document.querySelectorAll('.dock-btn').forEach((b) => b.classList.toggle('active', b.dataset.mobileNav === viewName));
    $(`${viewName}View`)?.classList.add('active');

    if (viewName === 'discover' && !skipAutoDiscover && !state.currentResults.length) {
      runDiscover(1, false);
    }
    if (viewName === 'shelf') renderShelfView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Popover / Mobile Bottom Sheet Controls ---------- */
  function closeAllPopovers(exceptBox = null) {
    let anyOpen = false;
    document.querySelectorAll('.filter-popover').forEach((box) => {
      if (box === exceptBox) {
        anyOpen = true;
        return;
      }
      box.classList.remove('open');
      box.querySelector('.filter-panel')?.classList.add('hidden');
      box.querySelector('.filter-trigger')?.setAttribute('aria-expanded', 'false');
    });

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    $('sheetBackdrop').classList.toggle('hidden', !(anyOpen && isMobile));
    document.body.classList.toggle('sheet-open', anyOpen && isMobile);
  }

  /* ---------- Home: Swipeable Literary Hero & Collections ---------- */
  function createSkeletonCards(count = 6) {
    return Array.from({ length: count }, () => `<div class="skeleton-card shimmer"></div>`).join('');
  }

  async function loadHomeContent() {
    const container = $('collectionsContainer');
    container.innerHTML = CFG.COLLECTIONS.map(
      (col) => `
      <div class="collection-block" id="col-${col.id}">
        <div class="collection-head">
          <div>
            <p class="eyebrow">${col.eyebrow}</p>
            <h2 class="collection-title">${col.title}</h2>
          </div>
        </div>
        <div class="collection-row" id="col-row-${col.id}">${createSkeletonCards(6)}</div>
      </div>`
    ).join('');

    try {
      state.heroItems = await API.fetchHeroSpotlight();
      state.heroIndex = 0;
      if (state.heroItems.length) {
        renderHeroSlide();
        startHeroAutoRotate();
      } else {
        $('heroTrack').innerHTML = `<div class="hero-skeleton"><span>No spotlight titles returned from Open Library.</span></div>`;
      }
    } catch (err) {
      $('heroTrack').innerHTML = `
        <div class="hero-skeleton" style="padding:1.5rem;text-align:center;">
          <div>
            <p style="margin:0 0 0.5rem;color:var(--text-primary);">Could not reach Open Library (${escapeHtml(err.message)}).</p>
            <p class="helper-note">Please check your internet connection and refresh.</p>
          </div>
        </div>`;
    }

    for (const col of CFG.COLLECTIONS) {
      API.fetchCollection(col)
        .then((items) => {
          const row = $(`col-row-${col.id}`);
          if (!row) return;
          row.innerHTML = items.length
            ? items.map((item) => createCardHTML(item)).join('')
            : `<div class="empty-state" style="min-width:260px;">No editions found for ${escapeHtml(col.title)}.</div>`;
          attachCoverFallbacks(row);
          hydrateMissingCovers(row, items);
        })
        .catch(() => {
          const row = $(`col-row-${col.id}`);
          if (row) row.innerHTML = `<div class="empty-state" style="min-width:260px;">Unable to load ${escapeHtml(col.title)}.</div>`;
        });
    }
  }

  function renderHeroSlide() {
    if (!state.heroItems.length) return;
    const item = state.heroItems[state.heroIndex];
    const saved = isInShelf(item.id);
    const metaPayload = serializeShelfPayload(item);
    const heroImgUrl = item.coverLargeUrl || item.posterUrl || '';

    $('heroTrack').innerHTML = `
      <div class="hero-slide hero-book-slide">
        ${heroImgUrl ? `<div class="hero-backdrop-blur" style="background-image:url('${heroImgUrl}')"></div>` : ''}
        <div class="hero-layout">
          <div class="hero-book-jacket-wrap">
            ${
              heroImgUrl
                ? `<img class="hero-book-jacket" src="${heroImgUrl}" data-fallback-src="${escapeHtml(item.fallbackPosterUrl || '')}" alt="${escapeHtml(item.displayTitle)}" fetchpriority="high" decoding="async" data-fallback-title="${escapeHtml(item.displayTitle)}" data-fallback-author="${escapeHtml(item.authorDisplay)}" />`
                : buildCoverPlaceholderHTML(item.displayTitle, item.authorDisplay, 'hero-book-jacket')
            }
          </div>
          <div class="hero-content">
            <div class="hero-badges">
              <span class="award-badge">${escapeHtml(item.authorDisplay)} · ${item.displayYear}${item.pages ? ` · ${item.pages} pp.` : ''}</span>
              ${item.hasGoodreads ? `<span class="rating-pill rating-gr">★ ${item.goodreadsScore.toFixed(2)} GR</span>` : ''}
              ${item.hasStorygraph ? `<span class="rating-pill rating-sg">${SVG_SG_BARS} ${item.storygraphScore.toFixed(2)}</span>` : ''}
              ${item.awardBadge ? `<span class="award-badge">${SVG_LAUREL} ${escapeHtml(item.awardBadge)}</span>` : ''}
            </div>
            <h1 class="hero-title">${escapeHtml(item.displayTitle)}</h1>
            <p class="hero-overview">${escapeHtml(item.blurb || 'Explore literary dossier, opening lines, ratings, and editions.')}</p>
            <div class="hero-cta-row">
              <button class="btn-accent" data-action="hero-excerpt" data-id="${escapeHtml(item.id)}">Read Excerpt</button>
              <button class="btn-outline" data-action="open-detail" data-id="${escapeHtml(item.id)}">Dossier</button>
              <button class="btn-outline" data-action="toggle-hero-shelf" data-payload="${metaPayload}">
                ${saved ? '✓ On Shelf' : '+ Reading Shelf'}
              </button>
            </div>
          </div>
        </div>
      </div>`;

    attachCoverFallbacks($('heroTrack'));

    if (!heroImgUrl && item.wikiTitle && typeof API.hydrateWikiCover === 'function') {
      const slideIdx = state.heroIndex;
      API.hydrateWikiCover(item).then((url) => {
        if (url && state.heroIndex === slideIdx && state.heroItems[slideIdx]?.id === item.id) {
          renderHeroSlide();
        }
      });
    }

    $('heroDots').innerHTML = state.heroItems
      .map((_, i) => `<button class="hero-dot ${i === state.heroIndex ? 'active' : ''}" data-hero-dot="${i}" aria-label="Slide ${i + 1}"></button>`)
      .join('');

    const bar = $('heroProgressBar');
    bar.classList.remove('running');
    void bar.offsetWidth;
    bar.classList.add('running');
  }

  function stepHero(delta) {
    if (!state.heroItems.length) return;
    state.heroIndex = (state.heroIndex + delta + state.heroItems.length) % state.heroItems.length;
    renderHeroSlide();
    startHeroAutoRotate();
  }

  function startHeroAutoRotate() {
    clearInterval(state.heroTimer);
    state.heroTimer = setInterval(() => {
      if (state.view !== 'home' || !state.heroItems.length) return;
      state.heroIndex = (state.heroIndex + 1) % state.heroItems.length;
      renderHeroSlide();
    }, 7500);
  }

  /* ---------- Filter Controls, Quick Presets & Tap-Again Deselect ---------- */
  function renderFilterControls() {
    $('genrePills').innerHTML = CFG.GENRES.map(
      (g) => `<button type="button" class="chip" data-genre="${escapeHtml(g.id)}">${escapeHtml(g.name)}</button>`
    ).join('');

    $('languageSelect').innerHTML = CFG.LANGUAGES.map(
      (l) => `<option value="${l.code}">${escapeHtml(l.name)}</option>`
    ).join('');

    $('authorPresets').innerHTML = CFG.AUTHOR_PRESETS.map(
      (a) => `<button type="button" class="chip" data-author-preset="${escapeHtml(a.id)}" data-author-name="${escapeHtml(a.name)}">${escapeHtml(a.name)}</button>`
    ).join('');

    $('themePills').innerHTML = CFG.THEMES_MOODS.map(
      (t) => `<button type="button" class="chip" data-theme-mood="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>`
    ).join('');

    $('publisherPresets').innerHTML = CFG.PUBLISHER_PRESETS.map(
      (p) => `<button type="button" class="chip" data-publisher-preset="${escapeHtml(p.id)}" data-publisher-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</button>`
    ).join('');

    $('eraPresets').innerHTML = CFG.ERAS.map(
      (e) => `<button type="button" class="chip ${e.id === 'all' ? 'active' : ''}" data-era="${e.id}">${escapeHtml(e.label)}</button>`
    ).join('');

    $('awardsPills').innerHTML = CFG.AWARDS_PRESETS.map(
      (a) => `<button type="button" class="chip ${a.id === 'all' ? 'active' : ''}" data-award="${a.id}">${escapeHtml(a.label)}</button>`
    ).join('');

    $('availabilityPills').innerHTML = CFG.AVAILABILITY_OPTIONS.map(
      (opt) => `<button type="button" class="chip" data-availability="${opt.id}">${escapeHtml(opt.label)}</button>`
    ).join('');

    syncFilterBadges();
  }

  function toggleEntityFilter(type, entity) {
    const list = type === 'author' ? state.filters.authors : state.filters.publishers;
    const normId = String(entity.id).toLowerCase();
    const idx = list.findIndex((item) => String(item.id).toLowerCase() === normId);
    let added = false;

    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push({ id: entity.id, name: entity.name || entity.id });
      added = true;
    }

    syncEntityUI(type);
    syncFilterBadges();
    return added;
  }

  function syncEntityUI(type) {
    if (type === 'author') {
      renderSelectedTags('selectedAuthorTags', state.filters.authors, 'author');
      $('authorPresets').querySelectorAll('[data-author-preset]').forEach((btn) => {
        const active = state.filters.authors.some(
          (a) => String(a.id).toLowerCase() === String(btn.dataset.authorPreset).toLowerCase()
        );
        btn.classList.toggle('active', active);
        btn.textContent = `${active ? '✓ ' : ''}${btn.dataset.authorName}`;
      });
    } else if (type === 'publisher') {
      renderSelectedTags('selectedPublisherTags', state.filters.publishers, 'publisher');
      $('publisherPresets').querySelectorAll('[data-publisher-preset]').forEach((btn) => {
        const active = state.filters.publishers.some(
          (p) => String(p.id).toLowerCase() === String(btn.dataset.publisherPreset).toLowerCase()
        );
        btn.classList.toggle('active', active);
        btn.textContent = `${active ? '✓ ' : ''}${btn.dataset.publisherName}`;
      });
    }
  }

  function renderSelectedTags(containerId, items, type) {
    $(containerId).innerHTML = items
      .map(
        (item) => `
      <button type="button" class="tag-removable" data-remove-tag="${type}" data-tag-id="${escapeHtml(item.id)}" title="Tap to deselect ${escapeHtml(item.name)}">
        <span>✓ ${escapeHtml(item.name)}</span>
        <span aria-hidden="true">×</span>
      </button>`
      )
      .join('');
  }

  function syncFilterBadges() {
    const f = state.filters;
    const fmtLabel = CFG.FORMATS[f.format]?.label || 'All Books';
    const langObj = CFG.LANGUAGES.find((l) => l.code === f.language);
    const langLabel = f.language ? (langObj?.name.slice(0, 3).toUpperCase() || f.language.toUpperCase()) : 'Any';
    $('badge-format').textContent = `${fmtLabel} · ${langLabel}`;

    const gNames = f.genres.map((id) => CFG.GENRES.find((g) => g.id === id)?.name || id);
    $('badge-genre').textContent = gNames.length
      ? `${gNames.slice(0, 2).join(f.genreLogic === 'OR' ? ' / ' : ' + ')}${gNames.length > 2 ? ` +${gNames.length - 2}` : ''}`
      : 'Any';

    $('badge-goodreads').textContent = f.minGoodreads > 0 ? `${f.minGoodreads.toFixed(1)}★+` : 'Any';
    $('badge-storygraph').textContent = f.minStorygraph > 0 ? `${f.minStorygraph.toFixed(1)}★+` : 'Any';

    $('badge-author').textContent = f.authors.length
      ? f.authors.map((a) => a.name.split(' ').slice(-1)[0]).join(f.authorLogic === 'OR' ? ' / ' : ' & ')
      : 'Any';

    const tNames = f.themes.map((id) => CFG.THEMES_MOODS.find((t) => t.id === id)?.name || id);
    $('badge-theme').textContent = tNames.length
      ? `${tNames.slice(0, 2).join(f.themeLogic === 'OR' ? ' / ' : ' + ')}${tNames.length > 2 ? ` +${tNames.length - 2}` : ''}`
      : 'Any';

    $('badge-publisher').textContent = f.publishers.length
      ? f.publishers.map((p) => p.name).join(f.publisherLogic === 'OR' ? ' / ' : ' & ')
      : 'Any';

    $('badge-era').textContent = f.yearFrom || f.yearTo ? `${f.yearFrom || '…'}–${f.yearTo || '…'}` : 'All Eras';
    $('badge-awards').textContent = CFG.AWARDS_PRESETS.find((a) => a.id === f.awards)?.label || 'All Books';

    const lenParts = [];
    if (f.maxPages < 900) lenParts.push(`≤${f.maxPages}p`);
    if (f.availability.length) lenParts.push(`${f.availability.length} access`);
    $('badge-length').textContent = lenParts.length ? lenParts.join(' · ') : 'Any';

    setPopoverActive('format', f.format !== 'all' || Boolean(f.language));
    setPopoverActive('genre', f.genres.length > 0);
    setPopoverActive('goodreads', f.minGoodreads > 0);
    setPopoverActive('storygraph', f.minStorygraph > 0);
    setPopoverActive('author', f.authors.length > 0);
    setPopoverActive('theme', f.themes.length > 0);
    setPopoverActive('publisher', f.publishers.length > 0);
    setPopoverActive('era', Boolean(f.yearFrom || f.yearTo));
    setPopoverActive('awards', f.awards !== 'all');
    setPopoverActive('length', f.maxPages < 900 || f.availability.length > 0);

    renderActiveFilterStrip();
  }

  function setPopoverActive(boxKey, isActive) {
    document.querySelector(`[data-filter-box="${boxKey}"]`)?.classList.toggle('has-value', isActive);
  }

  function renderActiveFilterStrip() {
    const f = state.filters;
    const chips = [];
    if (f.format && f.format !== 'all') {
      chips.push({ type: 'format', id: '', label: CFG.FORMATS[f.format]?.label || f.format });
    }
    if (f.language) {
      const langName = CFG.LANGUAGES.find((l) => l.code === f.language)?.name || f.language.toUpperCase();
      chips.push({ type: 'language', id: '', label: `Lang: ${langName}` });
    }
    if (f.minGoodreads > 0) chips.push({ type: 'goodreads', id: '', label: `Goodreads ≥ ${f.minGoodreads.toFixed(1)}★` });
    if (f.minStorygraph > 0) chips.push({ type: 'storygraph', id: '', label: `StoryGraph ≥ ${f.minStorygraph.toFixed(1)}★` });
    f.genres.forEach((id) => {
      const g = CFG.GENRES.find((x) => x.id === id);
      if (g) chips.push({ type: 'genre', id, label: g.name });
    });
    f.authors.forEach((a) => chips.push({ type: 'author', id: a.id, label: a.name }));
    f.themes.forEach((id) => {
      const t = CFG.THEMES_MOODS.find((x) => x.id === id);
      if (t) chips.push({ type: 'theme', id, label: t.name });
    });
    f.publishers.forEach((p) => chips.push({ type: 'publisher', id: p.id, label: p.name }));
    if (f.yearFrom || f.yearTo) chips.push({ type: 'era', id: '', label: `${f.yearFrom || '…'}–${f.yearTo || '…'}` });
    if (f.awards !== 'all') chips.push({ type: 'awards', id: '', label: CFG.AWARDS_PRESETS.find((a) => a.id === f.awards)?.label || f.awards });
    if (f.maxPages < 900) chips.push({ type: 'pages', id: '', label: `Under ${f.maxPages} pages` });
    f.availability.forEach((id) => {
      const opt = CFG.AVAILABILITY_OPTIONS.find((x) => x.id === id);
      if (opt) chips.push({ type: 'availability', id, label: opt.label });
    });

    const strip = $('activeFiltersStrip');
    if (!chips.length) {
      strip.classList.add('hidden');
      strip.innerHTML = '';
      return;
    }
    strip.classList.remove('hidden');
    strip.innerHTML = chips
      .map(
        (c) => `
      <button type="button" class="tag-removable" data-strip-remove="${c.type}" data-strip-id="${escapeHtml(c.id)}">
        <span>${escapeHtml(c.label)}</span>
        <span aria-hidden="true">×</span>
      </button>`
      )
      .join('');
  }

  /* ---------- Discovery, Search & Universal Sorter ---------- */
  function syncSorterUI(sortVal) {
    state.filters.sort = sortVal;
    $('sortSelect').value = sortVal;
    document.querySelectorAll('.sort-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sortVal === sortVal);
    });
  }

  function renderDiscoverGrid(items, append = false, metaPrefix = '') {
    const grid = $('discoverGrid');

    if (!append) state.currentResults = items;
    else {
      const seen = new Set(state.currentResults.map((x) => x.id));
      items.forEach((it) => {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          state.currentResults.push(it);
        }
      });
    }

    const preserveOrder =
      (state.discoverMode === 'search' || state.discoverMode === 'ai') &&
      state.filters.sort === 'popularity.desc';
    const displayList = API.sortAndSanitize(state.currentResults, state.filters.sort, preserveOrder);
    $('resultsMeta').textContent = `${metaPrefix}${displayList.length} book${displayList.length === 1 ? '' : 's'}`;

    if (!displayList.length) {
      grid.innerHTML = `<div class="empty-state">No books match that exact combination. Try switching an <strong>AND</strong> filter to <strong>OR</strong>, or tap an active chip above to remove it.</div>`;
      return;
    }

    grid.innerHTML = displayList.map((item) => createCardHTML(item)).join('');
    attachCoverFallbacks(grid);
    hydrateMissingCovers(grid, displayList);
  }

  async function runDiscover(page = 1, append = false) {
    closeAllPopovers();
    const seq = ++state.discoverSeq;
    state.discoverMode = 'filter';
    state.discoverPage = page;
    if (!append) {
      $('discoverGrid').innerHTML = createSkeletonCards(8);
      $('resultsMeta').textContent = 'Querying literary archive…';
    }

    try {
      const data = await API.discoverWithFilters(state.filters, page);
      if (seq !== state.discoverSeq) return;
      state.discoverTotalPages = data.total_pages;
      renderDiscoverGrid(data.results, append, 'Showing ');
      $('paginationBar').classList.toggle('hidden', page >= state.discoverTotalPages);
    } catch (err) {
      if (seq !== state.discoverSeq) return;
      $('discoverGrid').innerHTML = `<div class="empty-state">Unable to load books (${escapeHtml(err.message)}).</div>`;
    }
  }

  async function runConciergeSearch(query, useAI = false, page = 1, append = false) {
    const clean = query.trim();
    if (!clean) return;

    const seq = ++state.discoverSeq;
    if (!append) {
      switchView('discover', { skipAutoDiscover: true });
      syncSorterUI('popularity.desc');
      state.lastQuery = clean;
      state.discoverPage = 1;
      $('paginationBar').classList.add('hidden');
    } else {
      state.discoverPage = page;
    }

    if (useAI && !API.getGeminiKey()) {
      showToast('Add a Gemini API Key in Settings for AI Discover. Searching Open Library.');
      useAI = false;
    }

    if (!append) {
      $('discoverGrid').innerHTML = createSkeletonCards(8);
      $('resultsMeta').textContent = useAI ? '✦ Consulting Gemini Literary Grounding…' : `Searching “${clean}”…`;
    }

    try {
      let results = [];
      let totalPages = 1;
      let prefix = `Search “${clean}” — `;
      if (useAI && !append) {
        state.discoverMode = 'ai';
        results = (await API.aiNaturalLanguageDiscover(clean)) || [];
        prefix = `✦ AI Grounded “${clean}” — `;
      }
      if (!useAI || !results.length) {
        state.discoverMode = 'search';
        const data = await API.searchBooks(clean, page);
        results = data.results;
        totalPages = data.total_pages;
      }
      if (seq !== state.discoverSeq) return;
      state.discoverTotalPages = totalPages;
      renderDiscoverGrid(results, append, prefix);
      $('paginationBar').classList.toggle('hidden', state.discoverMode !== 'search' || page >= totalPages);
    } catch (err) {
      if (seq !== state.discoverSeq) return;
      $('discoverGrid').innerHTML = `<div class="empty-state">Search failed: ${escapeHtml(err.message)}</div>`;
    }
  }

  function handleSortChange(newSort) {
    syncSorterUI(newSort);
    if (state.discoverMode === 'filter') {
      runDiscover(1, false);
    } else if (state.currentResults.length) {
      const prefix = state.discoverMode === 'ai' ? `✦ AI Grounded “${state.lastQuery}” — ` : `Search “${state.lastQuery}” — `;
      renderDiscoverGrid(state.currentResults, false, prefix);
    }
  }

  /* ---------- Book Card & Cloth-Bound Fallback ---------- */
  function buildCoverPlaceholderHTML(title, author, extraClass = '') {
    return `
      <div class="poster-placeholder ${extraClass}">
        <span class="book-spine-ornament" aria-hidden="true">◆</span>
        <span class="book-placeholder-title">${escapeHtml(title)}</span>
        <span class="book-placeholder-author">${escapeHtml(author || '')}</span>
      </div>`;
  }

  function attachCoverFallbacks(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('img[data-fallback-title]').forEach((img) => {
      if (img.dataset.fallbackBound === '1') {
        if (img.complete && img.naturalWidth > 2 && img.naturalHeight > 2) img.classList.add('is-loaded');
        return;
      }
      img.dataset.fallbackBound = '1';

      let triedSecondary = false;
      let swapped = false;

      const swap = () => {
        if (swapped || !img.parentNode) return;
        swapped = true;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = buildCoverPlaceholderHTML(
          img.dataset.fallbackTitle,
          img.dataset.fallbackAuthor,
          img.classList.contains('hero-book-jacket') ? 'hero-book-jacket' : img.classList.contains('detail-poster') ? 'detail-poster' : ''
        ).trim();
        img.replaceWith(wrapper.firstElementChild);
      };

      const handleFailure = () => {
        const secondary = img.dataset.fallbackSrc;
        if (!triedSecondary && secondary && img.src !== secondary) {
          triedSecondary = true;
          img.src = secondary;
          return;
        }
        swap();
      };

      const handleLoad = () => {
        if (img.naturalWidth <= 2 || img.naturalHeight <= 2) {
          handleFailure();
        } else {
          img.classList.add('is-loaded');
        }
      };

      img.addEventListener('error', handleFailure);
      img.addEventListener('load', handleLoad);
      if (img.complete) handleLoad();
    });
  }

  function hydrateMissingCovers(rootEl, items) {
    if (!rootEl || !Array.isArray(items) || typeof API.hydrateWikiCover !== 'function') return;
    const missing = items.filter((it) => !it.posterUrl && it.wikiTitle);
    if (!missing.length) return;

    missing.forEach((item) => {
      API.hydrateWikiCover(item)
        .then((url) => {
          if (!url || !rootEl.isConnected) return;
          const card = rootEl.querySelector(`.media-card[data-id="${CSS.escape(item.id)}"]`);
          const placeholder = card?.querySelector('.poster-wrap .poster-placeholder');
          if (!card || !placeholder) return;

          const img = document.createElement('img');
          img.src = url;
          img.alt = item.displayTitle;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.dataset.fallbackSrc = item.fallbackPosterUrl || '';
          img.dataset.fallbackTitle = item.displayTitle;
          img.dataset.fallbackAuthor = item.authorDisplay || '';
          placeholder.replaceWith(img);
          attachCoverFallbacks(card);
        })
        .catch(() => {});
    });
  }

  function serializeShelfPayload(item) {
    return encodeURIComponent(
      JSON.stringify({
        id: item.id,
        displayTitle: item.displayTitle,
        authorDisplay: item.authorDisplay,
        displayYear: item.displayYear,
        pages: item.pages || null,
        posterUrl: item.posterUrl || '',
        fallbackPosterUrl: item.fallbackPosterUrl || '',
        goodreadsScore: item.goodreadsScore,
        storygraphScore: item.storygraphScore,
        hasGoodreads: Boolean(item.hasGoodreads),
        hasStorygraph: Boolean(item.hasStorygraph),
        awardBadge: item.awardBadge || ''
      })
    );
  }

  function createCardHTML(item) {
    const saved = isInShelf(item.id);
    const metaData = serializeShelfPayload(item);

    return `
      <article class="media-card" data-action="open-detail" data-id="${escapeHtml(item.id)}" data-payload="${metaData}">
        <div class="poster-wrap">
          ${
            item.posterUrl
              ? `<img src="${item.posterUrl}" data-fallback-src="${escapeHtml(item.fallbackPosterUrl || '')}" alt="${escapeHtml(item.displayTitle)}" loading="lazy" decoding="async" data-fallback-title="${escapeHtml(item.displayTitle)}" data-fallback-author="${escapeHtml(item.authorDisplay)}" />`
              : buildCoverPlaceholderHTML(item.displayTitle, item.authorDisplay)
          }
          ${item.awardBadge ? `<span class="card-laurel">${SVG_LAUREL} PRIZE</span>` : ''}
          <button
            type="button"
            class="card-wl-btn ${saved ? 'saved' : ''}"
            data-action="card-shelf"
            data-payload="${metaData}"
            aria-label="Toggle Reading Shelf"
          >${saved ? '✓' : '+'}</button>
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(item.displayTitle)}</h3>
          <div class="card-sub">${escapeHtml(item.authorDisplay)}</div>
          <div class="card-meta-sub">${item.displayYear}${item.pages ? ` · ${item.pages} pp.` : ''}</div>
          ${item.aiReason ? `<div class="card-sub" style="color:var(--accent);">${escapeHtml(item.aiReason)}</div>` : ''}
          <div class="ratings-strip">
            ${item.hasGoodreads ? `<span class="rating-pill rating-gr">★ ${item.goodreadsScore.toFixed(2)}</span>` : ''}
            ${item.hasStorygraph ? `<span class="rating-pill rating-sg">${SVG_SG_BARS} ${item.storygraphScore.toFixed(2)}</span>` : ''}
            ${!item.hasGoodreads && !item.hasStorygraph ? `<span class="rating-pill rating-unrated">Unrated</span>` : ''}
          </div>
        </div>
      </article>`;
  }

  /* ---------- Book Dossier Modal & Reading Room ---------- */
  async function openDetailModal(workId, fallbackPayload = null) {
    const modal = $('detailModal');
    const body = $('detailModalBody');
    modal.classList.remove('hidden');
    body.innerHTML = `<div class="empty-state" style="border:none;">Retrieving literary dossier…</div>`;

    try {
      const d = await API.fetchBookDetails(workId, fallbackPayload);
      const saved = isInShelf(d.id);
      const subjectsLine = (d.subjects || []).slice(0, 5).join(' · ');
      const publishersLine = (d.publishers || []).slice(0, 3).join(', ');
      const readingTime = d.pages ? `~${Math.max(1, Math.round(d.pages / 40))}h read` : '';
      const goodreadsSearch = `https://www.goodreads.com/search?q=${encodeURIComponent(`${d.displayTitle} ${d.authorDisplay}`)}`;
      const storygraphSearch = `https://app.thestorygraph.com/browse?search_term=${encodeURIComponent(`${d.displayTitle} ${d.authorDisplay}`)}`;
      const detailCover = d.coverLargeUrl || d.posterUrl || '';

      body.innerHTML = `
        <div class="detail-banner detail-book-banner" ${detailCover ? `style="background-image:url('${detailCover}')"` : ''}></div>
        <div class="detail-content">
          ${
            detailCover
              ? `<img class="detail-poster" src="${detailCover}" data-fallback-src="${escapeHtml(d.fallbackPosterUrl || '')}" alt="${escapeHtml(d.displayTitle)}" decoding="async" data-fallback-title="${escapeHtml(d.displayTitle)}" data-fallback-author="${escapeHtml(d.authorDisplay)}" />`
              : buildCoverPlaceholderHTML(d.displayTitle, d.authorDisplay, 'detail-poster')
          }
          <div>
            <p class="eyebrow">LITERARY DOSSIER · ${d.displayYear}${d.pages ? ` · ${d.pages} PAGES (${readingTime})` : ''}</p>
            <h2 class="detail-title" id="detailTitle">${escapeHtml(d.displayTitle)}</h2>
            <div class="detail-meta-line">By <strong>${escapeHtml(d.authorDisplay)}</strong>${subjectsLine ? ` · ${escapeHtml(subjectsLine)}` : ''}</div>

            <div class="detail-badges-row">
              ${d.hasGoodreads ? `<span class="rating-pill rating-gr" id="detailGrPill">Goodreads ${d.goodreadsScore.toFixed(2)}/5</span>` : ''}
              ${d.hasStorygraph ? `<span class="rating-pill rating-sg" id="detailSgPill">${SVG_SG_BARS} StoryGraph ${d.storygraphScore.toFixed(2)}/5</span>` : ''}
              ${
                d.awardBadge
                  ? `<span class="award-badge" id="detailAwardBadge">${SVG_LAUREL} ${escapeHtml(d.awardBadge)}</span>`
                  : '<span class="award-badge hidden" id="detailAwardBadge"></span>'
              }
            </div>

            <p class="detail-overview">${escapeHtml(d.description || 'Explore this edition’s opening lines, publishers, and bibliographic metadata in the archive.')}</p>

            ${
              d.firstSentence
                ? `<blockquote class="detail-first-line"><span class="eyebrow">OPENING LINE</span>“${escapeHtml(d.firstSentence)}”</blockquote>`
                : ''
            }

            <div class="detail-credits">
              <div><strong>Author</strong>${escapeHtml(d.authorDisplay)}</div>
              <div><strong>Publishers</strong>${escapeHtml(publishersLine || 'Various Editions')}</div>
              <div><strong>First Published</strong>${escapeHtml(d.displayYear)}${d.editionCount ? ` · ${d.editionCount} editions` : ''}</div>
              ${d.isbn ? `<div><strong>ISBN</strong>${escapeHtml(d.isbn)}</div>` : ''}
            </div>

            <div class="detail-actions">
              <button class="btn-accent" id="detailOpenReaderBtn">Open Reading Room</button>
              <button class="btn-outline" id="detailShelfBtn">${saved ? '✓ On Reading Shelf' : '+ Reading Shelf'}</button>
              <a class="btn-ghost" target="_blank" rel="noopener noreferrer" href="${d.openLibraryUrl}">Open Library ↗</a>
              <a class="btn-ghost" target="_blank" rel="noopener noreferrer" href="${goodreadsSearch}">Goodreads ↗</a>
              <a class="btn-ghost" target="_blank" rel="noopener noreferrer" href="${storygraphSearch}">StoryGraph ↗</a>
            </div>
          </div>
        </div>`;

      attachCoverFallbacks(body);

      $('detailOpenReaderBtn')?.addEventListener('click', () => openReadingRoom(d));
      $('detailShelfBtn')?.addEventListener('click', () => {
        const nowSaved = toggleShelfItem(d);
        $('detailShelfBtn').textContent = nowSaved ? '✓ On Reading Shelf' : '+ Reading Shelf';
      });

      if (API.getGeminiKey()) {
        API.verifyBookPrestige(d.id, d.displayTitle, d.authorDisplay).then((verified) => {
          if (!verified) return;
          if (verified.goodreads && $('detailGrPill')) {
            $('detailGrPill').textContent = `Goodreads ${Number(verified.goodreads).toFixed(2)}/5 ✓`;
          }
          if (verified.storygraph && $('detailSgPill')) {
            $('detailSgPill').innerHTML = `${SVG_SG_BARS} StoryGraph ${Number(verified.storygraph).toFixed(2)}/5 ✓`;
          }
          if (verified.awardsSummary && $('detailAwardBadge')) {
            $('detailAwardBadge').innerHTML = `${SVG_LAUREL} ${escapeHtml(verified.awardsSummary)}`;
            $('detailAwardBadge').classList.remove('hidden');
          }
        });
      }
    } catch (err) {
      body.innerHTML = `<div class="empty-state">Unable to load book details (${escapeHtml(err.message)}).</div>`;
    }
  }

  function openReadingRoom(book) {
    $('readerTitleText').textContent = `${book.displayTitle} — ${book.authorDisplay}`;
    $('readerExternalLink').href = book.openLibraryUrl || `${CFG.OPEN_LIBRARY_BASE}/works/${encodeURIComponent(book.id)}`;

    const excerptsHtml = (book.excerpts || [])
      .slice(0, 4)
      .map(
        (ex) => `
        <figure class="reader-excerpt-block">
          <blockquote>“${escapeHtml(ex.text)}”</blockquote>
          ${ex.comment ? `<figcaption>— ${escapeHtml(ex.comment)}</figcaption>` : ''}
        </figure>`
      )
      .join('');

    const iaReadLink = book.iaId
      ? `https://archive.org/details/${encodeURIComponent(book.iaId)}`
      : book.openLibraryUrl;

    const accessLabel =
      book.ebookAccess === 'public'
        ? 'Read Full Public Domain Edition ↗'
        : book.ebookAccess === 'borrowable'
        ? 'Borrow Digital Edition on Open Library ↗'
        : 'Browse Editions on Open Library ↗';

    $('readerStage').innerHTML = `
      <div class="reader-paper">
        <div class="reader-folio-head">
          <span class="eyebrow">${escapeHtml(book.authorDisplay)} · ${book.displayYear}${book.pages ? ` · ${book.pages} PAGES` : ''}</span>
          <h2 class="reader-book-title">${escapeHtml(book.displayTitle)}</h2>
        </div>

        ${
          book.firstSentence
            ? `<div class="reader-section">
                 <span class="panel-label">First Line</span>
                 <p class="reader-lead-quote">“${escapeHtml(book.firstSentence)}”</p>
               </div>`
            : ''
        }

        ${
          excerptsHtml
            ? `<div class="reader-section">
                 <span class="panel-label">Archived Excerpts</span>
                 ${excerptsHtml}
               </div>`
            : ''
        }

        <div class="reader-section">
          <span class="panel-label">Editorial Synopsis</span>
          <p class="reader-prose">${escapeHtml(book.description || 'No extended synopsis is archived for this work yet. Open this edition on Open Library to inspect previews and lending copies.')}</p>
        </div>

        ${
          book.subjectPlaces?.length || book.subjectTimes?.length
            ? `<div class="reader-meta-tags">
                 ${(book.subjectPlaces || []).map((p) => `<span class="chip">${escapeHtml(p)}</span>`).join('')}
                 ${(book.subjectTimes || []).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}
               </div>`
            : ''
        }

        <div class="reader-footer-cta">
          <a class="btn-accent" href="${iaReadLink}" target="_blank" rel="noopener noreferrer">${accessLabel}</a>
        </div>
      </div>`;

    $('readerModal').classList.remove('hidden');
  }

  function closeReadingRoom() {
    $('readerStage').innerHTML = '';
    $('readerModal').classList.add('hidden');
  }

  /* ---------- Reading Shelf ---------- */
  function getShelfKey() {
    return CFG.STORAGE_KEYS.SHELF_PREFIX + (state.activeUser || 'guest');
  }

  function getShelf() {
    try {
      return JSON.parse(localStorage.getItem(getShelfKey()) || '[]');
    } catch {
      return [];
    }
  }

  function saveShelf(list) {
    localStorage.setItem(getShelfKey(), JSON.stringify(list));
    updateShelfBadge();
  }

  function isInShelf(workId) {
    return getShelf().some((x) => x.id === workId);
  }

  function toggleShelfItem(item) {
    const list = getShelf();
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      list.splice(idx, 1);
      saveShelf(list);
      showToast(`Removed “${item.displayTitle}” from shelf`);
      if (state.view === 'shelf') renderShelfView();
      return false;
    }
    list.unshift({
      id: item.id,
      displayTitle: item.displayTitle,
      authorDisplay: item.authorDisplay || 'Unknown Author',
      displayYear: item.displayYear || '—',
      pages: item.pages || null,
      posterUrl: item.posterUrl || '',
      goodreadsScore: item.goodreadsScore,
      storygraphScore: item.storygraphScore,
      hasGoodreads: Boolean(item.goodreadsScore),
      hasStorygraph: Boolean(item.storygraphScore),
      awardBadge: item.awardBadge || '',
      finished: false,
      addedAt: Date.now()
    });
    saveShelf(list);
    showToast(`Shelved “${item.displayTitle}”`);
    return true;
  }

  function updateShelfBadge() {
    const count = getShelf().length;
    $('shelfCountBadge').textContent = count;
    $('mobileShelfBadge').textContent = count;
  }

  function renderShelfView() {
    const users = JSON.parse(localStorage.getItem(CFG.STORAGE_KEYS.USERS) || '{}');
    const displayName = state.activeUser ? users[state.activeUser]?.displayName || state.activeUser : 'Guest';
    $('shelfHeading').textContent = `${displayName}’s Reading Shelf`;

    const list = getShelf();
    const filtered = list.filter((b) => {
      if (state.shelfFilter === 'finished') return b.finished;
      if (state.shelfFilter === 'toread') return !b.finished;
      return true;
    });

    const grid = $('shelfGrid');
    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state">No books shelved here yet. Tap <strong>+</strong> on any cover to build your personal library.</div>`;
      return;
    }

    grid.innerHTML = filtered
      .map(
        (item) => `
      <article class="media-card" data-action="open-detail" data-id="${escapeHtml(item.id)}" data-payload="${serializeShelfPayload(item)}">
        <div class="poster-wrap">
          ${
            item.posterUrl
              ? `<img src="${item.posterUrl}" data-fallback-src="${escapeHtml(item.fallbackPosterUrl || '')}" alt="${escapeHtml(item.displayTitle)}" loading="lazy" decoding="async" data-fallback-title="${escapeHtml(item.displayTitle)}" data-fallback-author="${escapeHtml(item.authorDisplay)}" />`
              : buildCoverPlaceholderHTML(item.displayTitle, item.authorDisplay)
          }
          <button type="button" class="card-wl-btn ${item.finished ? 'saved' : ''}" data-action="toggle-finished" data-id="${escapeHtml(item.id)}" title="Mark Finished / To Read">
            ${item.finished ? '✓' : '○'}
          </button>
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(item.displayTitle)}</h3>
          <div class="card-sub">${escapeHtml(item.authorDisplay)}</div>
          <div class="card-meta-sub">${item.displayYear} · ${item.finished ? 'Finished' : 'To Read'}</div>
          <div class="ratings-strip">
            ${item.goodreadsScore ? `<span class="rating-pill rating-gr">★ ${Number(item.goodreadsScore).toFixed(2)}</span>` : ''}
            ${item.storygraphScore ? `<span class="rating-pill rating-sg">${SVG_SG_BARS} ${Number(item.storygraphScore).toFixed(2)}</span>` : ''}
          </div>
        </div>
      </article>`
      )
      .join('');
    attachCoverFallbacks(grid);
  }

  /* ---------- Member Auth (Log In / Sign Up) ---------- */
  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function openAuthModal(mode = 'login') {
    state.authMode = mode;
    $('authErrorText').classList.add('hidden');
    $('authForm').reset();
    updateAuthUI();
    $('authModal').classList.remove('hidden');
  }

  function updateAuthUI() {
    const users = JSON.parse(localStorage.getItem(CFG.STORAGE_KEYS.USERS) || '{}');
    const isSignedIn = Boolean(state.activeUser && users[state.activeUser]);

    $('guestAuthButtons').classList.toggle('hidden', isSignedIn);
    $('memberProfileBtn').classList.toggle('hidden', !isSignedIn);

    if (isSignedIn) {
      const profile = users[state.activeUser];
      const name = profile.displayName || state.activeUser;
      $('memberAvatarInitial').textContent = name.charAt(0).toUpperCase();
      $('memberHandleLabel').textContent = `@${state.activeUser}`;
      $('signedInUserLabel').textContent = `${name} (@${state.activeUser})`;
      $('signedInStats').textContent = `${getShelf().length} saved book${getShelf().length === 1 ? '' : 's'} on shelf`;

      $('authTabs').classList.add('hidden');
      $('authForm').classList.add('hidden');
      $('signedInPanel').classList.remove('hidden');
      $('authModalTitle').textContent = 'Member Library';
    } else {
      const isSignup = state.authMode === 'signup';
      $('authTabs').classList.remove('hidden');
      $('authForm').classList.remove('hidden');
      $('signedInPanel').classList.add('hidden');
      $('authDisplayNameRow').classList.toggle('hidden', !isSignup);
      $('authConfirmRow').classList.toggle('hidden', !isSignup);
      $('authConfirmPassword').required = isSignup;
      $('authSubmitBtn').textContent = isSignup ? 'Create Account' : 'Log In';
      $('authModalTitle').textContent = isSignup ? 'Join Would Read That' : 'Log In to Would Read That';

      document.querySelectorAll('.auth-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.authMode === state.authMode);
      });
    }
    updateShelfBadge();
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    const username = $('authUsername').value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const password = $('authPassword').value;
    const errEl = $('authErrorText');
    errEl.classList.add('hidden');

    if (username.length < 3) {
      errEl.textContent = 'Username must be at least 3 letters or numbers.';
      errEl.classList.remove('hidden');
      return;
    }

    const users = JSON.parse(localStorage.getItem(CFG.STORAGE_KEYS.USERS) || '{}');
    const hashed = await sha256(`${username}::wrt_library_salt::${password}`);

    if (state.authMode === 'signup') {
      if (password !== $('authConfirmPassword').value) {
        errEl.textContent = 'Passwords do not match.';
        errEl.classList.remove('hidden');
        return;
      }
      if (users[username]) {
        errEl.textContent = 'Username already registered. Please log in.';
        errEl.classList.remove('hidden');
        return;
      }
      const displayName = $('authDisplayName').value.trim() || username;
      users[username] = { hash: hashed, displayName, createdAt: Date.now() };
      localStorage.setItem(CFG.STORAGE_KEYS.USERS, JSON.stringify(users));
      state.activeUser = username;
      localStorage.setItem(CFG.STORAGE_KEYS.ACTIVE_USER, username);
      showToast(`Welcome, ${displayName}!`);
    } else {
      if (!users[username] || users[username].hash !== hashed) {
        errEl.textContent = 'Incorrect username or password.';
        errEl.classList.remove('hidden');
        return;
      }
      state.activeUser = username;
      localStorage.setItem(CFG.STORAGE_KEYS.ACTIVE_USER, username);
      showToast(`Signed in as @${username}`);
    }

    $('authModal').classList.add('hidden');
    updateAuthUI();
    if (state.view === 'shelf') renderShelfView();
  }

  /* ---------- Event Wiring ---------- */
  function bindGlobalEvents() {
    // Desktop & Mobile Dock Navigation
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.querySelectorAll('.dock-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dest = btn.dataset.mobileNav;
        if (dest === 'search') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => $('conciergeInput').focus(), 220);
          return;
        }
        switchView(dest);
      });
    });
    $('brandHomeBtn').addEventListener('click', (e) => {
      e.preventDefault();
      switchView('home');
    });

    // Popover / Mobile Sheet Triggers
    document.querySelectorAll('.filter-popover').forEach((box) => {
      const trigger = box.querySelector('.filter-trigger');
      const panel = box.querySelector('.filter-panel');
      const closeBtn = box.querySelector('.sheet-close-btn');
      const doneBtn = box.querySelector('.sheet-done-btn');

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !box.classList.contains('open');
        closeAllPopovers(willOpen ? box : null);
        box.classList.toggle('open', willOpen);
        panel.classList.toggle('hidden', !willOpen);
        trigger.setAttribute('aria-expanded', String(willOpen));
      });

      panel.addEventListener('click', (e) => e.stopPropagation());
      closeBtn?.addEventListener('click', () => closeAllPopovers());
      doneBtn?.addEventListener('click', () => runDiscover(1, false));
    });

    $('sheetBackdrop').addEventListener('click', () => closeAllPopovers());
    document.addEventListener('click', () => closeAllPopovers());

    // AND / OR Segmented Switches
    document.querySelectorAll('[data-logic-toggle]').forEach((group) => {
      group.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-logic-val]');
        if (!btn) return;
        const target = group.dataset.logicToggle;
        const val = btn.dataset.logicVal;
        group.querySelectorAll('.logic-btn').forEach((b) => b.classList.toggle('active', b === btn));

        if (target === 'genre') {
          state.filters.genreLogic = val;
          $('genreLogicHint').innerHTML =
            val === 'AND'
              ? 'Matching books that span <strong>all</strong> selected genres.'
              : 'Matching books that belong to <strong>any</strong> selected genre.';
        } else if (target === 'author') {
          state.filters.authorLogic = val;
          $('authorLogicHint').innerHTML =
            val === 'AND'
              ? 'Tap an author to toggle. <strong>AND</strong> finds works co-authored by all selected authors.'
              : 'Tap an author to select, or tap again to deselect. <strong>OR</strong> shows books by any selected author.';
        } else if (target === 'theme') {
          state.filters.themeLogic = val;
          $('themeLogicHint').innerHTML =
            val === 'AND'
              ? 'Finding books combining <strong>all</strong> selected themes.'
              : 'Finding books matching <strong>any</strong> selected theme or mood.';
        } else if (target === 'publisher') {
          state.filters.publisherLogic = val;
        }
        syncFilterBadges();
      });
    });

    // Hero Touch Swipe + Arrows
    let touchStartX = 0;
    $('heroSpotlight').addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    $('heroSpotlight').addEventListener(
      'touchend',
      (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 45) stepHero(dx < 0 ? 1 : -1);
      },
      { passive: true }
    );
    $('heroPrevBtn').addEventListener('click', () => stepHero(-1));
    $('heroNextBtn').addEventListener('click', () => stepHero(1));
    $('heroDots').addEventListener('click', (e) => {
      const dot = e.target.closest('[data-hero-dot]');
      if (!dot) return;
      state.heroIndex = Number(dot.dataset.heroDot);
      renderHeroSlide();
      startHeroAutoRotate();
    });

    // Search
    $('conciergeSearchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      runConciergeSearch($('conciergeInput').value, false);
    });
    $('aiConciergeBtn').addEventListener('click', () => runConciergeSearch($('conciergeInput').value, true));
    $('conciergeInput').addEventListener('input', (e) => $('clearSearchBtn').classList.toggle('hidden', !e.target.value));
    $('clearSearchBtn').addEventListener('click', () => {
      $('conciergeInput').value = '';
      $('clearSearchBtn').classList.add('hidden');
    });

    // Delegated Card & Hero Actions
    document.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;

      if (action === 'card-shelf') {
        e.stopPropagation();
        const item = JSON.parse(decodeURIComponent(target.dataset.payload));
        const nowSaved = toggleShelfItem(item);
        target.classList.toggle('saved', nowSaved);
        target.textContent = nowSaved ? '✓' : '+';
        return;
      }
      if (action === 'toggle-finished') {
        e.stopPropagation();
        const list = getShelf();
        const found = list.find((x) => x.id === target.dataset.id);
        if (found) {
          found.finished = !found.finished;
          saveShelf(list);
          renderShelfView();
        }
        return;
      }
      if (action === 'toggle-hero-shelf') {
        const item = JSON.parse(decodeURIComponent(target.dataset.payload));
        toggleShelfItem(item);
        renderHeroSlide();
        return;
      }
      if (action === 'hero-excerpt') {
        try {
          const d = await API.fetchBookDetails(target.dataset.id);
          openReadingRoom(d);
        } catch {
          showToast('Unable to open reading room.');
        }
        return;
      }
      if (action === 'open-detail') {
        let fallback = null;
        if (target.dataset.payload) {
          try { fallback = JSON.parse(decodeURIComponent(target.dataset.payload)); } catch {}
        }
        openDetailModal(target.dataset.id, fallback);
      }
    });

    // Filter Studio Controls
    $('formatPills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-format]');
      if (!btn) return;
      $('formatPills').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      state.filters.format = btn.dataset.format;
      syncFilterBadges();
    });

    $('languageSelect').addEventListener('change', (e) => {
      state.filters.language = e.target.value;
      syncFilterBadges();
    });

    $('genrePills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-genre]');
      if (!btn) return;
      const id = btn.dataset.genre;
      const idx = state.filters.genres.indexOf(id);
      if (idx >= 0) state.filters.genres.splice(idx, 1);
      else state.filters.genres.push(id);
      btn.classList.toggle('active');
      syncFilterBadges();
    });

    // Goodreads & StoryGraph Separate Controls
    $('grPresets').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-gr-preset]');
      if (!btn) return;
      const val = Number(btn.dataset.grPreset);
      $('grPresets').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      state.filters.minGoodreads = val;
      $('minGrRange').value = val;
      $('minGrVal').textContent = val > 0 ? `${val.toFixed(1)}★+` : 'Any';
      syncFilterBadges();
    });
    $('minGrRange').addEventListener('input', (e) => {
      const val = Number(e.target.value);
      state.filters.minGoodreads = val;
      $('minGrVal').textContent = val > 0 ? `${val.toFixed(1)}★+` : 'Any';
      $('grPresets').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', Number(c.dataset.grPreset) === val));
      syncFilterBadges();
    });

    $('sgPresets').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sg-preset]');
      if (!btn) return;
      const val = Number(btn.dataset.sgPreset);
      $('sgPresets').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      state.filters.minStorygraph = val;
      $('minSgRange').value = val;
      $('minSgVal').textContent = val > 0 ? `${val.toFixed(1)}★+` : 'Any';
      syncFilterBadges();
    });
    $('minSgRange').addEventListener('input', (e) => {
      const val = Number(e.target.value);
      state.filters.minStorygraph = val;
      $('minSgVal').textContent = val > 0 ? `${val.toFixed(1)}★+` : 'Any';
      $('sgPresets').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', Number(c.dataset.sgPreset) === val));
      syncFilterBadges();
    });

    // Authors Presets + Live Open Library Autocomplete
    $('authorPresets').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-author-preset]');
      if (!btn) return;
      toggleEntityFilter('author', { id: btn.dataset.authorPreset, name: btn.dataset.authorName });
    });
    wireAuthorAutocomplete();

    // Themes & Moods
    $('themePills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme-mood]');
      if (!btn) return;
      const id = btn.dataset.themeMood;
      const idx = state.filters.themes.indexOf(id);
      if (idx >= 0) state.filters.themes.splice(idx, 1);
      else state.filters.themes.push(id);
      btn.classList.toggle('active');
      syncFilterBadges();
    });

    // Publishers Presets + Enter to add custom publisher
    $('publisherPresets').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-publisher-preset]');
      if (!btn) return;
      toggleEntityFilter('publisher', { id: btn.dataset.publisherPreset, name: btn.dataset.publisherName });
    });
    $('publisherSearchInput').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const val = e.target.value.trim();
      if (!val) return;
      toggleEntityFilter('publisher', { id: val, name: val });
      e.target.value = '';
    });

    // Selected tag removal inside sheets
    $('filterBarShell').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-tag]');
      if (!btn) return;
      toggleEntityFilter(btn.dataset.removeTag, { id: btn.dataset.tagId, name: '' });
    });

    // Active filter strip quick-deselect
    $('activeFiltersStrip').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-strip-remove]');
      if (!btn) return;
      const type = btn.dataset.stripRemove;
      const id = btn.dataset.stripId;

      if (type === 'author' || type === 'publisher') {
        toggleEntityFilter(type, { id, name: '' });
      } else if (type === 'format') {
        state.filters.format = 'all';
        $('formatPills').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.format === 'all'));
      } else if (type === 'genre') {
        state.filters.genres = state.filters.genres.filter((g) => g !== id);
        $('genrePills').querySelector(`[data-genre="${CSS.escape(id)}"]`)?.classList.remove('active');
      } else if (type === 'theme') {
        state.filters.themes = state.filters.themes.filter((t) => t !== id);
        $('themePills').querySelector(`[data-theme-mood="${CSS.escape(id)}"]`)?.classList.remove('active');
      } else if (type === 'goodreads') {
        state.filters.minGoodreads = 0;
        $('minGrRange').value = 0;
        $('minGrVal').textContent = 'Any';
        $('grPresets').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.grPreset === '0'));
      } else if (type === 'storygraph') {
        state.filters.minStorygraph = 0;
        $('minSgRange').value = 0;
        $('minSgVal').textContent = 'Any';
        $('sgPresets').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.sgPreset === '0'));
      } else if (type === 'language') {
        state.filters.language = '';
        $('languageSelect').value = '';
      } else if (type === 'era') {
        state.filters.era = 'all';
        state.filters.yearFrom = '';
        state.filters.yearTo = '';
        $('yearFromInput').value = '';
        $('yearToInput').value = '';
        $('eraPresets').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.era === 'all'));
      } else if (type === 'awards') {
        state.filters.awards = 'all';
        $('awardsPills').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.award === 'all'));
      } else if (type === 'pages') {
        state.filters.maxPages = 900;
        $('maxPagesRange').value = 900;
        $('maxPagesVal').textContent = 'Any';
      } else if (type === 'availability') {
        state.filters.availability = state.filters.availability.filter((a) => a !== id);
        $('availabilityPills').querySelector(`[data-availability="${CSS.escape(id)}"]`)?.classList.remove('active');
      }
      syncFilterBadges();
      runDiscover(1, false);
    });

    // Era & Year
    $('eraPresets').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-era]');
      if (!btn) return;
      $('eraPresets').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const preset = CFG.ERAS.find((x) => x.id === btn.dataset.era);
      state.filters.era = preset.id;
      state.filters.yearFrom = preset.from;
      state.filters.yearTo = preset.to;
      $('yearFromInput').value = preset.from;
      $('yearToInput').value = preset.to;
      syncFilterBadges();
    });
    $('yearFromInput').addEventListener('input', (e) => {
      state.filters.yearFrom = e.target.value;
      syncFilterBadges();
    });
    $('yearToInput').addEventListener('input', (e) => {
      state.filters.yearTo = e.target.value;
      syncFilterBadges();
    });

    // Awards
    $('awardsPills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-award]');
      if (!btn) return;
      $('awardsPills').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      state.filters.awards = btn.dataset.award;
      syncFilterBadges();
    });

    // Length & Edition Access
    $('maxPagesRange').addEventListener('input', (e) => {
      const val = Number(e.target.value);
      state.filters.maxPages = val;
      $('maxPagesVal').textContent = val >= 900 ? 'Any' : `Under ${val} pages`;
      syncFilterBadges();
    });
    $('availabilityPills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-availability]');
      if (!btn) return;
      const id = btn.dataset.availability;
      const idx = state.filters.availability.indexOf(id);
      if (idx >= 0) state.filters.availability.splice(idx, 1);
      else state.filters.availability.push(id);
      btn.classList.toggle('active');
      syncFilterBadges();
    });

    // Sorter Controls
    $('sorterQuickPills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sort-val]');
      if (!btn) return;
      handleSortChange(btn.dataset.sortVal);
    });
    $('sortSelect').addEventListener('change', (e) => handleSortChange(e.target.value));

    $('applyFiltersBtn').addEventListener('click', () => runDiscover(1, false));
    $('loadMoreBtn').addEventListener('click', () => {
      if (state.discoverMode === 'search' && state.lastQuery) {
        runConciergeSearch(state.lastQuery, false, state.discoverPage + 1, true);
      } else {
        runDiscover(state.discoverPage + 1, true);
      }
    });

    $('resetAllFiltersBtn').addEventListener('click', () => {
      const currentSort = state.filters.sort;
      state.filters = createDefaultFilters();
      state.filters.sort = currentSort;
      $('minGrRange').value = 0;
      $('minSgRange').value = 0;
      $('minGrVal').textContent = 'Any';
      $('minSgVal').textContent = 'Any';
      $('languageSelect').value = '';
      $('yearFromInput').value = '';
      $('yearToInput').value = '';
      $('maxPagesRange').value = 900;
      $('maxPagesVal').textContent = 'Any';
      document.querySelectorAll('#filterBarShell .chip').forEach((c) => c.classList.remove('active'));
      $('formatPills').querySelector('[data-format="all"]')?.classList.add('active');
      $('grPresets').querySelector('[data-gr-preset="0"]')?.classList.add('active');
      $('sgPresets').querySelector('[data-sg-preset="0"]')?.classList.add('active');
      $('eraPresets').querySelector('[data-era="all"]')?.classList.add('active');
      $('awardsPills').querySelector('[data-award="all"]')?.classList.add('active');
      syncEntityUI('author');
      syncEntityUI('publisher');
      syncFilterBadges();
      runDiscover(1, false);
    });

    // Reading Shelf Controls
    $('shelfFilterPills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-shelf-filter]');
      if (!btn) return;
      $('shelfFilterPills').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      state.shelfFilter = btn.dataset.shelfFilter;
      renderShelfView();
    });
    $('exportShelfBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(getShelf(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `wrt-reading-shelf-${state.activeUser || 'guest'}.json`;
      a.click();
    });
    $('importShelfInput').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (!Array.isArray(imported)) throw new Error();
          saveShelf(imported);
          renderShelfView();
          showToast(`Imported ${imported.length} books.`);
        } catch {
          showToast('Invalid reading shelf JSON file.');
        }
      };
      reader.readAsText(file);
    });

    // Settings
    $('openSettingsBtn').addEventListener('click', openSettings);
    $('closeSettingsBtn').addEventListener('click', closeSettings);
    $('settingsDrawer').addEventListener('click', (e) => {
      if (e.target === $('settingsDrawer')) closeSettings();
    });
    $('themeSelectorGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-set-theme]');
      if (!btn) return;
      const theme = btn.dataset.setTheme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(CFG.STORAGE_KEYS.THEME, theme);
      renderSettingsControls();
    });
    $('accentSelectorGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-set-accent]');
      if (!btn) return;
      const accent = btn.dataset.setAccent;
      document.documentElement.setAttribute('data-accent', accent);
      localStorage.setItem(CFG.STORAGE_KEYS.ACCENT, accent);
      renderSettingsControls();
    });
    $('saveApiKeysBtn').addEventListener('click', () => {
      const gemini = $('geminiKeyInput').value.trim();
      if (gemini) localStorage.setItem(CFG.STORAGE_KEYS.GEMINI_KEY, gemini);
      else localStorage.removeItem(CFG.STORAGE_KEYS.GEMINI_KEY);
      API.clearCache();
      closeSettings();
      showToast('Settings saved.');
    });
    $('clearCacheBtn').addEventListener('click', () => {
      API.clearCache();
      showToast('Book metadata cache cleared.');
    });

    // Modals Close
    $('closeDetailModalBtn').addEventListener('click', () => $('detailModal').classList.add('hidden'));
    $('detailModal').addEventListener('click', (e) => {
      if (e.target === $('detailModal')) $('detailModal').classList.add('hidden');
    });
    $('closeReaderModalBtn').addEventListener('click', closeReadingRoom);
    $('readerModal').addEventListener('click', (e) => {
      if (e.target === $('readerModal')) closeReadingRoom();
    });

    // Auth
    $('headerLoginBtn').addEventListener('click', () => openAuthModal('login'));
    $('headerSignupBtn').addEventListener('click', () => openAuthModal('signup'));
    $('memberProfileBtn').addEventListener('click', () => openAuthModal('login'));
    $('closeAuthModalBtn').addEventListener('click', () => $('authModal').classList.add('hidden'));
    $('authModal').addEventListener('click', (e) => {
      if (e.target === $('authModal')) $('authModal').classList.add('hidden');
    });
    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        state.authMode = tab.dataset.authMode;
        $('authErrorText').classList.add('hidden');
        updateAuthUI();
      });
    });
    $('authForm').addEventListener('submit', handleAuthSubmit);
    $('logoutBtn').addEventListener('click', () => {
      state.activeUser = null;
      localStorage.removeItem(CFG.STORAGE_KEYS.ACTIVE_USER);
      $('authModal').classList.add('hidden');
      updateAuthUI();
      showToast('Signed out.');
      if (state.view === 'shelf') renderShelfView();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closeAllPopovers();
      closeReadingRoom();
      $('detailModal').classList.add('hidden');
      $('authModal').classList.add('hidden');
      closeSettings();
    });
  }

  /* ---------- Author Autocomplete ---------- */
  function wireAuthorAutocomplete() {
    const input = $('authorSearchInput');
    const menu = $('authorSuggestions');
    let timer = null;
    let lastItems = [];

    const isSelected = (name) =>
      state.filters.authors.some((a) => String(a.id).toLowerCase() === String(name).toLowerCase());

    const renderMenu = () => {
      if (!lastItems.length) {
        menu.classList.add('hidden');
        return;
      }
      menu.innerHTML = lastItems
        .map((item) => {
          const sel = isSelected(item.name);
          const sub = sel ? 'Tap to remove' : item.topWork ? item.topWork : `${item.workCount || ''} works`;
          return `
            <div class="autocomplete-item ${sel ? 'is-selected' : ''}" data-ac-name="${escapeHtml(item.name)}">
              <span>${sel ? '✓ ' : ''}${escapeHtml(item.name)}</span>
              <span style="color:var(--text-muted);font-size:0.74rem;max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(sub)}</span>
            </div>`;
        })
        .join('');
      menu.classList.remove('hidden');
    };

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) {
        lastItems = [];
        menu.classList.add('hidden');
        return;
      }
      timer = setTimeout(async () => {
        try {
          lastItems = await API.searchAuthor(q);
          renderMenu();
        } catch {
          menu.classList.add('hidden');
        }
      }, 260);
    });

    menu.addEventListener('click', (e) => {
      const row = e.target.closest('.autocomplete-item');
      if (!row) return;
      toggleEntityFilter('author', { id: row.dataset.acName, name: row.dataset.acName });
      renderMenu();
    });
  }

  let toastTimer = null;
  function showToast(message) {
    const el = $('toastEl');
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
