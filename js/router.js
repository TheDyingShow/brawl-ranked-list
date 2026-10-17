'use strict';

// ============================= ROUTING =============================
// #/player/{sort}/{country|all}/{month}?page=N
// #/country/{sort}/{cc|all}/{month}?page=N   (cc = 'all' -> list, else detail)
var enteredFromState = null; // Tracks where we came from before entering country-detail
var currentQuery = ''; // Search text persisted in the hash (?q=...)
var searchTimer = null; // Debounce timer for syncing the search box into the hash

function buildHash(view, sort, cc, month, page, q) {
    return '#/' + view + '/' + sort + '/' + (cc || 'all') + '/' +
        (month === undefined ? -1 : month) + '?page=' + (page || 1) +
        (q ? '&q=' + encodeURIComponent(q) : '');
}

function parseHash() {
    var h = location.hash || '', query = '', qi = h.indexOf('?');
    if (qi >= 0) { query = h.slice(qi + 1); h = h.slice(0, qi); }
    var page = 1, q = '';
    query.split('&').forEach(function (kv) {
        var p = kv.split('=');
        if (p[0] === 'page') { var v = parseInt(p[1], 10); if (v > 0) page = v; }
        if (p[0] === 'q') { try { q = decodeURIComponent(p[1] || ''); } catch (e) { q = ''; } }
    });
    currentQuery = q;
    
    var parts = h.replace(/^#\/?/, '').split('/').filter(Boolean);
    var view = 'player', sort = 'points', third = 'all', month = -1;
    if (parts[0] === 'country') view = 'country';
    if (parts[1] && SORTS[parts[1]]) sort = parts[1];
    if (parts[2]) third = decodeURIComponent(parts[2]);
    if (parts[3] !== undefined && /^\-?\d+$/.test(parts[3])) {
        var m = parseInt(parts[3], 10);
        if (m >= -1 && m <= LAST_SEASON_IDX) month = m;
    }
    if (view === 'country') {
        var cc = (third === 'all' || third === '') ? 'all' : String(third).toUpperCase();
        currentView = (cc === 'all') ? 'country-list' : 'country-detail';
        currentDetailCC = (cc === 'all') ? '' : cc;
        currentCountryFilter = 'all';
    } else {
        currentView = 'player';
        currentDetailCC = '';
        currentCountryFilter = (third === '') ? 'all' : third;
    }
    currentSort = sort;
    currentMonth = month;
    currentPage = page;
}

function currentHash(pageOverride) {
    var q = $('searchBar').value.trim();
    if (currentView === 'player') {
        return buildHash('player', currentSort, currentCountryFilter, currentMonth, pageOverride || currentPage, q);
    }
    return buildHash('country', currentSort, currentView === 'country-detail' ? currentDetailCC : 'all', currentMonth, pageOverride || currentPage, q);
}

function route() {
    if (!dataReady) return;
    
    // Track where we came from BEFORE parsing the hash
    var prevView = currentView;
    var prevDetailCC = currentDetailCC;
    var prevSort = currentSort;
    var prevCountryFilter = currentCountryFilter;
    var prevMonth = currentMonth;
    
    parseHash();
    
    // Only track entering country-detail from a DIFFERENT view (not staying inside it)
    // Condition 1: Was in country-list, now in country-detail (different country)
    var enteringCountryDetailFromList = (prevView === 'country-list' && currentView === 'country-detail' && prevDetailCC !== currentDetailCC);
    
    // Condition 2: Was in player view, now in country-detail
    var enteringCountryDetailFromPlayer = (prevView === 'player' && currentView === 'country-detail');
    
    if (enteringCountryDetailFromList) {
        enteredFromState = {view: 'country', sort: currentSort, country: 'all', month: currentMonth};
    } else if (enteringCountryDetailFromPlayer) {
        enteredFromState = {view: 'player', sort: prevSort, country: prevCountryFilter, month: prevMonth};
    } else if (prevView === 'country-detail' && currentView !== 'country-detail') {
        // Leaving country-detail — clear the state
        enteredFromState = null;
    }
    // If prevView === currentView (e.g., both country-detail), do NOT clear enteredFromState
    
    // Country LIST view only supports points / elo
    if (currentView === 'country-list' && (currentSort === 'peak' || currentSort === 'activity')) currentSort = 'points';
    $('filterSort').value = currentSort;
    $('filterMonth').value = currentMonth;
    $('searchBar').value = currentQuery;
    syncSortOptions();
    updateSearchPlaceholder();
    render();
}

function syncSortOptions() {
    var opts = $('filterSort').options;
    var isMonthly = (currentMonth !== -1);
    var isCountryList = (currentView === 'country-list');

    for (var i = 0; i < opts.length; i++) {
        var opt = opts[i];
        var disable = false;

        if (isCountryList && (opt.value === 'peak' || opt.value === 'activity')) {
            disable = true;
        } else if (isMonthly && opt.value !== 'points') {
            disable = true;
        }

        opt.disabled = disable;
        opt.title = disable ? (isMonthly ? 'Only available for All-time' : 'Not available for Country Ranking') : '';

        if (disable && opt.selected) {
            opts[0].selected = true;
            currentSort = 'points';
        }
    }
}

function updateSearchPlaceholder() {
    $('searchBar').placeholder = (currentView === 'country-list') ? 'Search...' : 'Search player/tag...';
}

function switchView(view) {
    closeMenus();
    location.hash = buildHash(view === 'country' ? 'country' : 'player', currentSort, 'all', currentMonth, 1);
}

function flagClick(cc, ev) {
    if (ev) ev.stopPropagation();
    var q = $('searchBar').value.trim();
    location.hash = buildHash('country', currentSort, cc, currentMonth, 1, q);
}

function goBack() {
    var q = $('searchBar').value.trim();
    if (enteredFromState) {
        location.hash = buildHash(enteredFromState.view, enteredFromState.sort, enteredFromState.country || 'all', enteredFromState.month, 1, q);
        enteredFromState = null;
    } else {
        location.hash = buildHash('country', 'points', 'all', -1, 1, q);
    }
}

function changePage(delta) {
    var np = currentPage + delta;
    if (np < 1) return;
    location.hash = currentHash(np);
}

function onControlChange() {
    var q = $('searchBar').value.trim();
    var sort = $('filterSort').value;
    var month = parseInt($('filterMonth').value, 10);
    var target;
    if (currentView === 'player') {
        var cc = (currentCountryFilter !== 'all') ? currentCountryFilter : 'all';
        target = buildHash('player', sort, cc, month, 1, q); // <-- add q here
    } else if (currentView === 'country-detail') {
        target = buildHash('country', sort, currentDetailCC, month, 1, q); // <-- add q here
    } else {
        target = buildHash('country', sort, 'all', month, 1, q); // <-- add q here
    }
    if (location.hash === target) route();
    else location.hash = target;
}

// Typing re-renders immediately, then (once typing pauses) rewrites the CURRENT
// history entry via replaceState so ?q= stays truthful. replaceState does not
// fire hashchange, so this neither re-renders nor pollutes the Back stack.
function onSearchInput() {
    currentPage = 1;
    render();
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(syncSearchToHash, 350);
}

function syncSearchToHash() {
    searchTimer = null;
    currentQuery = $('searchBar').value.trim();
    var target = currentHash(currentPage);
    if (location.hash === target) return;
    try {
        history.replaceState(null, '', target);
    } catch (e) {
        location.hash = target; // fallback for file:// or restricted contexts
    }
}
