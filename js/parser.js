'use strict';

function papaLoad(fileUrl) {
    return new Promise(function (resolve) {
        Papa.parse(fileUrl, {
            download: true, header: false, skipEmptyLines: true,
            complete: function (res) { resolve(res.data || []); },
            error: function () { resolve(null); }
        });
    });
}

// seasons/*.csv rows: PLACEMENT,#TAG (either order tolerated)
function parseSeasonRow(row) {
    var tag = null, placement = null;
    for (var i = 0; i < row.length; i++) {
        var f = String(row[i] == null ? '' : row[i]).trim();
        if (f === '') continue;
        if (tag === null && f.charAt(0) === '#') { tag = f.toUpperCase(); continue; }
        if (placement === null && /^\d+$/.test(f)) { placement = parseInt(f, 10); }
    }
    return (tag && placement !== null) ? { tag: tag, placement: placement } : null;
}

// leaderboard.csv rows: #TAG, Name, TOTAL_POINTS, PEAK_PLACEMENT, 18 per-season point values
function parseLeaderboardRow(row) {
    if (!row || row.length < 4) return null;
    var tag = String(row[0] || '').trim().toUpperCase();
    if (tag.charAt(0) !== '#') return null;
    var name = String(row[1] || '').trim();
    var points = parseInt(String(row[2]).replace(/[^\d]/g, ''), 10) || 0;
    var peak = parseInt(String(row[3]).replace(/[^\d]/g, ''), 10) || null;
    var seasonPts = {};
    for (var i = 0; i < SEASONS.length; i++) {
        var v = row[4 + i] !== undefined ? parseInt(String(row[4 + i]).replace(/[^\d]/g, ''), 10) : NaN;
        seasonPts[SEASONS[i].key] = isNaN(v) ? 0 : v;
    }
    return { tag: tag, name: name, points: points, peak: peak, seasonPts: seasonPts };
}
