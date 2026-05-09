// All user-facing strings for both apps (mobile + web).
// Edit text here; both Metro and Vite resolve relative imports from this file.
//
// Usage:
//   import { S } from '../shared/strings';        // mobile screens
//   import { S } from '../../shared/strings';     // mobile app/(tabs)
//   import { S } from '../../../shared/strings';  // web screens
//
// Functions are used for strings that need values interpolated or pluralized.

const plural = (n, singular, pluralForm) =>
  n === 1 ? singular : (pluralForm ?? `${singular}s`);

export const S = {
  // App branding
  appName: 'things',
  appTagline: 'a home for your stuff',

  // Common UI labels (reused across many screens)
  common: {
    cancel: 'cancel',
    save: 'save',
    saving: 'saving...',
    done: 'done',
    delete: 'delete',
    edit: 'edit',
    remove: 'remove',
    apply: 'apply',
    search: 'search',
    all: 'all',
    go: 'go',
    manage: 'manage',
    logOut: 'log out',
    retake: 'retake',
    changePhoto: 'change photo',
    changeImage: 'change image',
    removingBackground: 'removing background...',
    selectAll: 'select all',
    deselectAll: 'deselect all',
    noMatches: 'no matches',
  },

  // Auth
  auth: {
    continueWithGoogle: 'continue with google',
  },

  // Item form fields (used by add + edit on both apps)
  itemForm: {
    tagPlaceholder: 'tag',
    namePlaceholder: 'name',
    descriptionPlaceholder: 'description',
    yearPlaceholder: 'year acquired',
    cityPlaceholder: 'city acquired',
    acquired: 'acquired',
    acquiredIn: ' in ',
    acquiredSeparator: ' · ',
    addedOn: (date) => `added ${date}`,
    photoFrom: (date) => `photo from ${date}`,
    deleteItem: 'delete item',
  },

  // Add-item flow
  addItem: {
    title: 'add item',                                  // web modal header
    clickOrDragToAddPhoto: 'click or drag to add a photo', // web drop zone
  },

  // Batch edit
  batchEdit: {
    title: (n) => `edit ${n} ${plural(n, 'item')}`,
    addTags: 'add tags',
    setYear: 'set year',
    setLocation: 'set location',
    leaveBlankToSkip: 'leave blank to skip',
    selectedCount: (n) => `${n} selected`,
  },

  // Profile (own)
  profile: {
    title: 'profile',
    name: 'name',
    username: 'username',
    usernamePlaceholder: 'username',
    usernameExample: 'alice',                            // mobile open-profile sheet
    usernameHint: (username) => `your profile will live at /u/${username || 'username'}`,
    setUsername: 'set username',
    homeCity: 'home city',
    setHomeCity: 'set your home city',
    setHomeCityShort: 'set home city',                   // web header button
    homeCityPublicHint: 'shown publicly on your profile',
    collection: 'collection',
    account: 'account',
    objectCount: (n) => `${n} ${plural(n, 'object')}`,
    // Username validation — mobile + web wording differs slightly
    usernameInvalidMobile: '3–20 chars: a–z, 0–9, _',
    usernameInvalidWeb: '3–20 chars, a–z 0–9 _',
    usernameTaken: 'username taken',                     // mobile
    usernameTakenShort: 'taken',                         // web
    usernameReserved: 'username reserved',                // mobile
    usernameReservedShort: 'reserved',                   // web
  },

  // Profile-view (public)
  profileView: {
    notFound: (slug) => `no profile at /u/${slug}`,
    nothingPublic: 'nothing public yet',
  },

  // Open-profile sheet (mobile only)
  openProfile: {
    title: 'open profile',
  },

  // Collection screen
  collection: {
    noYear: 'no year',
    noCity: 'no city',
    untagged: 'untagged',
    manageTags: (n) => `manage tags · ${n}`,
    noTagsYet: 'no tags yet',
    searchTags: 'search tags',
  },

  // Advanced search syntax help (popover anchored to the search bar)
  searchHelp: {
    title: 'search syntax',
    intro: 'combine terms with spaces (and), OR, or - to exclude',
    examples: [
      { code: 'tag:books', desc: 'exact tag match' },
      { code: 'tag:"tea and coffee"', desc: 'quote multi-word values' },
      { code: '-tag:fiction', desc: 'exclude (works with any field)' },
      { code: 'tag:books OR tag:kitchen', desc: 'either tag' },
      { code: 'acquired:2024', desc: 'year acquired (alias: year:)' },
      { code: 'acquired:>2020', desc: 'comparisons: >, <, >=, <=' },
      { code: 'acquired:2020..2024', desc: 'range' },
      { code: 'added:>2026-01-01', desc: 'date added (YYYY, YYYY-MM, YYYY-MM-DD)' },
      { code: 'city:Berlin', desc: 'city acquired' },
      { code: 'name:camera', desc: 'fields: name, desc, ocr' },
      { code: 'acquired:none', desc: 'items missing the field' },
    ],
  },

  // Filters / sorting (web)
  filters: {
    allYears: 'all years',
    allCities: 'all cities',
    sort: {
      newest: 'newest',
      oldest: 'oldest',
      nameAZ: 'name a–z',
      nameZA: 'name z–a',
      acquiredNewest: 'acquired (newest)',
      acquiredOldest: 'acquired (oldest)',
    },
    // Date-range chip on profile page
    addedOn: (date) => `added ${date}`,
    addedRange: (from, to) =>
      `added ${from ?? '…'} – ${to ?? '…'}`,
  },

  // Feed (mobile) and home page (web)
  feed: {
    emptyMobile: 'nothing yet — add your first item',
    emptyWeb: "you haven't added anything yet",
    addFirstItem: 'add your first item',
    myCollection: 'my collection',
    itemOfTheDay: 'item of the day',
  },

  // Stats
  stats: {
    title: 'stats',
    subtitle: 'your collection over time',
    empty: 'nothing to show yet',
    total: 'total',
    streakMobile: 'streak',
    streakWeb: 'current streak',
    longestMobile: 'longest',
    longestWeb: 'longest streak',
    bestDay: 'best day',
    last30Days: 'last 30 days',
    last12Weeks: 'last 12 weeks',
    last12Months: 'last 12 months',
    topCities: 'top cities',
    tags: 'tags',
    acquiredAroundWorld: 'acquired around the world',
    unnamedLocation: 'unnamed location',
    home: 'home',
    acquisitionTitle: (bucketSize) =>
      `acquisition ${bucketSize === 1 ? 'years' : `${bucketSize}-year periods`}`,
    mapCaption: (objects, locations) =>
      `${objects} ${plural(objects, 'object')} across ${locations} ${plural(locations, 'location')}`,
    connectedTo: (city) => ` · connected to ${city}`,
    seeAllFromMobile: (city) => `see all from ${city}`,
    seeAllFromWeb: (city) => `see all from ${city} →`,
    objectsLabel: (n) => plural(n, 'object'),
    daysLabel: (n) => plural(n, 'day'),
    objectCount: (n) => `${n} ${plural(n, 'object')}`,
    objectCountWithRegion: (n, region) =>
      `${n} ${plural(n, 'object')}${region ? ` · ${region}` : ''}`,
  },

  // Canvas (mobile only)
  canvas: {
    title: 'canvas',
    export: 'export',
    error: 'Error',
    canvasNotReady: 'Canvas not ready',
    permissionNeeded: 'Permission needed',
    permissionMessage: 'Allow photo library access to save the canvas.',
    failedSnapshot: 'Failed to snapshot canvas',
    saved: 'Saved',
    savedMessage: 'Canvas saved to your photo library.',
    exportFailed: 'Export failed',
  },

  // Camera (mobile only)
  camera: {
    permissionMessage: 'camera access needed',
    allowCamera: 'allow camera',
  },

  // Location picker
  location: {
    defaultPlaceholder: 'city',
  },

  // Tag input (web)
  tagInput: {
    defaultPlaceholder: 'add tag…',
    removeTag: (tag) => `remove ${tag}`,
    createTag: (q) => `+ create "${q}"`,
  },

  // Accessibility / aria-label / title attributes
  a11y: {
    // mobile tab bar
    feed: 'feed',
    addItem: 'add item',
    yourCollection: 'your collection',
    // web
    removePhoto: 'remove photo',
    clearSearch: 'clear search',
    searchHelp: 'search syntax help',
    clear: 'clear',
    filterByYear: 'filter by year',
    filterByCity: 'filter by city',
    sort: 'sort',
    clearYearRange: 'clear year range',
    clearDateFilter: 'clear date filter',
    publicClickPrivate: 'public — click to make private',
    privateClickPublic: 'private — click to make public',
    makePublic: 'make public',
    makePrivate: 'make private',
    lockUnlock: 'lock / unlock',
  },
};
