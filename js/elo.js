'use strict';

// ============================= ELO COMPUTATION =============================
function computeElo() {
    var ratings = {}, history = {}, debutIdx = {}, missRun = {};

    SEASONS.forEach(function (season, idx) {
        var players = seasonData[season.key] || [];
        var fieldSize = players.length, present = {};
        var vals = [];
        players.forEach(function (p) {
            present[p.tag] = true;
            vals.push(ratings[p.tag] !== undefined ? ratings[p.tag] : START_RATING);
        });
        vals.sort(function (a, b) { return a - b; });
        var medianR = vals.length ? vals[Math.floor(vals.length / 2)] : START_RATING;

        players.forEach(function (p) {
            var tag = p.tag;
            if (ratings[tag] === undefined) { ratings[tag] = START_RATING; debutIdx[tag] = idx; }
            missRun[tag] = 0;
            var R = ratings[tag], gain = 0;
            if (fieldSize >= 2) {
                var pct = (p.placement - 1) / fieldSize;
                var P = Math.pow(1 - pct, PLACE_EXP);
                var F = Math.min(1, Math.pow(FIELD_MIN / fieldSize, FIELD_EXP));
                var raw = MAX_GAIN * P * F;
                var momentum = Math.max(0, (ELO_CEILING - R) / (ELO_CEILING - START_RATING));
                gain = Math.round(Math.min(MAX_GAIN, raw * momentum));
                if (gain < 2 && momentum >= FLOOR_MOMENTUM) gain = 2;
            } else { gain = 2; }
            if (!history[tag]) history[tag] = {};
            history[tag][season.key] = (history[tag][season.key] || 0) + gain;
            ratings[tag] += gain;
        });

        Object.keys(ratings).forEach(function (tag) {
            if (present[tag]) return;
            if (debutIdx[tag] === undefined || debutIdx[tag] >= idx) return;
            var misses = 0, from = Math.max(0, idx - (SHIELD_WINDOW - 1));
            for (var w = from; w <= idx; w++) {
                if (w < debutIdx[tag]) continue;
                if (!seasonTagSets[w] || !seasonTagSets[w].has(tag)) misses++;
            }
            var delta = 0;
            if (misses >= 2) {
                missRun[tag] = (missRun[tag] || 0) + 1;
                var above = Math.max(0, ratings[tag] - medianR);
                var L0 = LOSS_BASE + Math.round(above * LOSS_SCALE);
                var tapered = Math.round(L0 * Math.pow(DECAY_RATIO, missRun[tag] - 1));
                delta = -Math.max(1, Math.min(MAX_GAIN, tapered));
            }
            if (!history[tag]) history[tag] = {};
            history[tag][season.key] = (history[tag][season.key] || 0) + delta;
            ratings[tag] += delta;
            if (ratings[tag] < ELO_FLOOR) ratings[tag] = ELO_FLOOR;
        });
    });

    eloHist = history;
    eloMap = ratings;
}
