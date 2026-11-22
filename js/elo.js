'use strict';

// ============================= ELO COMPUTATION =============================
// Bradley-Terry expectation model with scarcity pricing and Glicko-style
// rating certainty (RD). November 2026 overhaul.
//
// Per season, per present player:
//   E      = 10^(R/400) / Σ 10^(Rj/400)     expected placement share
//   S      = (1 - (placement - 1)/500)^2    actual placement share (top-heavy)
//   delta  = K_eff x (S - E), clamped to +/-MAX_DELTA
//
// K_eff = K_BASE x kMult x scarcityBonus, where kMult = RD / RD_MIN
// (clamped to K_RD_MULT_MAX). RD ("rating deviation") measures how uncertain
// a rating is: it starts high for newcomers and returnees, shrinks every
// attended season, and grows again during absences. Uncertain players move
// fast (fast, fair placement), precise players move slowly (stability).
//
// Everyone present gains at least MIN_PRESENT_GAIN x scarcityBonus.
//
// Decay: players who debuted earlier and miss a season lose DECAY_FLAT
// (+5% of rating above 1500) after their first DECAY_GRACE career misses.
// The grace window is counted over a whole career and never resets on
// return — no re-arming cycles. Missing a season always grows RD,
// even during grace: uncertainty accumulates with time.
// ============================================================================

var RD_START = 350;           // RD at debut: maximally uncertain
var RD_MIN = 60;              // RD floor for highly active players
var RD_MAX = 350;             // RD cap after long absences
var RD_ATTEND_SHRINK = 0.72;  // RD multiplied by this after each attended season
var RD_MISS_GROWTH = 27;      // RD grows ~sqrt(rd^2 + this^2) per missed season
var K_BASE = 60;              // K for a fully precise rating (RD = RD_MIN)
var K_RD_MULT_MAX = 4;        // kMult cap -> max K = 240 (newcomers/returnees)
var S_SHAPING = 2;            // S = (share)^shaping; 2 = top-heavy quadratic
var SCARCITY_REF_FIELD = 500; // field size giving no bonus
var SCARCITY_MIN_FIELD = 10;  // guard for absurdly small fields
var SCARCITY_EXP = 0.4;       // bonus = (refField / fieldSize) ^ exp
var SCARCITY_MAX_BONUS = 3;   // cap (April 2025: 20 pros -> 3.0)
var MAX_DELTA = 600;          // clamp on a single season's swing
var MIN_PRESENT_GAIN = 8;     // flat qualification reward, scaled by bonus
var DECAY_FLAT = 20;          // per missed season after grace
var DECAY_GRACE = 2;          // career free misses before decay starts
var GAIN_CAP_START = 2500;    // rating where gain dampening begins
var GAIN_CAP_END = 3000;      // rating where gains are fully capped
var CAP_GAIN_FULL = 1;        // max gain/season at 3000+, normal season
var CAP_GAIN_SCARCE = 8;      // max gain/season at 3000+, most scarce season

function computeElo() {
    var ratings = {}, history = {}, debutIdx = {};
    var rd = {}, careerMiss = {};

    SEASONS.forEach(function (season, idx) {
        var players = seasonData[season.key] || [];
        var fieldSize = players.length, present = {};
        players.forEach(function (p) { present[p.tag] = true; });

        // ---- GUARD 1: missing/empty season file ----
        // An empty list means the CSV failed to load or exported blank —
        // it does NOT mean "everybody missed the season". Skipping the
        // season entirely means: no decay applied, no career-miss counted
        // (grace slots preserved), no history entry (drawer shows '—').
        if (fieldSize === 0) {
            console.warn('computeElo: no data for ' + season.key + ' — season skipped (no decay, no grace burn)');
            return;
        }

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
        // ---- GUARD 2: duplicate tags are ignored (first occurrence wins) ----
        var seenThisSeason = {};
        players.forEach(function (p) {
            var tag = p.tag;
            if (seenThisSeason[tag]) {
                console.warn('computeElo: duplicate tag ' + tag + ' in ' + season.key +
                    ' (placements ' + seenThisSeason[tag] + ' and ' + p.placement + ') — second row ignored');
                return;
            }
            seenThisSeason[tag] = p.placement;

            if (ratings[tag] === undefined) {
                ratings[tag] = START_RATING;
                rd[tag] = RD_START;
                debutIdx[tag] = idx;
            }

            // K scales with rating uncertainty: newcomers and long-absent
            // returnees move fast, precise veterans move slowly.
            var kMult = Math.min(K_RD_MULT_MAX, (rd[tag] || RD_MIN) / RD_MIN);
            var kEff = K_BASE * kMult * bonus;

            // Top-heavy actual share: #1 -> 1.0, #85 -> ~0.69, #500 -> ~0
            var S = Math.pow(1 - (p.placement - 1) / SCARCITY_REF_FIELD, S_SHAPING);
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

            // Attending a season makes the rating more certain
            rd[tag] = Math.max(RD_MIN, rd[tag] * RD_ATTEND_SHRINK);
        });

        // ---- Absent players: flat decay after career grace, RD always grows ----
        Object.keys(ratings).forEach(function (tag) {
            if (present[tag]) return;
            if (debutIdx[tag] === undefined || debutIdx[tag] >= idx) return;

            // Uncertainty grows with inactivity, even during the grace window
            var g = rd[tag] || RD_MIN;
            rd[tag] = Math.min(RD_MAX, Math.sqrt(g * g + RD_MISS_GROWTH * RD_MISS_GROWTH));

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
