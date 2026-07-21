// dashboard.js — GlamTrack
import { db, COL, _ownerFilter, invalidateServicesCache, invalidateSubServicesCache, invalidateCatalogCache, activeSessionUser, setActiveSessionUser, salonOwnerNameContext, setSalonOwnerNameContext, realtimePacksUnsubscribe, setRealtimePacksUnsubscribe, sessionWatchdogTimer, setSessionWatchdogTimer, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, setAllotExistingPacks, _allotExistingIdx, setAllotExistingIdx, _postRegAllotMode, setPostRegAllotMode, _quickAddCustomerMode, setQuickAddCustomerMode, _utilizeStaffOptions, setUtilizeStaffOptions, utilizePrevUnpaidBalance, setUtilizePrevUnpaidBalance, _oldVisitPrevCalcCost, setOldVisitPrevCalcCost, _oldVisitPrevAddlAmt, setOldVisitPrevAddlAmt, _oldVisitLogDocRef, setOldVisitLogDocRef, INACTIVITY_TIMEOUT_MS, GLAMTRACK_PREVIEW_ROWS, _glamtrackFullExpiries, _glamtrackFullUnengaged, _glamtrackFullPremium, setGlamtrackFullExpiries, setGlamtrackFullUnengaged, setGlamtrackFullPremium } from "./state.js";
import { collection, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
;
;

// Cross-module imports
import { handleTelemetryAlert } from "./auth.js";

export function renderGlamtrackExpiries(packsArray) {
    const tExp = document.getElementById("tbl-dash-expiries");
    const statEl = document.getElementById("stat-expiring-glamtrack");
    const viewMoreBtn = document.getElementById("btn-viewmore-expiries");
    if (!tExp) return;

    const today = new Date();
    const limit = new Date(); limit.setDate(today.getDate() + 10);
    const todayStr = today.toISOString().split("T")[0];
    const limitStr = limit.toISOString().split("T")[0];

    setGlamtrackFullExpiries(packsArray.filter(p => {
        if (!p.expiryDate) return false;
        return p.expiryDate >= todayStr && p.expiryDate <= limitStr;
    }).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)));

    if (statEl) statEl.textContent = _glamtrackFullExpiries.length;

    const rows = _glamtrackFullExpiries.slice(0, GLAMTRACK_PREVIEW_ROWS);
    tExp.innerHTML = rows.length === 0
        ? `<tr><td colspan="4" class="text-center text-muted py-2">No packages expiring within the next 10 days.</td></tr>`
        : rows.map(p => `
            <tr>
                <td><strong>Client #${p.customerNo}</strong></td>
                <td>${p.packName}</td>
                <td class="text-primary small" style="cursor:pointer;text-decoration:underline;"
                    onclick="navigator.clipboard.writeText('${p.phone||''}');alert('Phone copied for Client #${p.customerNo}')">Copy Phone</td>
                <td><span class="badge bg-danger">${p.expiryDate}</span></td>
            </tr>`).join("");

    if (viewMoreBtn) viewMoreBtn.classList.toggle("d-none", _glamtrackFullExpiries.length <= GLAMTRACK_PREVIEW_ROWS);
}

// --- ii) Unengaged Customers ---
export async function renderGlamtrackUnengaged() {
    const tbody = document.getElementById("tbl-glamtrack-unengaged");
    const statEl = document.getElementById("stat-unengaged-glamtrack");
    const viewMoreBtn = document.getElementById("btn-viewmore-unengaged");
    if (!tbody || !activeSessionUser) return;

    const ownerMatch = _ownerFilter();
    if (!ownerMatch) return;
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-2">Loading…</td></tr>`;

    try {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 180);
        const cutoffStr = cutoff.toISOString().split("T")[0];

        const packsQ = query(collection(db, COL.CUST_PACKS), where("ownerUserNo", "==", ownerMatch));
        const packsSnap = await getDocs(packsQ);

        const unengagedMap = new Map();
        packsSnap.forEach(d => {
            const p = d.data();
            const key = `${p.customerNo}|${p.ownerUserNo}`;
            const startOld = !p.lastVisitDate && p.startDate && p.startDate <= cutoffStr;
            const lastVisitOld = p.lastVisitDate && p.lastVisitDate <= cutoffStr;
            if (startOld || lastVisitOld) {
                const lv = p.lastVisitDate || p.startDate || "";
                const existing = unengagedMap.get(key);
                if (!existing || lv > (existing.lastVisit || ""))
                    unengagedMap.set(key, { customerNo: p.customerNo, ownerUserNo: p.ownerUserNo, lastVisit: lv });
            }
        });

        // Step 2: Only run for customers NOT already found in Step 1.
        // Collect the set of customerNo|ownerUserNo keys found in packs but NOT yet unengaged
        // (i.e. their pack data looks recent) — check their actual visit logs as a fallback.
        const coveredByStep1 = new Set(unengagedMap.keys());
        const allPackKeys = new Set();
        packsSnap.forEach(d => {
            const p = d.data();
            allPackKeys.add(`${p.customerNo}|${p.ownerUserNo}`);
        });
        // Customers in packs but NOT caught by Step 1 — need log verification
        const needsLogCheck = [...allPackKeys].filter(k => !coveredByStep1.has(k));

        if (needsLogCheck.length > 0) {
            const logsQ = query(collection(db, COL.VISIT_LOGS), where("ownerUserNo", "==", ownerMatch));
            const logsSnap = await getDocs(logsQ);
            const logsMaxMap = new Map();
            logsSnap.forEach(d => {
                const l = d.data();
                const key = `${l.customerNo}|${l.ownerUserNo}`;
                if (!needsLogCheck.includes(key)) return; // skip customers already handled by Step 1
                const cur = logsMaxMap.get(key) || "";
                if ((l.visitDate || "") > cur) logsMaxMap.set(key, l.visitDate || "");
            });
            logsMaxMap.forEach((maxVisitDate, key) => {
                if (maxVisitDate <= cutoffStr) {
                    const [customerNo, ownerUserNo] = key.split("|");
                    const existing = unengagedMap.get(key);
                    if (!existing || maxVisitDate > (existing.lastVisit || ""))
                        unengagedMap.set(key, { customerNo, ownerUserNo, lastVisit: maxVisitDate });
                }
            });
        }

        if (unengagedMap.size === 0) {
            if (statEl) statEl.textContent = "0";
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-2">No unengaged customers found.</td></tr>`;
            if (viewMoreBtn) viewMoreBtn.classList.add("d-none");
            return;
        }

        const usersQ = query(collection(db, COL.USERS), where("ownerUserNo", "==", ownerMatch), where("role", "==", "CUSTOMER"));
        const usersSnap = await getDocs(usersQ);
        const usersMap = new Map();
        usersSnap.forEach(d => { const u = d.data(); usersMap.set(u.userNo, u); });

        setGlamtrackFullUnengaged(Array.from(unengagedMap.values()).map(r => {
            const u = usersMap.get(r.customerNo) || {};
            return { ...r, name: u.name || "—", phone: u.phone || "—", email: u.email || "—" };
        }).sort((a, b) => (a.lastVisit || "").localeCompare(b.lastVisit || "")));

        if (statEl) statEl.textContent = _glamtrackFullUnengaged.length;
        const rows = _glamtrackFullUnengaged.slice(0, GLAMTRACK_PREVIEW_ROWS);
        tbody.innerHTML = rows.map(r => `
            <tr>
                <td><strong>#${r.customerNo}</strong></td>
                <td>${r.name}</td><td>${r.phone}</td><td>${r.email}</td>
                <td>${r.lastVisit || "—"}</td>
            </tr>`).join("");
        if (viewMoreBtn) viewMoreBtn.classList.toggle("d-none", _glamtrackFullUnengaged.length <= GLAMTRACK_PREVIEW_ROWS);

    } catch(err) { await handleTelemetryAlert("GlamTrack Unengaged Customers", err); }
}

// --- iii) Premium Customers ---
export async function renderGlamtrackPremium() {
    const tbody = document.getElementById("tbl-glamtrack-premium");
    const statEl = document.getElementById("stat-premium-glamtrack");
    const viewMoreBtn = document.getElementById("btn-viewmore-premium");
    if (!tbody || !activeSessionUser) return;

    const ownerMatch = _ownerFilter();
    if (!ownerMatch) return;
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-2">Loading…</td></tr>`;

    try {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 400);
        const cutoffStr = cutoff.toISOString().split("T")[0];

        const packsQ = query(collection(db, COL.CUST_PACKS), where("ownerUserNo", "==", ownerMatch));
        const packsSnap = await getDocs(packsQ);

        const spendMap = new Map();
        packsSnap.forEach(d => {
            const p = d.data();
            if (!p.startDate || p.startDate < cutoffStr) return;
            spendMap.set(p.customerNo, (spendMap.get(p.customerNo) || 0) + Number(p.soldPrice || 0));
        });

        const premiumEntries = Array.from(spendMap.entries())
            .filter(([, t]) => t > 20000)
            .sort(([, a], [, b]) => b - a);

        if (premiumEntries.length === 0) {
            if (statEl) statEl.textContent = "0";
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-2">No premium customers found.</td></tr>`;
            if (viewMoreBtn) viewMoreBtn.classList.add("d-none");
            return;
        }

        const usersQ = query(collection(db, COL.USERS), where("ownerUserNo", "==", ownerMatch), where("role", "==", "CUSTOMER"));
        const usersSnap = await getDocs(usersQ);
        const usersMap = new Map();
        usersSnap.forEach(d => { const u = d.data(); usersMap.set(u.userNo, u); });

        setGlamtrackFullPremium(premiumEntries.map(([customerNo, totalSpend]) => {
            const u = usersMap.get(customerNo) || {};
            return { customerNo, totalSpend, name: u.name||"—", phone: u.phone||"—", email: u.email||"—" };
        }));

        if (statEl) statEl.textContent = _glamtrackFullPremium.length;
        const rows = _glamtrackFullPremium.slice(0, GLAMTRACK_PREVIEW_ROWS);
        const isOwner = activeSessionUser?.role === "OWNER";
        tbody.innerHTML = rows.map(r => `
            <tr>
                <td><strong>#${r.customerNo}</strong></td>
                <td>${r.name}</td><td>${r.phone}</td><td>${r.email}</td>
                ${isOwner ? `<td class="fw-bold text-success">₹${Number(r.totalSpend).toLocaleString("en-IN")}</td>` : "<td>—</td>"}
            </tr>`).join("");
        // Show/hide Total Spend column header based on role
        const premiumThead = document.querySelector("#tbl-glamtrack-premium thead tr th:last-child");
        if (premiumThead) premiumThead.style.display = isOwner ? "" : "none";
        if (viewMoreBtn) viewMoreBtn.classList.toggle("d-none", _glamtrackFullPremium.length <= GLAMTRACK_PREVIEW_ROWS);

    } catch(err) { await handleTelemetryAlert("GlamTrack Premium Customers", err); }
}

// --- Scroll to glamtrack list section on stat card click ---
export function scrollToGlamtrackSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- View More Modal ---
export function openGlamtrackModal(type) {
    let title = "", headHtml = "", rows = [];
    if (type === "expiries") {
        title = "Packages Expiring in 10 Days";
        headHtml = `<tr><th>Customer ID</th><th>Package Name</th><th>Phone</th><th>Expiry Date</th></tr>`;
        rows = _glamtrackFullExpiries.map(p => `<tr><td><strong>Client #${p.customerNo}</strong></td><td>${p.packName}</td><td>${p.phone||"—"}</td><td><span class="badge bg-danger">${p.expiryDate}</span></td></tr>`);
    } else if (type === "unengaged") {
        title = "Unengaged Customers (No Visit in last 6M)";
        headHtml = `<tr><th>Customer ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Last Visit</th></tr>`;
        rows = _glamtrackFullUnengaged.map(r => `<tr><td><strong>#${r.customerNo}</strong></td><td>${r.name}</td><td>${r.phone}</td><td>${r.email}</td><td>${r.lastVisit||"—"}</td></tr>`);
    } else if (type === "premium") {
        title = "Premium Customers";
        const isOwnerModal = activeSessionUser?.role === "OWNER";
        headHtml = `<tr><th>Customer ID</th><th>Name</th><th>Phone</th><th>Email</th>${isOwnerModal ? "<th>Total Spend (₹)</th>" : ""}</tr>`;
        rows = _glamtrackFullPremium.map(r => `<tr><td><strong>#${r.customerNo}</strong></td><td>${r.name}</td><td>${r.phone}</td><td>${r.email}</td>${isOwnerModal ? `<td class="fw-bold text-success">₹${Number(r.totalSpend).toLocaleString("en-IN")}</td>` : ""}</tr>`);
    }
    document.getElementById("glamtrackModalTitle").textContent = title;
    document.getElementById("glamtrackModalHead").innerHTML = headHtml;
    document.getElementById("glamtrackModalBody").innerHTML = rows.join("") || `<tr><td colspan="5" class="text-center text-muted py-2">No records.</td></tr>`;
    new bootstrap.Modal(document.getElementById("glamtrackModal")).show();
}

// =========================================================================
// Real-Time Analytics Monitoring Subsystem
// =========================================================================
export function bindRealtimeAnalyticsStream() {
    const ownerId = activeSessionUser.ownerUserNo;
    const qPacks = query(collection(db, COL.CUST_PACKS), where("ownerUserNo", "==", ownerId));

    setRealtimePacksUnsubscribe(onSnapshot(qPacks, async (snapshot) => {
        try {
            const packsArray = [];
            snapshot.forEach(d => packsArray.push(d.data()));

            const activeCnt = packsArray.filter(p => p.active).length;
            document.getElementById("stat-active-packs").innerText = activeCnt;
            const glamtrackStat = document.getElementById("stat-active-packs-glamtrack");
            if (glamtrackStat) glamtrackStat.textContent = activeCnt;

            // Render expiries list (now lives in sec-glamtrack)
            renderGlamtrackExpiries(packsArray);

            // Refresh unengaged + premium lists
            await renderGlamtrackUnengaged();
            await renderGlamtrackPremium();

        } catch(err) {
            await handleTelemetryAlert("Realtime Dashboard Live Engine", err);
        }
    }));
}

// =========================================================================
// Dynamic Checkbox Generation - Reference Master Packs
// =========================================================================

