'use strict';

// ============================= ROUTING =============================
// #/player/{sort}/{country|all}/{month}?page=N
// #/country/{sort}/{cc|all}/{month}?page=N   (cc = 'all' -> list, else detail)
var enteredFromState = null; // Track where we came from when entering country-detail

function buildHash(view, sort, cc, month, page) {
    return '#/' + view + '/' + sort + '/' + (cc || 'all') + '/' +
        (month === undefined ? -1 : month) + '?page=' + (page || 1);
}

function parseHash() {
    var h = location.hash || '', query = '', qi = h.indexOf('?');
    if (qi >= 0) { query = h.slice(qi + 1); h = h.slice(0, qi); }
    var page = 1;
    query.split('&').forEach(function (kv) {
        var p = kv.split('=');
        if (p[0] === 'page') { var v = parseInt(p[1], 10); if (v > 0) page = v; }
    });
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

function currentHash() {
    if (currentView === 'player') {
        return buildHash('player', currentSort, currentCountryFilter, currentMonth, currentPage);
    }
    return buildHash('country', currentSort, currentView === 'country-detail' ? currentDetailCC : 'all', currentMonth, currentPage);
}

function route() {
    if (!dataReady) return;
    
    // Track transition into country-detail
    var prevView = currentView;
    parseHash();
    
    // Track where we came from before entering country-detail
    if (prevView === 'country-list' && currentView === 'country-detail') {
        enteredFromState = {view: 'country', sort: currentSort, country: 'all', month: currentMonth};
    } else if (prevView === 'player' && currentView === 'country-detail') {
        enteredFromState = {view: 'player', sort: currentSort, country: currentCountryFilter, month: currentMonth};
    } else {
        // Clear it if we're leaving country-detail
        enteredFromState = null;
    }
    
    // Country LIST view only supports points / elo
    if (currentView === 'country-list' && (currentSort === 'peak' || currentSort === 'activity')) currentSort = 'points';
    $('filterSort').value = currentSort;
    $('filterMonth').value = currentMonth;
    $('searchBar').value = '';
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
    location.hash = buildHash('country', 'points', cc, -1, 1);
}

function goBack() {
    if (enteredFromState) {
        // Exit country-detail back to the view we came from
        location.hash = buildHash(enteredFromState.view, enteredFromState.sort, enteredFromState.country || 'all', enteredFromState.month, 1);
        enteredFromState = null;
    } else {
        // Fallback: go to country list if no tracking state
        location.hash = buildHash('country', 'points', 'all', -1, 1);
    }
}

function changePage(delta) {
    var np = currentPage + delta;
    if (np < 1) return;
    location.hash = currentHash().split('?')[0] + '?page=' + np;
}

function onControlChange() {
    var sort = $('filterSort').value;
    var month = parseInt($('filterMonth').value, 10);
    var target;
    if (currentView === 'player') {
        var cc = (currentCountryFilter !== 'all') ? currentCountryFilter : 'all';
        target = buildHash('player', sort, cc, month, 1);
    } else if (currentView === 'country-detail') {
        target = buildHash('country', sort, currentDetailCC, month, 1);
    } else {
        target = buildHash('country', sort, 'all', month, 1);
    }
    if (location.hash === target) route();
    else location.hash = target;
}

function onSearchInput() { render(); }
