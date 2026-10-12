'use strict';

// ============================= MENUS =============================
function toggleMoreMenu(ev) {
    if (ev) ev.stopPropagation();
    $('moreMenu').classList.toggle('hidden');
}

function closeMenus() {
    $('moreMenu').classList.add('hidden');
}

document.addEventListener('click', function (e) {
    if (!$('moreDropdown').contains(e.target)) {
        $('moreMenu').classList.add('hidden');
    }
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDrawer(); closeMenus(); }
});

// ============================= MONTH SELECT INIT =============================
(function initMonths() {
    var sel = $('filterMonth');
    SEASONS.forEach(function (s, i) {
        var o = document.createElement('option');
        o.value = i; o.textContent = s.label;
        sel.appendChild(o);
    });
})();

// ============================= LOADING OVERLAY HELPERS =============================
function hideLoading() {
    var o = $('loadingOverlay');
    if (o) o.classList.add('hidden');
}

function loadingError(msg) {
    var o = $('loadingOverlay');
    if (!o) return;
    var stage = o.querySelector('#loadingStage');
    if (stage) stage.textContent = msg;
    var title = o.querySelector('#loadingTitle');
    if (title) {
        title.classList.remove('animate-pulse');
        title.classList.remove('text-mastersGreen-dim');
        title.classList.add('text-red-400');
    }
}

function finishBoot() {
    hideLoading();
    route();
    // Safety net: if the first route() somehow rendered nothing
    // (race condition at load time), force it again.
    window.setTimeout(function () {
        var lb = $('leaderboard');
        if (lb && lb.children.length === 0) route();
    }, 400);
}

// ============================= DATA LOAD + BOOT =============================
try {
    Promise.all(
        [papaLoad('countries.csv'), papaLoad('leaderboard.csv')]
            .concat(SEASONS.map(function (s) { return papaLoad('seasons/' + s.key + '.csv'); }))
    ).then(function (all) {
        // countries.csv: #TAG, CC
        (all[0] || []).forEach(function (r) {
            if (r && r.length >= 2 && String(r[0]).indexOf('#') !== -1 &&
                /^[A-Za-z]{2}$/.test(String(r[1] || '').trim())) {
                countryMap[String(r[0]).trim().toUpperCase()] = String(r[1]).trim().toUpperCase();
            }
        });

        // seasons/*.csv
        SEASONS.forEach(function (s, i) {
            var raw = all[2 + i], list = [];
            if (!raw) missingSeasons.push(s.label);
            else raw.forEach(function (row) {
                var p = parseSeasonRow(row);
                if (p) list.push(p);
            });
            seasonData[s.key] = list;
            seasonTagSets[i] = new Set(list.map(function (p) { return p.tag; }));
        });

        // leaderboard.csv (authoritative roster)
        var lb = [];
        (all[1] || []).forEach(function (row) {
            var p = parseLeaderboardRow(row);
            if (p) lb.push(p);
        });

        computeElo();

        // Placement lookup per season (for month view ordering)
        seasonPlacementMap = {};
        SEASONS.forEach(function (s) {
            var m = {};
            (seasonData[s.key] || []).forEach(function (sp) { m[sp.tag] = sp.placement; });
            seasonPlacementMap[s.key] = m;
        });

        allPlayers = lb.map(function (p) {
            var lastIdx = -1;
            for (var i = LAST_SEASON_IDX; i >= 0; i--) {
                if (seasonTagSets[i] && seasonTagSets[i].has(p.tag)) { lastIdx = i; break; }
            }
            var rec = {
                tag: p.tag, name: p.name, points: p.points, peak: p.peak,
                seasonPts: p.seasonPts,
                elo: eloMap[p.tag] || 0, lastIdx: lastIdx,
                country: countryMap[p.tag] || 'XX'
            };
            playerByTag[p.tag] = rec;
            return rec;
        });

        // Rank maps for the drawer
        allPlayers.slice().sort(function (a, b) { return b.points - a.points; })
            .forEach(function (p, i) { pointsRankMap[p.tag] = i + 1; });
        allPlayers.slice().sort(function (a, b) { return (b.elo || 0) - (a.elo || 0); })
            .forEach(function (p, i) { eloRankMap[p.tag] = i + 1; });

        if (missingSeasons.length) {
            var ss = $('seasonStatus');
            ss.classList.remove('hidden');
            ss.textContent = '⚠ Missing season data: ' + missingSeasons.join(', ');
        }

        dataReady = true;
        finishBoot();
    }).catch(function (err) {
        console.error('Init load error:', err);
        loadingError('Failed to load data. Check your connection and refresh.');
    });
} catch (err) {
    console.error('Init error:', err);
    loadingError('Something went wrong while initializing.');
}

window.addEventListener('hashchange', route);
window.addEventListener('load', function () { if (dataReady) route(); });
