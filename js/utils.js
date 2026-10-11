'use strict';

function $(id) { return document.getElementById(id); }

function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function tagParam(tag) { return encodeURIComponent(tag); }
function detag(tag) { return tag.replace(/^#/, ''); }
function profileUrl(tag) { return 'https://brawlace.com/players/%23' + encodeURIComponent(detag(tag)); }
function insightsUrl(tag) { return 'https://brawlinsights.com/en/player/profile/' + encodeURIComponent(detag(tag)); }
function getFlagUrl(cc) { return (cc && cc !== 'XX') ? FLAG_CDN + cc.toLowerCase() + '.png' : ''; }
function countryName(cc) { return (cc && cc !== 'XX' && COUNTRY_NAMES[cc]) ? COUNTRY_NAMES[cc] : (cc || ''); }
function isActive(p) { return p.lastIdx >= (LAST_SEASON_IDX - (ACTIVE_SEASON_WINDOW - 1)); }
function monthLabel(m) { return (m === -1) ? 'All-time' : (SEASONS[m] ? SEASONS[m].label : 'Unknown'); }
function fmt(n) { return (n == null) ? '-' : Number(n).toLocaleString(); }
