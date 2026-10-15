'use strict';

// ============================= RENDER =============================
function render() {
    try {
        var pv = $('playerView'), cv = $('countryView');
        if (currentView === 'player') {
            pv.classList.remove('hidden'); cv.classList.add('hidden');
            renderPlayerView();
        } else {
            pv.classList.add('hidden'); cv.classList.remove('hidden');
            if (currentView === 'country-list') renderCountryList();
            else renderCountryDetail();
        }
        window.scrollTo(0, 0);
    } catch (err) {
        console.error('Render error:', err);
    }
}

function paginate(list) {
    var pages = Math.max(1, Math.ceil(list.length / RECORDS_PER_PAGE));
    if (currentPage > pages) currentPage = pages;
    var start = (currentPage - 1) * RECORDS_PER_PAGE;
    return { slice: list.slice(start, start + RECORDS_PER_PAGE), pages: pages };
}

function setPager(btnPrevId, indId, btnNextId, pages) {
    var bp = $(btnPrevId), bi = $(indId), bn = $(btnNextId);
    if (!bp || !bi || !bn) return;

    bp.disabled = currentPage <= 1;
    bn.disabled = currentPage >= pages;

    // Build page numbers
    var nums = pageNumbers(currentPage, pages), html = '';
    for (var i = 0; i < nums.length; i++) {
        var v = nums[i];
        if (v === '...') {
            html += '<span class="pg-dot">…</span>';
        } else if (v === currentPage) {
            html += '<span class="pg-current">' + v + '</span>';
        } else {
            html += '<a href="#" class="pg-link" onclick="goToPage(' + v + ');return false;">' + v + '</a>';
        }
    }
    bi.innerHTML = html;
}

function pageNumbers(cur, total) {
    var out = [], i;
    if (total <= 7) { for (i = 1; i <= total; i++) out.push(i); return out; }
    out.push(1);
    var start = Math.max(2, cur - 2), end = Math.min(total - 1, cur + 2);
    if (start > 2) out.push('...');
    for (i = start; i <= end; i++) out.push(i);
    if (end < total - 1) out.push('...');
    out.push(total);
    return out;
}

function goToPage(p) {
    if (p === currentPage) return;
    changePage(p - currentPage);
}

function statValue(p) {
    if (currentSort === 'elo') return (isActive(p) ? '' : '<span class="offline-pill">Inactive</span>') + fmt(p.elo || 0);
    if (currentSort === 'activity') return p.lastIdx >= 0 ? SEASONS[p.lastIdx].label : '-';
    if (currentSort === 'peak') return (p.peak != null && p.peak > 0) ? '#' + p.peak : '-';
    var mk = (currentMonth !== -1 && SEASONS[currentMonth]) ? SEASONS[currentMonth].key : null;
    return fmt(mk ? (p.seasonPts && p.seasonPts[mk] !== undefined ? p.seasonPts[mk] : 0) : p.points);
}

function playerRowHtml(p, rank) {
    var rc = rank <= 3 ? 'rank-' + rank : '';
    var stCls = currentSort === 'elo' ? 'text-mastersGreen' : 'text-emerald-400';
    
    var html = '<div class="player-row grid grid-cols-12 gap-3 px-4 py-3 items-center cursor-pointer' + (currentSort === 'elo' && !isActive(p) ? ' player-row-offline' : '') + '" onclick="showPlayer(\'' + tagParam(p.tag) + '\')">' +
        '<div class="col-span-1 rank-badge ' + rc + '">' + rank + '</div>';
    
    // Flag column
    html += '<div class="col-span-1 flex justify-start">' +
        (p.country && p.country !== 'XX'
            ? '<img class="flag-icon flag-click" src="' + getFlagUrl(p.country) + '" alt="' + esc(p.country) + '" title="' + esc(countryName(p.country)) + '" onclick="flagClick(\'' + p.country + '\', event)">'
            : '<div class="flag-placeholder" title="Unknown country">?</div>') +
    '</div>';
    
    // Player name
    html += '<div class="col-span-4 min-w-0"><span class="font-bold text-white text-sm truncate block">' + esc(p.name) + '</span>' +
        '<span class="text-[10px] font-mono text-slate-600">' + esc(p.tag) + '</span></div>';
    
    // Peak column - HIDE it when sorting by peak (shown in main stat column instead)
    if (currentSort !== 'peak') {
        html += '<div class="col-span-2 text-right font-mono text-xs text-amber-500 font-bold">' + ((p.peak != null && p.peak > 0) ? '#' + p.peak : '-') + '</div>';
    }
    
    // Main stat column
    var statSpan = currentSort === 'peak' ? 'col-span-6' : 'col-span-4';
    html += '<div class="' + statSpan + ' text-right font-mono text-sm font-bold ' + stCls + '">' + statValue(p) + '</div>';
    
    html += '</div>';
    return html;
}

function emptyRow(msg) {
    return '<div class="px-4 py-8 text-center text-slate-600 text-xs font-mono">' + msg + '</div>';
}

// ============================= PLAYER VIEW =============================
function renderPlayerView() {
    try {
        var list = allPlayers.slice();
        if (currentCountryFilter !== 'all') list = list.filter(function (p) { return p.country === currentCountryFilter; });
        list = applyMonthAndSearch(list);
        if (currentSort === 'elo') {
            list = list.sort(function (a, b) { return (b.elo || 0) - (a.elo || 0); });
        } else {
            list = sortPlayerList(list);
        }
        var pg = paginate(list);
        $('viewTitle').textContent = 'Player Ranking — ' + monthLabel(currentMonth) +
            (currentCountryFilter !== 'all' ? ' — ' + countryName(currentCountryFilter) : '');
        $('playerCount').textContent = list.length.toLocaleString() + ' Records';
        var statLbl = currentSort === 'elo' ? 'Elo' : (currentSort === 'activity' ? 'Last activity' : SORTS[currentSort]);
        $('playerHeader').innerHTML =
            '<div class="col-span-1 text-center">#</div>' +
            '<div class="col-span-1">Country</div>' +
            '<div class="col-span-4">Player</div>' +
            (currentSort !== 'peak' ? '<div class="col-span-2 text-right">Peak</div>' : '') +
            (currentSort !== 'peak'
                ? '<div class="col-span-4 text-right">' + statLbl + '</div>'
                : '<div class="col-span-6 text-right">' + statLbl + '</div>');
        var html = '';
        pg.slice.forEach(function (p, i) { html += playerRowHtml(p, (currentPage - 1) * RECORDS_PER_PAGE + i + 1); });
        $('leaderboard').innerHTML = html || emptyRow('No players found');
        setPager('btnPrev', 'pageIndicator', 'btnNext', pg.pages);
    } catch (err) {
        console.error('renderPlayerView error:', err);
    }
}

// ============================= FILTER / SORT =============================
function applyMonthAndSearch(list) {
    if (currentMonth !== -1) {
        var set = seasonTagSets[currentMonth];
        if (set) list = list.filter(function (p) { return set.has(p.tag); });
    }
    var q = $('searchBar').value.trim().toLowerCase();
    if (q && currentView !== 'country-list') {
        list = list.filter(function (p) {
            return p.name.toLowerCase().indexOf(q) !== -1 || p.tag.toLowerCase().indexOf(q) !== -1;
        });
    }
    return list;
}

function sortPlayerList(arr) {
    arr = arr.slice();
    var mk = (currentMonth !== -1 && SEASONS[currentMonth]) ? SEASONS[currentMonth].key : null;
    if (currentSort === 'points') {
        if (mk) arr.sort(function (a, b) {
            var pa = (seasonPlacementMap[mk] || {})[a.tag], pb = (seasonPlacementMap[mk] || {})[b.tag];
            if (pa === undefined) return 1;
            if (pb === undefined) return -1;
            return pa - pb;
        });
        else arr.sort(function (a, b) { return (b.points || 0) - (a.points || 0); });
    } else if (currentSort === 'elo') {
        arr.sort(function (a, b) { return (b.elo || 0) - (a.elo || 0); });
    } else if (currentSort === 'peak') {
        arr.sort(function (a, b) {
            if (a.peak == null) return 1;
            if (b.peak == null) return -1;
            return a.peak - b.peak;
        });
    } else if (currentSort === 'activity') {
        arr.sort(function (a, b) { return b.lastIdx - a.lastIdx; });
    }
    return arr;
}

// ============================= COUNTRY LIST VIEW =============================
function renderCountryList() {
    try {
        var list = allPlayers.slice();
        list = applyMonthAndSearch(list);
        var agg = {}, seen = {};
        list.forEach(function (p) {
            if (!p.country || p.country === 'XX') return;
            if (!agg[p.country]) agg[p.country] = { cc: p.country, n: 0, pts: 0, elo: 0 };
            agg[p.country].n++; agg[p.country].pts += p.points; agg[p.country].elo += (p.elo || 0);
            seen[p.country] = true;
        });
        var list2 = Object.keys(agg).map(function (k) { return agg[k]; });
        var zeros = [];
        allPlayers.forEach(function (p) {
            if (!p.country || p.country === 'XX' || seen[p.country]) return;
            seen[p.country] = true;
            zeros.push({ cc: p.country, n: 0, pts: 0, elo: 0 });
        });
        zeros.sort(function (a, b) { return countryName(a.cc).localeCompare(countryName(b.cc)); });
        list2.sort(function (a, b) { return currentSort === 'elo' ? (b.elo - a.elo) : (b.pts - a.pts); });
        var shown = list2.concat(zeros);
        var q = $('searchBar').value.trim().toLowerCase();
        if (q) shown = shown.filter(function (c) { return countryName(c.cc).toLowerCase().indexOf(q) !== -1 || c.cc.toLowerCase().indexOf(q) !== -1; });
        var pg = paginate(shown);
        $('countryViewTitle').textContent = 'Country Ranking — ' + monthLabel(currentMonth);
        $('countryTotalPlayers').textContent = shown.length + ' Countries';
        $('countryDetailHeader').classList.add('hidden');
        $('countryRankingWrap').classList.remove('hidden');
        $('countryPagination').classList.remove('hidden');
        
        var html = '<div class="grid grid-cols-12 gap-3 px-4 py-3 bg-[#09120b] border-b border-slate-950 text-[9px] uppercase tracking-wider font-bold text-slate-500">' +
            '<div class="col-span-1 text-center">#</div>' +
            '<div class="col-span-5">Country</div>' +
            '<div class="col-span-2 text-right">Players</div>' +
            '<div class="col-span-2 text-right">Points</div>' +
            '<div class="col-span-2 text-right">Elo</div>' +
        '</div>';
        
        pg.slice.forEach(function (c, i) {
            var rank = (currentPage - 1) * RECORDS_PER_PAGE + i + 1;
            var rc = rank <= 3 ? 'rank-' + rank : '';
            html += '<div class="player-row grid grid-cols-12 gap-3 px-4 py-3 items-center cursor-pointer" onclick="location.hash=buildHash(\'country\',\'' + currentSort + '\',\'' + c.cc + '\',' + currentMonth + ',1)">' +
                '<div class="col-span-1 rank-badge ' + rc + '">' + rank + '</div>' +
                '<div class="col-span-5 flex items-center gap-3 min-w-0">' +
                    '<img class="flag-icon" src="' + getFlagUrl(c.cc) + '" alt="' + esc(c.cc) + '">' +
                    '<span class="font-bold text-white text-sm truncate">' + esc(countryName(c.cc)) + '</span>' +
                '</div>' +
                '<div class="col-span-2 text-right font-mono text-xs text-slate-400">' + c.n + '</div>' +
                '<div class="col-span-2 text-right font-mono text-sm font-bold text-emerald-400">' + fmt(c.pts) + '</div>' +
                '<div class="col-span-2 text-right font-mono text-sm font-bold text-mastersGreen">' + fmt(c.elo) + '</div>' +
            '</div>';
        });
        $('countryRankingList').innerHTML = html || emptyRow('No countries found');
        setPager('btnPrevC', 'pageIndicatorC', 'btnNextC', pg.pages);
    } catch (err) {
        console.error('renderCountryList error:', err);
    }
}

// ============================= COUNTRY DETAIL VIEW =============================
function renderCountryDetail() {
    try {
        var cc = currentDetailCC;
        var list = allPlayers.filter(function (p) { return p.country === cc; });
        list = applyMonthAndSearch(list);
        list = sortPlayerList(list);
        var totalPts = 0, totalElo = 0;
        list.forEach(function (p) { totalPts += p.points; totalElo += (p.elo || 0); });
        var allOfCc = allPlayers.filter(function (p) { return p.country === cc; });
        $('countryViewTitle').textContent = countryName(cc) + ' — ' + monthLabel(currentMonth);
        $('countryTotalPlayers').textContent = list.length + ' Players';
        $('countryDetailHeader').classList.remove('hidden');
        $('countryRankingWrap').classList.remove('hidden');
        $('countryDetailHeader').innerHTML =
            '<div class="bg-[#101d14] border border-slate-950 rounded-xl px-4 py-3 mb-5 flex items-center gap-4">' +
                '<span class="back-btn" onclick="goBack()">&larr; Click to go back</span>' +
                '<img class="flag-icon ml-4" src="' + getFlagUrl(cc) + '" alt="' + esc(cc) + '">' +
                '<div class="flex-1 min-w-0">' +
                    '<span class="block font-black text-white text-base truncate">' + esc(countryName(cc)) + '</span>' +
                    '<span class="text-[10px] font-mono text-slate-500">' + list.length + ' total players</span>' +
                '</div>' +
                '<div class="text-right">' +
                    '<div class="font-mono text-sm font-bold text-emerald-400">' + fmt(totalPts) + ' pts</div>' +
                    '<div class="font-mono text-sm font-bold text-mastersGreen">' + fmt(totalElo) + ' elo</div>' +
                '</div>' +
            '</div>';
        
        var mainStatLabel = currentSort === 'elo' ? 'Elo' : (currentSort === 'activity' ? 'Last Activity' : (currentSort === 'peak' ? 'Peak' : 'Points'));
        var hasPeakColumn = currentSort !== 'peak';
        
        $('countryRankingList').innerHTML =
            '<div class="grid grid-cols-12 gap-3 px-4 py-3 bg-[#09120b] border-b border-slate-950 text-[9px] uppercase tracking-wider font-bold text-slate-500">' +
                '<div class="col-span-1 text-center">#</div>' +
                '<div class="col-span-1">Flag</div>' +
                '<div class="col-span-4">Player</div>' +
                (hasPeakColumn ? '<div class="col-span-2 text-right">Peak</div>' : '') +
                '<div class="col-span-' + (hasPeakColumn ? '4' : '6') + ' text-right">' + mainStatLabel + '</div>' +
            '</div>';
        
        var pg = paginate(list);
        var html = '';
        pg.slice.forEach(function (p, i) { html += playerRowHtml(p, (currentPage - 1) * RECORDS_PER_PAGE + i + 1); });
        $('countryRankingList').innerHTML += html || emptyRow('No players found');
        $('countryPagination').classList.remove('hidden');
        setPager('btnPrevC', 'pageIndicatorC', 'btnNextC', pg.pages);
    } catch (err) {
        console.error('renderCountryDetail error:', err);
    }
}

// ============================= PLAYER DRAWER =============================
function showPlayer(encodedTag) {
    var tag = decodeURIComponent(encodedTag);
    var p = playerByTag[tag];
    if (!p) return;
    
    // Flag placeholder handling
    var hasC = p.country && p.country !== 'XX';
    $('dFlag').classList.toggle('hidden-el', !hasC);
    $('dFlagPh').classList.toggle('hidden-el', !!hasC);
    if (hasC) $('dFlag').src = getFlagUrl(p.country);
    
    $('dName').textContent = p.name;
    $('dName').textContent = p.name;
    $('dTag').textContent = p.tag;
    $('dCountry').textContent = (p.country && p.country !== 'XX') ? countryName(p.country) + ' (' + p.country + ')' : 'Country Not Found';
    var st = $('dStatus');
    var lastLabel = p.lastIdx >= 0 ? SEASONS[p.lastIdx].label : 'Unknown';
    if (isActive(p)) {
        st.className = 'text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400';
        st.textContent = 'Active — Last Reached Pro (Top 500) in ' + lastLabel;
    } else {
        st.className = 'text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded bg-red-900/40 text-red-400';
        st.textContent = 'Inactive — Last Reached Pro (Top 500) in ' + lastLabel;
    }
    $('dPoints').textContent = fmt(p.points);
    $('dPointsRank').textContent = pointsRankMap[p.tag] ? '#' + pointsRankMap[p.tag] : '';
    $('dElo').textContent = fmt(p.elo || 0);
    $('dEloRank').textContent = eloRankMap[p.tag] ? '#' + eloRankMap[p.tag] : '';
    $('dPeak').textContent = (p.peak != null && p.peak > 0) ? '#' + p.peak : '-';
    $('dLink').href = profileUrl(p.tag);
    $('dLinkBI').href = insightsUrl(p.tag);

    var hist = '';
    var firstActiveSeason = null;
    SEASONS.forEach(function (s, idx) {
        var d = eloHist[p.tag] ? eloHist[p.tag][s.key] : null;
        if ((d !== null && d !== undefined) && (firstActiveSeason === null)) firstActiveSeason = idx;
    });
    SEASONS.forEach(function (s, idx) {
        if (firstActiveSeason !== null && idx < firstActiveSeason) return;
        var d = eloHist[p.tag] ? eloHist[p.tag][s.key] : null;
        var val = (d !== null && d !== undefined) ? ((d >= 0 ? '+' : '') + d) : '—';
        var cls = (d !== null && d !== undefined && d > 0) ? 'elo-plus' : ((d < 0) ? 'elo-minus' : 'text-slate-600');
        var place = (seasonPlacementMap[s.key] || {})[p.tag];
        var peakTxt = (place != null) ? ' <span class="text-amber-500">#' + place + '</span>' : '';
        hist += '<div class="season-row flex justify-between px-2 py-1 rounded cursor-pointer ' + (val !== '—' ? 'bg-[#09120b]' : '') + '" onclick="goToSeason(' + idx + ')">' +
            '<span class="text-slate-500">' + s.label + peakTxt + '</span><span class="' + cls + ' font-bold">' + val + '</span></div>';
    });
    if (hist === '') hist = '<div class="text-center text-slate-600 text-xs py-4">No season history available</div>';
    $('dHistory').innerHTML = hist;
    $('playerDrawer').classList.add('open');
}

function goToSeason(idx) {
    location.hash = buildHash('player', 'points', 'all', idx, 1);
}

function closeDrawer() { $('playerDrawer').classList.remove('open'); }
