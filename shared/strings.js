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
    share: 'share',
    linkCopied: 'link copied',
    rename: 'rename',
    remove: 'remove',
    apply: 'apply',
    search: 'search',
    all: 'all',
    go: 'go',
    manage: 'manage',
    logOut: 'log out',
    retake: 'retake',
    newPhoto: 'new photo',
    removingBackground: 'removing background...',
    selectAll: 'select all',
    deselectAll: 'deselect all',
    noMatches: 'no matches',
    clear: 'clear',
    retry: 'retry',
    saveFailedTitle: 'save failed',
    saveFailedMessage: 'check your connection and try again',
  },

  // Auth
  auth: {
    continueWithGoogle: 'continue with google',
    continueWithApple: 'continue with apple',
    useEmail: 'sign in with email',
    emailPlaceholder: 'email',
    passwordPlaceholder: 'password',
    signIn: 'sign in',
    signInFailed: 'sign-in failed. check your email and password.',
    // Shown under the sign-in buttons. The middle word links to the terms screen.
    agreePrefix: 'by continuing you agree to our ',
    agreeSuffix: ', and to a zero-tolerance policy for objectionable content and abusive behavior.',
  },

  // Moderation — report content + block users (App Store guideline 1.2)
  moderation: {
    report: 'report',
    block: 'block',
    unblock: 'unblock',
    blockUser: (name) => `block ${name}`,
    reportTitle: 'report this',
    reportSubtitle: "what's wrong with it?",
    reasons: [
      { value: 'spam', label: 'spam or scam' },
      { value: 'nudity', label: 'nudity or sexual content' },
      { value: 'hate', label: 'hate or harassment' },
      { value: 'violence', label: 'violence or threats' },
      { value: 'illegal', label: 'illegal or dangerous' },
      { value: 'other', label: 'something else' },
    ],
    reportThanksTitle: 'thanks for reporting',
    reportThanksBody: "we'll review this within 24 hours.",
    blockConfirmTitle: (name) => `block ${name}?`,
    blockConfirmBody: "you won't see their things anymore.",
    blocked: 'blocked',
    blockedDone: (name) => `blocked ${name}`,
    profileBlocked: (name) => `you blocked ${name}`,
    profileBlockedHint: 'their things are hidden while blocked.',
    unblockConfirmTitle: (name) => `unblock ${name}?`,
    unblockConfirmBody: 'you’ll see their things again.',
  },

  // Terms & content policy (shown from the auth screen; satisfies the EULA requirement)
  legal: {
    termsLink: 'terms',
    termsTitle: 'terms & content policy',
    body: [
      'things is a place to catalogue your stuff and share it with others. by using it you agree to keep it civil.',
      'there is zero tolerance for objectionable content or abusive behavior. do not post content that is illegal, hateful, harassing, sexually explicit, violent, or that infringes anyone else’s rights.',
      'you can report any content from the … menu, and block any user from their profile or any of their things. reported content and the accounts behind it are reviewed within 24 hours, and anything that violates this policy — along with the user who posted it — is removed.',
      'we may remove content or suspend accounts at our discretion to keep the community safe.',
    ],
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
    useAsCover: 'use as cover',
    deleteItem: 'delete thing',
  },

  // Add-item flow
  addItem: {
    title: 'add thing',                                  // web modal header
    clickOrDragToAddPhoto: 'click or drag to add a photo', // web drop zone
  },

  // Batch edit
  batchEdit: {
    title: (n) => `edit ${n} ${plural(n, 'thing')}`,
    addTags: 'add tags',
    removeTag: 'remove tag',
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
    objectCount: (n) => `${n} ${plural(n, 'thing')}`,
    collageCount: (n) => `${n} ${plural(n, 'collage')}`,
    edit: 'edit profile',                                // web edit-profile dialog title
    settings: 'settings',                                // web settings page title + link
    displayName: 'display name',
    displayNamePlaceholder: 'your name',
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
    tagNameTaken: 'tag name already exists',
    deleteTagWithCollages: (tag, n) =>
      `Delete "${tag}" and ${n} ${plural(n, 'collage')}?`,
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
      { code: 'acquired:none', desc: 'things missing the field' },
    ],
  },

  // Filters / sorting
  filters: {
    allYears: 'all years',
    allCities: 'all cities',
    sort: {
      label: 'sort',
      newest: 'added (newest)',
      oldest: 'added (oldest)',
      lastEdited: 'last edited',
      nameAZ: 'name a–z',
      nameZA: 'name z–a',
      acquiredNewest: 'acquired (newest)',
      acquiredOldest: 'acquired (oldest)',
      usedRecent: 'last used',
      usedOften: 'most used',
      random: 'random',
    },
    // Date-range chip on profile page
    addedOn: (date) => `added ${date}`,
    addedRange: (from, to) =>
      `added ${from ?? '…'} – ${to ?? '…'}`,
  },

  // Today (mobile) — 3x3 daily-contemplation grid tab
  today: {
    title: 'today',
    subtitle: 'give these objects special attention today',
    empty: 'nothing here yet',
  },

  // Feed (mobile) and home page (web)
  feed: {
    emptyMobile: 'nothing yet — add your first thing',
    emptyWeb: "you haven't added anything yet",
    addFirstItem: 'add your first thing',
    myCollection: 'my collection',
    itemOfTheDay: 'thing of the day',
    feedEmpty: 'nothing here yet',
    loading: 'loading…',
    addedNewItem: 'added a new thing',
    usedItem: 'used',
    tabEveryone: 'everyone',
    tabFriends: 'friends',
    friendsEmpty: 'follow people to see their things here',
  },

  // Following (profile actions + follower/following lists)
  social: {
    follow: 'follow',
    following: 'following',
    followersCount: (n) => `${n} ${plural(n, 'follower')}`,
    followingCount: (n) => `${n} following`,
    followersTitle: 'followers',
    followingTitle: 'following',
    noFollowers: 'no followers yet',
    noFollowing: 'not following anyone yet',
  },

  // In-app notifications (bell + list)
  notifications: {
    title: 'notifications',
    empty: 'no notifications yet',
    followed: 'followed you',
    liked: 'favorited your thing',
  },

  // Favorites ("hearts") — favorite other people's things, view them in a grid.
  favorites: {
    entry: 'favorites',
    title: 'favorites',
    subtitle: 'things you’ve hearted from others',
    favorite: 'favorite',
    favorited: 'favorited',
    empty: 'no favorites yet',
    emptyHint: 'heart things from other people to keep them here',
    count: (n) => `${n} ${plural(n, 'favorite')}`,
  },

  // Usage tracking (item detail + edit)
  usage: {
    useToday: 'use today',
    usedToday: 'used today',
    neverUsed: 'never used',
    lastUsed: (rel) => `last used ${rel}`,
    timesUsed: (n) => `used ${n} ${plural(n, 'time')}`,
    historyTitle: 'usage history',
    viewHistory: 'usage history',
    addEntry: 'add entry',
    addDate: 'add',
    noHistory: 'no past days logged yet',
  },

  // Graveyard — retired items (sold, consumed, lost, …) rest here.
  graveyard: {
    emoji: '🪦',
    entry: 'graveyard',
    title: 'graveyard',
    subtitle: 'things you no longer have',
    empty: 'the graveyard is empty',
    emptyHint: 'retired things rest here',
    count: (n) => `${n} ${plural(n, 'thing')} at rest`,
    // Retire flow
    retire: 'retire',
    retireTitle: 'retire this thing',
    retireHint: 'move it to the graveyard — you can resurrect it anytime',
    reasonLabel: 'reason',
    reasonOptions: ['sold', 'consumed', 'lost', 'stolen', 'given away', 'broke', 'donated'],
    epitaphLabel: 'epitaph',
    epitaphPlaceholder: 'a few last words (optional)',
    confirmRetire: 'retire',
    // Resurrect + detail display
    resurrect: 'resurrect',
    retiredOn: (date) => `retired ${date}`,
    reasonLine: (reason) => `reason: ${reason}`,
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
      `${objects} ${plural(objects, 'thing')} across ${locations} ${plural(locations, 'location')}`,
    connectedTo: (city) => ` · connected to ${city}`,
    seeAllFromMobile: (city) => `see all from ${city}`,
    seeAllFromWeb: (city) => `see all from ${city} →`,
    objectsLabel: (n) => plural(n, 'thing'),
    daysLabel: (n) => plural(n, 'day'),
    objectCount: (n) => `${n} ${plural(n, 'thing')}`,
    objectCountWithRegion: (n, region) =>
      `${n} ${plural(n, 'thing')}${region ? ` · ${region}` : ''}`,
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

  // Collages (mobile only) — saved arrangements of items, scoped to a tag.
  collages: {
    title: 'collages',
    titleForTag: (tag) => `collages · ${tag}`,
    newCollage: 'new collage',
    untitled: 'untitled',
    titlePlaceholder: 'title',
    save: 'save',
    saving: 'saving…',
    saveFailed: 'Save failed',
    deleteConfirm: (title) => `Delete "${title || 'untitled'}"?`,
    deleteConfirmAction: 'Delete',
    empty: 'no collages yet',
    discardChangesTitle: 'Discard changes?',
    discardChangesMessage: 'You have unsaved changes.',
    discardChangesAction: 'Discard',
    keepEditing: 'Keep editing',
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
    today: 'today',
    addItem: 'add thing',
    yourCollection: 'your collection',
    notifications: 'notifications',
    favorites: 'favorites',
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
