'use strict';

// ============================= ELO CONFIG =============================
var START_RATING = 1500, ELO_CEILING = 3000, ELO_FLOOR = 1000,
    MAX_GAIN = 500, PLACE_EXP = 4, FIELD_MIN = 20, FIELD_EXP = 0.42,
    FLOOR_MOMENTUM = 0.2, LOSS_BASE = 25, LOSS_SCALE = 0.25,
    SHIELD_WINDOW = 12, DECAY_RATIO = 0.75;
var ACTIVE_SEASON_WINDOW = 3;

// ============================= SEASONS =============================
var SEASONS = [
    { key: 'mars25',      label: 'March 2025' }, { key: 'avril25',     label: 'April 2025' },
    { key: 'mai25',       label: 'May 2025' },   { key: 'juin25',      label: 'June 2025' },
    { key: 'juillet25',   label: 'July 2025' },  { key: 'aout25',      label: 'August 2025' },
    { key: 'septembre25', label: 'September 2025' }, { key: 'octobre25',  label: 'October 2025' },
    { key: 'novembre25',  label: 'November 2025' }, { key: 'decembre25', label: 'December 2025' },
    { key: 'janvier26',   label: 'January 2026' }, { key: 'fevrier26',   label: 'February 2026' },
    { key: 'mars26',      label: 'March 2026' }, { key: 'avril26',     label: 'April 2026' },
    { key: 'mai26',       label: 'May 2026' },   { key: 'juin26',      label: 'June 2026' },
    { key: 'juillet26',   label: 'July 2026' },  { key: 'aout26',      label: 'August 2026' }
];
var LAST_SEASON_IDX = SEASONS.length - 1;

// ============================= COUNTRY NAMES =============================
var COUNTRY_NAMES = {
    'AR':'Argentina','AU':'Australia','AT':'Austria','BY':'Belarus','BE':'Belgium','BO':'Bolivia',
    'BA':'Bosnia and Herz.','BR':'Brazil','BG':'Bulgaria','CA':'Canada','CL':'Chile',
    'CN':'China','CO':'Colombia','CR':'Costa Rica','HR':'Croatia','CZ':'Czechia',
    'DK':'Denmark','EC':'Ecuador','EG':'Egypt','EE':'Estonia','FI':'Finland',
    'FR':'France','DE':'Germany','GR':'Greece','GT':'Guatemala','HK':'Hong Kong',
    'HU':'Hungary','IN':'India','ID':'Indonesia','IR':'Iran','IQ':'Iraq','IE':'Ireland',
    'IL':'Israel','IT':'Italy','JP':'Japan','JO':'Jordan','KZ':'Kazakhstan','KW':'Kuwait',
    'LV':'Latvia','LB':'Lebanon','LT':'Lithuania','LU':'Luxembourg','MY':'Malaysia',
    'MT':'Malta','MX':'Mexico','MD':'Moldova','MA':'Morocco','NP':'Nepal',
    'NL':'Netherlands','NZ':'New Zealand','MK':'North Macedonia','NO':'Norway',
    'PK':'Pakistan','PA':'Panama','PY':'Paraguay','PE':'Peru','PH':'Philippines',
    'PL':'Poland','PT':'Portugal','PR':'Puerto Rico','RO':'Romania','RU':'Russia',
    'SA':'Saudi Arabia','RS':'Serbia','SG':'Singapore','SK':'Slovakia','SI':'Slovenia',
    'ZA':'South Africa','KR':'South Korea','ES':'Spain','SE':'Sweden','CH':'Switzerland',
    'TW':'Taiwan','TH':'Thailand','TN':'Tunisia','TR':'Türkiye','UA':'Ukraine',
    'AE':'United Arab Emirates','GB':'United Kingdom','US':'United States',
    'UY':'Uruguay','UZ':'Uzbekistan','VE':'Venezuela','VN':'Vietnam',
    'HN':'Honduras','MO':'Macao','BH':'Bahrain','BD':'Bangladesh','AM':'Armenia'
};

// ============================= MISC CONSTANTS =============================
var FLAG_CDN = 'https://flagcdn.com/w40/';
var RECORDS_PER_PAGE = 50;
var SORTS = { points:'Points', elo:'Elo', peak:'Best placement', activity:'Activity' };

// ============================= SHARED STATE =============================
// Loaded and written by app.js; read/updated by router.js and renderer.js
var allPlayers = [], playerByTag = {}, countryMap = {};
var seasonData = {}, seasonTagSets = [], seasonPlacementMap = {}, missingSeasons = [];
var eloMap = {}, eloHist = {}, pointsRankMap = {}, eloRankMap = {};
var currentView = 'player';   // 'player' | 'country-list' | 'country-detail'
var currentSort = 'points', currentCountryFilter = 'all', currentMonth = -1;
var currentDetailCC = '', currentPage = 1;
var dataReady = false;
