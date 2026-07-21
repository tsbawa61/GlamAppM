/**
 * state.js — GlamTrack Shared State & Firebase Initialisation
 * All globals, Firebase references, COL constants, and catalog cache
 * live here. Every other module imports from this file.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
    getFirestore, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ── Firebase ──────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyDQO_LSnflOgA5H-Nz95eIksx94BhlZP_c",
    authDomain:        "vault-050166.firebaseapp.com",
    projectId:         "vault-050166",
    storageBucket:     "vault-050166.firebasestorage.app",
    messagingSenderId: "252753845895",
    appId:             "1:252753845895:web:0def3dc427df7938c12222",
    measurementId:     "G-4XEPZ5S45V"
};
export const firebaseApp = initializeApp(FIREBASE_CONFIG);
export const db          = getFirestore(firebaseApp);

// ── Collection name constants ─────────────────────────────────────────────
export const COL = {
    USERS:        "users",
    SERVICES:     "services",
    SUB_SERVICES: "subServices",
    CATEGORIES:   "serviceCategories",
    COMMON_PACKS: "commonServicePacks",
    CUST_PACKS:   "customerServicePacks",
    VISIT_LOGS:   "serviceUtilizationLogs",
};

// ── Session state ─────────────────────────────────────────────────────────
export let activeSessionUser       = null;
export let salonOwnerNameContext   = "Unassigned Salon Context";
export let realtimePacksUnsubscribe = null;
export let sessionWatchdogTimer    = null;

export function setActiveSessionUser(user)            { activeSessionUser = user; }
export function setSalonOwnerNameContext(name)         { salonOwnerNameContext = name; }
export function setRealtimePacksUnsubscribe(fn)        { realtimePacksUnsubscribe = fn; }
export function setSessionWatchdogTimer(t)             { sessionWatchdogTimer = t; }

// ── Allotment state ───────────────────────────────────────────────────────
export let allotCurrentPackTotalAmount = 0;
export let allotPacksCache             = new Map();
export let _allotExistingPacks         = [];
export let _allotExistingIdx           = 0;
export let _postRegAllotMode           = false;
export let _quickAddCustomerMode       = false;
export let _allotMembershipModalInstance = null;
export let _postRegAllotModalInstance    = null;
export let _quickAddCustomerModalInstance = null;
export let _userProfileFormOriginalParent       = null;
export let _userProfileFormOriginalNextSibling  = null;
export let _allotFormOriginalParent             = null;
export let _allotFormOriginalNextSibling        = null;

export function setAllotCurrentPackTotalAmount(v) { allotCurrentPackTotalAmount = v; }
export function setAllotExistingPacks(arr)         { _allotExistingPacks = arr; }
export function setAllotExistingIdx(i)             { _allotExistingIdx = i; }
export function setPostRegAllotMode(v)             { _postRegAllotMode = v; }
export function setQuickAddCustomerMode(v)         { _quickAddCustomerMode = v; }

// ── Visit state ───────────────────────────────────────────────────────────
export let _utilizeOverrideConfirmed = false;
export let _utilizeOverrideMeta      = null;
export let _oldVisitPrevCalcCost     = 0;
export let _oldVisitPrevAddlAmt      = 0;
export let _oldVisitLogDocRef        = null;
export let _utilizeStaffOptions      = null;
export let utilizePrevUnpaidBalance  = 0;

// Dashboard state
export const GLAMTRACK_PREVIEW_ROWS = 5;
export let _glamtrackFullExpiries   = [];
export let _glamtrackFullUnengaged  = [];
export let _glamtrackFullPremium    = [];

export function setGlamtrackFullExpiries(v)  { _glamtrackFullExpiries  = v; }
export function setGlamtrackFullUnengaged(v) { _glamtrackFullUnengaged = v; }
export function setGlamtrackFullPremium(v)   { _glamtrackFullPremium   = v; }

export function setUtilizeOverrideConfirmed(v)  { _utilizeOverrideConfirmed = v; }
export function setUtilizeOverrideMeta(v)        { _utilizeOverrideMeta = v; }
export function setOldVisitPrevCalcCost(v)       { _oldVisitPrevCalcCost = v; }
export function setOldVisitPrevAddlAmt(v)        { _oldVisitPrevAddlAmt = v; }
export function setOldVisitLogDocRef(v)          { _oldVisitLogDocRef = v; }
export function setUtilizeStaffOptions(v)        { _utilizeStaffOptions = v; }
export function setUtilizePrevUnpaidBalance(v)   { utilizePrevUnpaidBalance = v; }
export function setQuickAddCustomerModalInstance(v) { _quickAddCustomerModalInstance = v; }
export function setUserProfileFormOriginalParent(v) { _userProfileFormOriginalParent = v; }
export function setUserProfileFormOriginalNextSibling(v) { _userProfileFormOriginalNextSibling = v; }
export function setPostRegAllotModalInstance(v) { _postRegAllotModalInstance = v; }
export function setAllotFormOriginalParent(v) { _allotFormOriginalParent = v; }
export function setAllotFormOriginalNextSibling(v) { _allotFormOriginalNextSibling = v; }

// ── Timing ────────────────────────────────────────────────────────────────
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

// ── In-memory catalog cache ───────────────────────────────────────────────
let _cachedServices    = null;
let _cachedSubServices = null;
let _cacheOwnerId      = null;

export function invalidateServicesCache()   { _cachedServices = null; }
export function invalidateSubServicesCache(){ _cachedSubServices = null; }
export function invalidateCatalogCache()    { _cachedServices = null; _cachedSubServices = null; }

export function _ownerFilter() {
    if (!activeSessionUser) return null;
    return (activeSessionUser.role === "OWNER")
        ? activeSessionUser.userNo
        : activeSessionUser.ownerUserNo;
}

export async function _getCachedServices() {
    const oid = _ownerFilter();
    if (_cachedServices && _cacheOwnerId === oid) return _cachedServices;
    let snap = await getDocs(query(collection(db, COL.SERVICES), where("ownerUserNo", "==", oid)));
    if (snap.empty) snap = await getDocs(query(collection(db, COL.SERVICES), where("ownerUserNo", "==", "000")));
    _cachedServices = snap;
    _cacheOwnerId   = oid;
    return _cachedServices;
}

export async function _getCachedSubServices() {
    const oid = _ownerFilter();
    if (_cachedSubServices && _cacheOwnerId === oid) return _cachedSubServices;
    let snap = await getDocs(query(collection(db, COL.SUB_SERVICES), where("ownerUserNo", "==", oid)));
    if (snap.empty) snap = await getDocs(query(collection(db, COL.SUB_SERVICES), where("ownerUserNo", "==", "000")));
    _cachedSubServices = snap;
    _cacheOwnerId      = oid;
    return _cachedSubServices;
}
