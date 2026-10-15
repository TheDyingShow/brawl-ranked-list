'use strict';

// ============================= ELO COMPUTATION =============================
// Chess.com-inspired expectation model with scarcity pricing.
//
// Per season, per present player:
//   E = 10^(R/400) / Σ 10^(Rj/400)   (expected placement share, Bradley-Terry)
//   S = 1 - (placement - 1) / fieldSize   (actual placement share)
//   delta = K_eff x (S - E), clamped to +/-MAX_DELTA
//
// K_eff = K x scarcityBonus, where scarcityBonus grows when the field is
// small (few pros = harder to qualify = every placement is worth more).
// First PROVISIONAL_SEASONS seasons use K_PROVISIONAL (fast placement).
// Everyone present gains at least MIN_PRESENT_GAIN x scarcityBonus.
//
// Decay: players who debuted earlier and miss a season lose DECAY_FLAT
// after their first DECAY_GRACE career misses. The grace window is counted
// over a whole career and never resets on return — no re-arming cycles.
// ============================================================================

var K_PROVISIONAL = 200;      // K for a player's first seasons
var PROVISIONAL_SEASONS = 2;  // how many seasons use K_PROVISIONAL
var K_ESTABLISHED = 60;       // K afterwards
var SCARCITY_REF_FIELD = 500; // field size giving no bonus
var SCARCITY_MIN_FIELD = 10;  // guard for absurdly small fields
var SCARCITY_EXP = 0.4;       // bonus = (refField / fieldSize) ^ exp
var SCARCITY_MAX_BONUS = 3;   // cap (April 2025: 20 pros -> 3.0)
var MAX_DELTA = 600;          // clamp on a single season's swing
var MIN_PRESENT_GAIN = 8;     // flat qualification reward, scaled by bonus
var DECAY_FLAT = 20;          // per missed season after grace
var DECAY_GRACE = 2;          // career free misses before decay starts
var GAIN_CAP_START = 2500;  // rating where gain dampening begins
var GAIN_CAP_END = 3000;     // rating where gains are fully capped
var CAP_GAIN_FULL = 1;       // max gain/season at 3000+, normal season
var CAP_GAIN_SCARCE = 8;     // max gain/season at 3000+, most scarce season

function computeElo() {
    var ratings = {}, history = {}, debutIdx = {};
    var seasonsPlayed = {}, careerMiss = {};

    SEASONS.forEach(function (season, idx) {
        var players = seasonData[season.key] || [];
        var fieldSize = players.length, present = {};
        players.forEach(function (p) { present[p.tag] = true; });

        // Expected-share denominator from pre-season ratings
        // (newcomers count at START_RATING)
        var denom = 0;
        players.forEach(function (p) {
            var r = ratings[p.tag] !== undefined ? ratings[p.tag] : START_RATING;
            denom += Math.pow(10, r / 400);
        });
        if (denom <= 0 || !isFinite(denom)) denom = 1;

        // Scarcity bonus: fewer pros -> bigger stakes
        var effField = Math.max(fieldSize, SCARCITY_MIN_FIELD);
        var bonus = Math.min(SCARCITY_MAX_BONUS,
            Math.pow(SCARCITY_REF_FIELD / effField, SCARCITY_EXP));

        // ---- Present players: expectation-based gains ----
        players.forEach(function (p) {
            var tag = p.tag;
            if (ratings[tag] === undefined) { ratings[tag] = START_RATING; debutIdx[tag] = idx; }
            seasonsPlayed[tag] = (seasonsPlayed[tag] || 0) + 1;

            var kBase = seasonsPlayed[tag] <= PROVISIONAL_SEASONS ? K_PROVISIONAL : K_ESTABLISHED;
            var kEff = kBase * bonus;

            var S = 1 - (p.placement - 1) / SCARCITY_REF_FIELD;
            var E = Math.pow(10, ratings[tag] / 400) / denom;

            var delta = kEff * (S - E);
            if (delta > MAX_DELTA) delta = MAX_DELTA;
            if (delta < -MAX_DELTA) delta = -MAX_DELTA;

            // Minimum qualification reward, scaled by scarcity
            if (delta < MIN_PRESENT_GAIN * bonus) delta = MIN_PRESENT_GAIN * bonus;

            // Soft cap: climbing past 2500 gets progressively harder; at 3000+
            // gains are capped at a scarcity-scaled allowance (1..8). Decay unchanged.
            if (delta > 0 && ratings[tag] > GAIN_CAP_START) {
                var capFinal = CAP_GAIN_FULL + (CAP_GAIN_SCARCE - CAP_GAIN_FULL) *
                    (bonus - 1) / (SCARCITY_MAX_BONUS - 1);
                var t = Math.min(1, (ratings[tag] - GAIN_CAP_START) / (GAIN_CAP_END - GAIN_CAP_START));
                delta = delta * (1 - t) + capFinal * t;
                if (delta < 1) delta = 1;
            }

            delta = Math.round(delta);

            if (!history[tag]) history[tag] = {};
            history[tag][season.key] = (history[tag][season.key] || 0) + delta;
            ratings[tag] = Math.max(ELO_FLOOR, ratings[tag] + delta);
        });

        // ---- Absent players: flat decay after career grace ----
        Object.keys(ratings).forEach(function (tag) {
            if (present[tag]) return;
            if (debutIdx[tag] === undefined || debutIdx[tag] >= idx) return;
            careerMiss[tag] = (careerMiss[tag] || 0) + 1;
            var delta = 0;
            if (careerMiss[tag] > DECAY_GRACE) {
                var excess = Math.max(0, ratings[tag] - 1500);
                delta = -(DECAY_FLAT + Math.round(excess * 0.05));
            }
            if (!history[tag]) history[tag] = {};
            history[tag][season.key] = (history[tag][season.key] || 0) + delta;
            ratings[tag] = Math.max(ELO_FLOOR, ratings[tag] + delta);
        });
    });

    eloHist = history;
    eloMap = ratings;
}
