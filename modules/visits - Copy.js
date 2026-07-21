// visits.js — GlamTrack
import { db, COL, _ownerFilter, _getCachedServices, _getCachedSubServices, invalidateServicesCache, invalidateSubServicesCache, invalidateCatalogCache, activeSessionUser, setActiveSessionUser, salonOwnerNameContext, setSalonOwnerNameContext, realtimePacksUnsubscribe, setRealtimePacksUnsubscribe, sessionWatchdogTimer, setSessionWatchdogTimer, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, setAllotExistingPacks, _allotExistingIdx, setAllotExistingIdx, _postRegAllotMode, setPostRegAllotMode, _quickAddCustomerMode, setQuickAddCustomerMode, _utilizeStaffOptions, setUtilizeStaffOptions, utilizePrevUnpaidBalance, setUtilizePrevUnpaidBalance, _oldVisitPrevCalcCost, setOldVisitPrevCalcCost, _oldVisitPrevAddlAmt, setOldVisitPrevAddlAmt, _oldVisitLogDocRef, setOldVisitLogDocRef, INACTIVITY_TIMEOUT_MS,
    _utilizeOverrideConfirmed, _utilizeOverrideMeta, setUtilizeOverrideConfirmed, setUtilizeOverrideMeta
} from "./state.js";
import { collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
;
;

// Cross-module imports
import { handleTelemetryAlert } from "./auth.js";
;
;

// Display wallet ledger report
export async function displayWalletLedger() {
    const custNo = document.getElementById("utilize-customer-select").value;
    const contentEl = document.getElementById("wallet-ledger-content");
    if (!contentEl || !custNo) return;

    contentEl.innerHTML = `<div class="text-center text-muted py-2">Loading...</div>`;

    try {
        // Get all packages for this customer, sorted by createdAt
        const packQ = query(collection(db, COL.CUST_PACKS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("customerNo", "==", custNo));
        const packSnap = await getDocs(packQ);

        const packages = packSnap.docs.map(d => d.data()).sort((a, b) =>
            new Date(a.createdAt) - new Date(b.createdAt));

        let html = '';

        // Display each package
        for (const pkg of packages) {
            const createdDate = new Date(pkg.createdAt).toLocaleDateString('en-GB');
            html += `<div class="mb-2" style="border-bottom:1px solid #eee;padding-bottom:8px;">
                <div>${pkg.packName} <span style="color:#999;">-</span> <span style="color:green;">+₹${Number(pkg.totalAmount).toLocaleString("en-IN")}</span> <span style="font-size:0.8em;color:#999;">(${createdDate})</span></div>`;

            // Calculate sum of costs for this package
            const logsQ = query(collection(db, COL.VISIT_LOGS),
                where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                where("customerNo", "==", custNo),
                where("allotId", "==", pkg.allotId));
            const logsSnap = await getDocs(logsQ);
            let totalCost = 0;
            logsSnap.forEach(d => {
                totalCost += Number(d.data().calculatedValueCost || 0);
            });

            if (totalCost > 0) {
                html += `<div style="margin-left:10px;color:red;">- ₹${totalCost.toLocaleString("en-IN")}</div>`;
            }
            html += `</div>`;
        }

        // Get customer wallet balance
        const custQ = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("userNo", "==", custNo),
            where("role", "==", "CUSTOMER"));
        const custSnap = await getDocs(custQ);
        const walletAmt = !custSnap.empty ? (custSnap.docs[0].data().walletAmt || 0) : 0;

        html += `<div style="border-top:2px solid #333;padding-top:8px;margin-top:8px;font-weight:bold;color:green;">
            Total - ₹${Number(walletAmt).toLocaleString("en-IN")}
        </div>`;

        contentEl.innerHTML = html;
    } catch (err) {
        contentEl.innerHTML = `<div class="text-danger small">Error loading ledger</div>`;
    }
}

// Retrieve customer from users collection and populate wallet balance
export async function updateCustomerWalletDisplay() {
    const custNo = document.getElementById("utilize-customer-select").value;
    const walletEl = document.getElementById("utilize-wallet-balance");
    if (!walletEl || !custNo) {
        if (walletEl) walletEl.value = "₹0";
        return;
    }

    try {
        const custQ = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("userNo", "==", custNo),
            where("role", "==", "CUSTOMER"));
        const custSnap = await getDocs(custQ);
        if (!custSnap.empty) {
            const walletAmt = custSnap.docs[0].data().walletAmt || 0;
            walletEl.value = `₹${Number(walletAmt).toLocaleString("en-IN")}`;
        } else {
            walletEl.value = "₹0";
        }
    } catch {
        walletEl.value = "₹0";
    }
}

export async function updateCustomerAllottedPacksDropdown() {
    const custNo = document.getElementById("utilize-customer-select").value;
    const packEl = document.getElementById("utilize-pack-select");
    if (!packEl) return;

    packEl.innerHTML = `<option value="">Synchronizing package history charts...</option>`;
    if (!custNo) {
        packEl.innerHTML = `<option value="">-- Select Client Profile Above First --</option>`;
        return;
    }

    try {
        const q = query(collection(db, COL.CUST_PACKS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("customerNo", "==", custNo),
            where("packType",   "==", "Type3"),
            where("active",     "==", true));
        const snap = await getDocs(q);
        
        packEl.innerHTML = `<option value="">-- Choose Package --</option>`;
        snap.forEach(d => {
            const data = d.data();
            if (Number(data.remainingBalance || 0) > 0) {
                packEl.innerHTML += `<option value="${data.allotId}">${data.packName} | Allot ID: ${data.allotId} (Remaining Balance: ${data.remainingBalance})</option>`;
            }
        });
    } catch (err) { await handleTelemetryAlert("Dynamic Dropdown Sync Loop", err); }
}

// Point (a): decide ownerUserNo to use in where clauses for utilize form
export function _getUtilizeOwnerMatch() {
    return _ownerFilter(); // delegates to the canonical owner-filter function
}

// Load staff/manager/owner options for service-provider dropdown, sorted STAFF first then others by name
export async function _loadStaffOptions() {
    if (_utilizeStaffOptions !== null) return _utilizeStaffOptions; // use cache
    const ownerMatch = _getUtilizeOwnerMatch();
    if (!ownerMatch) return [];
    try {
        const q = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", ownerMatch),
            where("role", "in", ["OWNER", "MANAGER", "STAFF"]));
        const snap = await getDocs(q);
        const staff = [], others = [];
        snap.forEach(d => {
            const u = d.data();
            const entry = { userNo: u.userNo, role: u.role, name: u.name };
            if (u.role === "STAFF") staff.push(entry);
            else others.push(entry);
        });
        staff.sort((a, b) => a.name.localeCompare(b.name));
        others.sort((a, b) => a.name.localeCompare(b.name));
        setUtilizeStaffOptions([...staff, ...others]);
    } catch { setUtilizeStaffOptions([]); }
    return _utilizeStaffOptions;
}

// Build the staff dropdown HTML string for a given subServiceCode
export function _buildStaffDropdownHtml(subServiceCode) {
    const opts = (_utilizeStaffOptions || []).map(u =>
        `<option value="${u.userNo}" data-role="${u.role}">${u.name} (${u.role})</option>`
    ).join("");
    return `<select class="form-select form-select-sm ms-2 staff-provider-select" style="width:auto;min-width:150px;display:inline-block;" data-for-service="${subServiceCode}">
                <option value="">-- Assign Staff --</option>${opts}
            </select>`;
}

// Attach checkbox → show/hide staff dropdown handler
export function _attachStaffDropdownHandler(chk) {
    chk.addEventListener("change", () => {
        const wrapper = chk.closest(".form-check");
        if (!wrapper) return;
        const existingSel = wrapper.querySelector(".staff-provider-select");
        if (chk.checked) {
            if (!existingSel) {
                wrapper.insertAdjacentHTML("beforeend", _buildStaffDropdownHtml(chk.value));
            }
        } else {
            if (existingSel) existingSel.remove();
        }
        updateUtilizeServicesTotal();
    });
}

export async function renderUtilizeSubServicesCheckboxes() {
    const allotId = document.getElementById("utilize-pack-select").value;
    const container = document.getElementById("container-utilize-subservices");
    const financialEl = document.getElementById("utilize-pack-financial");
    const totalEl = document.getElementById("utilize-services-total");
    const newUnpaidEl = document.getElementById("utilize-new-unpaid-display");
    const addlAmtEl = document.getElementById("utilize-addl-amt-received");
    if (!container) return;

    const utilizeSrchBox = document.getElementById("utilize-subservices-search");
    if (utilizeSrchBox) utilizeSrchBox.value = "";

    container.innerHTML = "";
    if (financialEl) financialEl.style.display = "none";
    if (totalEl) { totalEl.style.display = "none"; totalEl.textContent = ""; }
    if (newUnpaidEl) newUnpaidEl.textContent = "";
    if (addlAmtEl) addlAmtEl.value = "0";
    setUtilizePrevUnpaidBalance(0);
    if (!allotId) return;

    // Pre-load staff options (cached after first load)
    await _loadStaffOptions();

    try {
        const q = query(collection(db, COL.CUST_PACKS), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("allotId", "==", allotId));
        const res = await getDocs(q);
        if (res.empty) return;
        const pData = res.docs[0].data();

        const soldPrice   = pData.soldPrice   !== undefined ? Number(pData.soldPrice)   : null;
        const totalAmount = pData.totalAmount  !== undefined ? Number(pData.totalAmount) : null;
        const remainingBalance = Number(pData.remainingBalance);
        const rawAmtReceived = pData.amountReceived !== undefined ? Number(pData.amountReceived) : 0;

        // 2b: amtReceived = amountReceived in pack + sum of all addlAmtReceived in logs
        const customerNo = document.getElementById("utilize-customer-select").value;
        const logsQ = query(collection(db, COL.VISIT_LOGS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("allotId",     "==", allotId),
            where("customerNo",  "==", customerNo));
        const logsSnap = await getDocs(logsQ);
        let sumAddlPaid = 0;
        logsSnap.forEach(d => { sumAddlPaid += Number(d.data().addlAmtReceived || 0); });
        const amtReceived = rawAmtReceived + sumAddlPaid;

        // 2c: unpaidBalance = soldPrice - amtReceived (unpaid is against the price the pack was sold at)
        const unpaidBalance = Math.max(0, (soldPrice !== null ? soldPrice : 0) - amtReceived);
        setUtilizePrevUnpaidBalance(unpaidBalance);

        // (c) Discount % from (totalAmount - soldPrice)*100/totalAmount
        let discountPct = 0;
        if (totalAmount && totalAmount > 0 && soldPrice !== null) {
            discountPct = ((totalAmount - soldPrice) * 100) / totalAmount;
            if (discountPct < 0) discountPct = 0; // no negative discount shown
        }

        const today = new Date().toISOString().slice(0, 10);
        const isExhausted = remainingBalance <= 0;
        const isExpired   = pData.expiryDate && pData.expiryDate !== null && pData.expiryDate < today;
        if (isExhausted || isExpired) {
            let reason = [];
            if (isExhausted) reason.push(`remaining balance is ₹${remainingBalance} (exhausted)`);
            if (isExpired)   reason.push(`package expired on ${pData.expiryDate}`);
            alert(`⚠️ Package Exhausted/Expired: ${reason.join(" and ")}.`);
        }

        // (b) Financial summary — totalAmount + renamed remainingBalance caption + (c) discount %
        if (financialEl) {
            const detailsEl = document.getElementById("utilize-pack-financial-details");
            if (detailsEl) {
                const unpaidClass = unpaidBalance > 0 ? "text-danger" : "text-success";
                const discBadge = discountPct > 0
                    ? `<span class="badge bg-success ms-1">${discountPct.toFixed(1)}% discount</span>`
                    : `<span class="badge bg-secondary ms-1">No discount</span>`;
                detailsEl.innerHTML = `
                    <div class="row g-2">
                        <div class="col-6"><span class="text-muted">Total Services Amount (₹):</span> <strong>${totalAmount !== null ? "₹" + totalAmount.toLocaleString("en-IN") : "N/A"}</strong></div>
                        <div class="col-6"><span class="text-muted">Selling Price (₹):</span> <strong>${soldPrice !== null ? "₹" + soldPrice.toLocaleString("en-IN") : "N/A"} ${discBadge}</strong></div>
                        <div class="col-6"><span class="text-muted">Amount Received Before This Visit (₹):</span> <strong>₹${amtReceived.toLocaleString("en-IN")}</strong></div>
                        <div class="col-6"><span class="text-muted">Unpaid Balance Before This Visit (₹):</span> <strong class="${unpaidClass}">₹${unpaidBalance.toLocaleString("en-IN")}</strong></div>
                        <div class="col-12"><span class="text-muted">Services of Amount yet to be availed (₹):</span> <strong class="text-primary">₹${remainingBalance.toLocaleString("en-IN")}</strong></div>
                    </div>`;
            }
            financialEl.style.display = "block";
        }

        // (c) Show/hide addl-amt field based on unpaid balance
        const addlAmtWrapper = document.getElementById("utilize-addl-amt-wrapper");
        if (addlAmtWrapper) addlAmtWrapper.style.display = unpaidBalance > 0 ? "" : "none";

        updateUtilizeNewUnpaidDisplay();

        const isType3 = pData.packType === "Type3";

        // Build lookup maps from cache — ONE fetch covers all sub-service reads below
        const srvNameMap = new Map();
        const srvForNameSnap = await _getCachedServices();
        srvForNameSnap.forEach(d => { const s = d.data(); srvNameMap.set(s.serviceCode, s.serviceName); });

        const subMap = new Map();
        const allSubsSnap = await _getCachedSubServices();
        allSubsSnap.forEach(d => { const s = d.data(); subMap.set(s.subServiceCode, s); });

        if (isType3) {
            // Type3: show ALL active subServices except excluded ones
            const excludedCodes = new Set(pData.subServicesArray || []);
            let anyRendered = false;
            subMap.forEach((ss) => {
                if (!ss.active) return;
                if (excludedCodes.has(ss.subServiceCode)) return;
                const origRate = Number(ss.rate);
                const parentServiceName = srvNameMap.get(ss.serviceCode) || "";
                const displayName = parentServiceName ? `${ss.subServiceName} (${parentServiceName})` : ss.subServiceName;
                container.innerHTML += `
                    <div class="form-check">
                        <input class="form-check-input chk-utilize-subservice" type="checkbox" value="${ss.subServiceCode}" data-rate="${origRate}" id="chk-ut-${ss.subServiceCode}">
                        <label class="form-check-label small" for="chk-ut-${ss.subServiceCode}">
                            ${displayName} — <span class="text-success fw-bold">₹${origRate.toLocaleString("en-IN")}</span>
                        </label>
                    </div>`;
                anyRendered = true;
            });
            if (!anyRendered) {
                container.innerHTML = `<span class="text-muted small">All service items are available for this package.</span>`;
            }
        } else {
            // Type1 / Type2: show only items in subServicesArray
            if (!pData.subServicesArray || pData.subServicesArray.length === 0) {
                container.innerHTML = `<span class="text-muted small">This package tier allows choice across all salon items without any explicit service restrictions rules.</span>`;
                container.querySelectorAll(".chk-utilize-subservice").forEach(chk => _attachStaffDropdownHandler(chk));
                if (totalEl) totalEl.style.display = "block";
                return;
            }

            const applyDiscount = (rate) => {
                const discounted = rate * (1 - discountPct / 100);
                if (discounted < 1000) return Math.round(discounted / 10) * 10;
                return Math.round(discounted / 100) * 100;
            };

            for (const code of pData.subServicesArray) {
                const ss = subMap.get(code);
                if (ss) {
                    const origRate       = Number(ss.rate);
                    const discountedRate = applyDiscount(origRate);
                    const parentServiceName = srvNameMap.get(ss.serviceCode) || "";
                    const displayName = parentServiceName ? `${ss.subServiceName} (${parentServiceName})` : ss.subServiceName;
                    const priceLabel = discountPct > 0
                        ? `<span class="text-decoration-line-through text-muted me-1">₹${origRate.toLocaleString("en-IN")}</span><span class="text-success fw-bold">₹${discountedRate.toLocaleString("en-IN")}</span>`
                        : `<span class="fw-bold">₹${origRate.toLocaleString("en-IN")}</span>`;
                    container.innerHTML += `
                        <div class="form-check">
                            <input class="form-check-input chk-utilize-subservice" type="checkbox" value="${ss.subServiceCode}" data-rate="${discountedRate}" id="chk-ut-${ss.subServiceCode}">
                            <label class="form-check-label small" for="chk-ut-${ss.subServiceCode}">
                                ${displayName} — ${priceLabel}
                            </label>
                        </div>`;
                }
            }
        }

        container.querySelectorAll(".chk-utilize-subservice").forEach(chk => {
            _attachStaffDropdownHandler(chk);
        });
        if (totalEl) totalEl.style.display = "block";

        // Load visit history for this package + customer (pass pData to skip Firestore re-read)
        await renderVisitHistory(allotId, customerNo, pData);

    } catch (err) { await handleTelemetryAlert("Dynamic Subservice Checker Interface", err); }
}

export async function renderVisitHistory(allotId, customerNo, packData = null) {
    // packData — optional: if the caller already has the customerServicePacks record in memory,
    // pass it here to skip the Firestore read for the Initial Payment row.
    const panel  = document.getElementById("utilize-visit-history");
    const tbody  = document.getElementById("tbl-utilize-visit-history");
    if (!panel || !tbody) return;

    panel.style.display = "none";
    tbody.innerHTML = "";
    if (!allotId || !customerNo) return;

    try {
        const logsQ = query(collection(db, COL.VISIT_LOGS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("allotId",     "==", allotId),
            where("customerNo",  "==", customerNo));
        const logsSnap = await getDocs(logsQ);
        if (logsSnap.empty) return;

        // Build subServiceCode → name map from cache (avoids N individual Firestore reads)
        const allCodes = new Set();
        logsSnap.forEach(d => (d.data().itemsRendered || []).forEach(c => allCodes.add(c)));

        const nameMap = {};
        const _subCacheSnap = await _getCachedSubServices();
        _subCacheSnap.forEach(d => {
            const s = d.data();
            if (allCodes.has(s.subServiceCode)) nameMap[s.subServiceCode] = s.subServiceName;
        });
        // Fallback: any code not found in cache gets its code as display name
        allCodes.forEach(code => { if (!nameMap[code]) nameMap[code] = code; });

        // Sort logs by visitDate descending
        const logs = logsSnap.docs.map(d => d.data()).sort((a, b) => b.visitDate.localeCompare(a.visitDate));

        // Populate customer name in header (appears only once)
        const custNameEl = document.getElementById("utilize-visit-history-customer");
        if (custNameEl && logs.length > 0) {
            custNameEl.textContent = logs[0].customerName || "—";
        }

        logs.forEach(log => {
            const serviceNames = (log.itemsRendered || []).map(c => nameMap[c] || c).join(", ") || "—";
            const totalAmt     = Number(log.calculatedValueCost || 0).toLocaleString("en-IN");
            const amtReceived  = Number(log.addlAmtReceived     || 0).toLocaleString("en-IN");
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="text-nowrap">${log.visitDate || "—"}</td>
                <td>${serviceNames}</td>
                <td class="text-end">₹${totalAmt}</td>
                <td class="text-end">₹${amtReceived}</td>`;
            tbody.appendChild(tr);
        });

        // Initial Payment row — use packData if provided, else fetch from Firestore
        try {
            let pData = packData;
            if (!pData) {
                // Fallback: fetch if caller did not provide pack data
                const packSnap = await getDocs(query(
                    collection(db, COL.CUST_PACKS),
                    where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                    where("allotId",     "==", allotId),
                    where("customerNo",  "==", customerNo)
                ));
                if (!packSnap.empty) pData = packSnap.docs[0].data();
            }
            if (pData) {
                let createdAtStr = "—";
                if (pData.createdAt) {
                    const d = pData.createdAt.toDate ? pData.createdAt.toDate() : new Date(pData.createdAt);
                    createdAtStr = d.toISOString().substring(0, 10);
                }
                const initAmtReceived = Number(pData.amountReceived || 0).toLocaleString("en-IN");
                const trInit = document.createElement("tr");
                trInit.className = "table-success";
                trInit.innerHTML = `
                    <td class="text-nowrap">${createdAtStr}</td>
                    <td class="text-nowrap">${pData.customerName || "—"}</td>
                    <td><em>Initial Payment</em></td>
                    <td class="text-end">—</td>
                    <td class="text-end">₹${initAmtReceived}</td>`;
                tbody.appendChild(trInit);
            }
        } catch (e) { console.warn("Could not render Initial Payment row:", e); }

        panel.style.display = "block";
    } catch (err) { handleTelemetryAlert("Visit History Load", err); }
}

export function updateUtilizeNewUnpaidDisplay() {
    const addlAmtEl = document.getElementById("utilize-addl-amt-received");
    const newUnpaidEl = document.getElementById("utilize-new-unpaid-display");
    if (!newUnpaidEl) return;
    const addl = parseFloat(addlAmtEl ? addlAmtEl.value : "") || 0;
    const newUnpaid = utilizePrevUnpaidBalance - addl;
    if (utilizePrevUnpaidBalance === 0 && addl === 0) {
        newUnpaidEl.textContent = "";
        return;
    }
    if (newUnpaid > 0) {
        newUnpaidEl.textContent = `₹${newUnpaid.toLocaleString("en-IN")} still unpaid`;
        newUnpaidEl.className = "fw-bold small text-nowrap text-danger";
    } else if (newUnpaid < 0) {
        newUnpaidEl.textContent = `₹${Math.abs(newUnpaid).toLocaleString("en-IN")} overpaid`;
        newUnpaidEl.className = "fw-bold small text-nowrap text-warning";
    } else {
        newUnpaidEl.textContent = "Fully paid ✓";
        newUnpaidEl.className = "fw-bold small text-nowrap text-success";
    }
}

export function updateUtilizeServicesTotal() {
    const totalEl = document.getElementById("utilize-services-total");
    if (!totalEl) return;
    const checked = document.querySelectorAll(".chk-utilize-subservice:checked");
    if (checked.length === 0) {
        totalEl.textContent = "Selected services total: ₹0";
        return;
    }
    let total = 0;
    checked.forEach(chk => { total += Number(chk.getAttribute("data-rate")) || 0; });
    totalEl.textContent = `Selected services total: ₹${total.toLocaleString("en-IN")} (${checked.length} item${checked.length === 1 ? "" : "s"})`;
}

// =========================================================================
// Old Visit Modification Helpers
// =========================================================================

export function resetOldVisitUI() {
    setOldVisitLogDocRef(null);
    setOldVisitPrevCalcCost(0);
    setOldVisitPrevAddlAmt(0);

    const wrapper = document.getElementById("utilize-old-visit-wrapper");
    if (wrapper) wrapper.style.display = "none";

    const dateSelect = document.getElementById("utilize-old-visit-date-select");
    if (dateSelect) { dateSelect.innerHTML = `<option value="">-- Select a Previous Visit Date --</option>`; }

    // Show Save, hide Delete
    const saveBtn = document.getElementById("btn-utilize-submit");
    const delBtn  = document.getElementById("btn-utilize-delete");
    if (saveBtn) saveBtn.classList.remove("d-none");
    if (delBtn)  delBtn.classList.add("d-none");

    // Re-enable all form fields
    ["utilize-visit-date","utilize-addl-amt-received"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.removeAttribute("readonly");
    });

    // Clear checkboxes
    document.querySelectorAll(".chk-utilize-subservice").forEach(cb => {
        cb.disabled = false;
        cb.checked  = false;
    });
}

export async function populateOldVisitDates() {
    const custNo  = document.getElementById("utilize-customer-select").value;
    const allotId = document.getElementById("utilize-pack-select").value;
    const wrapper = document.getElementById("utilize-old-visit-wrapper");
    const dateSelect = document.getElementById("utilize-old-visit-date-select");

    if (!custNo || !allotId || !activeSessionUser) {
        alert("Please select a Customer and a Package first before choosing Old Visit.");
        document.getElementById("utilize-visit-new").checked = true;
        return;
    }

    if (wrapper) wrapper.style.display = "block";

    const ownerNo = _ownerFilter();

    try {
        const logsQ = query(collection(db, COL.VISIT_LOGS),
            where("ownerUserNo", "==", ownerNo),
            where("allotId",     "==", allotId),
            where("customerNo",  "==", custNo));
        const logsSnap = await getDocs(logsQ);

        dateSelect.innerHTML = `<option value="">-- Select a Previous Visit Date --</option>`;
        const logs = [];
        // Store docId separately — DocumentReference cannot survive JSON.stringify/parse
        logsSnap.forEach(d => logs.push({ docId: d.id, ...d.data() }));
        logs.sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || ""));

        if (logs.length === 0) {
            dateSelect.innerHTML = `<option value="">No previous visits found</option>`;
            return;
        }
        logs.forEach(log => {
            const opt = document.createElement("option");
            opt.value = log.docId;
            opt.textContent = `${log.visitDate} — ${(log.itemsRendered || []).length} service(s), Addl Amt: ₹${log.addlAmtReceived || 0}`;
            opt.dataset.logData = JSON.stringify(log); // ref is now absent — use docId to reconstruct
            dateSelect.appendChild(opt);
        });
    } catch(err) { await handleTelemetryAlert("Old Visit Date Population", err); }
}

export async function prefillOldVisitData() {
    const dateSelect = document.getElementById("utilize-old-visit-date-select");
    const selectedOpt = dateSelect.options[dateSelect.selectedIndex];
    if (!selectedOpt || !selectedOpt.dataset.logData) return;

    let log;
    try { log = JSON.parse(selectedOpt.dataset.logData); }
    catch { return; }

    // Reconstruct DocumentReference from docId — ref cannot survive JSON serialisation
    const ownerNo = _ownerFilter();
    const logRef = doc(db, COL.VISIT_LOGS, log.docId || selectedOpt.value);
    setOldVisitLogDocRef(logRef);
    setOldVisitPrevCalcCost(Number(log.calculatedValueCost || 0));
    setOldVisitPrevAddlAmt(Number(log.addlAmtReceived     || 0));

    // Pre-fill visit date
    const visitDateEl = document.getElementById("utilize-visit-date");
    if (visitDateEl) visitDateEl.value = log.visitDate || "";

    // [c] Pre-fill addlAmtReceived — enable and show value only if non-zero
    const addlEl = document.getElementById("utilize-addl-amt-received");
    const addlVal = Number(log.addlAmtReceived || 0);
    if (addlEl) {
        if (addlVal !== 0) {
            addlEl.value = addlVal;
            addlEl.removeAttribute("disabled");
            addlEl.style.display = "";
        } else {
            addlEl.value = "";
        }
    }

    // [c] Show "Selected services total" after pre-checking services
    // (called below after pre-checking checkboxes, so we schedule via setTimeout)
    setTimeout(() => {
        updateUtilizeServicesTotal();
        const totalEl = document.getElementById("utilize-services-total");
        if (totalEl) totalEl.style.display = "block";
    }, 0);

    // [c] Change Reset button label to "Cancel" when modifying an old visit
    const resetBtn = document.getElementById("btn-reset-utilize");
    if (resetBtn) resetBtn.textContent = "Cancel";

    // Pre-check services from itemsRendered and restore staff dropdowns
    const prevItems    = log.itemsRendered    || [];
    const prevProviders = log.serviceProviders || []; // array of {userNo, role}
    document.querySelectorAll(".chk-utilize-subservice").forEach(cb => {
        cb.checked = prevItems.includes(cb.value);
        if (cb.checked) {
            const wrapper = cb.closest(".form-check");
            if (wrapper && !wrapper.querySelector(".staff-provider-select")) {
                wrapper.insertAdjacentHTML("beforeend", _buildStaffDropdownHtml(cb.value));
            }
            // Restore previous provider selection
            const idx = prevItems.indexOf(cb.value);
            const provider = idx >= 0 ? prevProviders[idx] : null;
            if (provider) {
                const sel = wrapper?.querySelector(".staff-provider-select");
                if (sel) sel.value = provider.userNo || "";
            }
        }
    });

    // Show Delete button alongside Save
    const delBtn = document.getElementById("btn-utilize-delete");
    if (delBtn) delBtn.classList.remove("d-none");
}

export async function deleteOldVisitRecord() {
    if (!_oldVisitLogDocRef) return alert("Please select a previous visit date first.");
    // Capture to local const — Firestore type checks reject ES module live bindings directly
    const logDocRef = _oldVisitLogDocRef;

    if (!confirm("⚠️ Delete this visit record? The package balance will be restored. This cannot be undone.")) return;

    try {
        const custNo  = document.getElementById("utilize-customer-select").value;
        const allotId = document.getElementById("utilize-pack-select").value;

        // Get the log data to reverse
        const logSnap = await getDoc(logDocRef);
        if (!logSnap.exists()) return alert("Error: Visit record not found.");
        const logData = logSnap.data();

        // Restore balance in customerServicePacks
        const packQ = query(collection(db, COL.CUST_PACKS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("allotId",     "==", allotId));
        const packSnap = await getDocs(packQ);
        if (packSnap.empty) return alert("Error: Package record not found.");

        const packRef  = packSnap.docs[0].ref;
        const pData    = packSnap.docs[0].data();

        const restoredBalance = Number(pData.remainingBalance) +
            (pData.packType === "Type1"
                ? Number(logData.unitsSubtracted || 0)
                : Number(logData.calculatedValueCost || 0));

        const restoredUnpaid = Math.max(0,
            Number(pData.unpaidBalance || 0) - Number(logData.addlAmtReceived || 0));

        await updateDoc(packRef, {
            remainingBalance: restoredBalance,
            unpaidBalance:    restoredUnpaid,
            lastVisitDate:    null   // will be recalculated on next visit
        });

        // Delete the log document
        await deleteDoc(logDocRef);

        // Recalculate lastVisitDate from remaining logs
        const remainingLogsQ = query(collection(db, COL.VISIT_LOGS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("allotId",     "==", allotId));
        const remainingLogsSnap = await getDocs(remainingLogsQ);
        let newLastVisitDate = null;
        remainingLogsSnap.forEach(d => {
            const vd = d.data().visitDate || null;
            if (vd && (!newLastVisitDate || vd > newLastVisitDate)) newLastVisitDate = vd;
        });
        await updateDoc(packRef, { lastVisitDate: newLastVisitDate });

        alert("✅ Visit record deleted and package balance restored.");

        // [2a] Full UI reset to blank after delete
        resetOldVisitUI();
        document.getElementById("utilize-visit-new").checked = true;

        // Clear the service checkboxes container
        const container = document.getElementById("container-utilize-subservices");
        if (container) container.innerHTML = "";

        // Clear additional amount and reset visit date to today
        const addlEl = document.getElementById("utilize-addl-amt-received");
        if (addlEl) { addlEl.value = ""; addlEl.removeAttribute("disabled"); }
        const vdEl = document.getElementById("utilize-visit-date");
        if (vdEl) vdEl.value = new Date().toISOString().split("T")[0];

        // Hide services total display
        const totalEl = document.getElementById("utilize-services-total");
        if (totalEl) totalEl.style.display = "none";

        // Restore Reset button caption
        const resetBtn = document.getElementById("btn-reset-utilize");
        if (resetBtn) resetBtn.textContent = "Reset";

        await renderVisitHistory(allotId, custNo, pData);

    } catch(err) { await handleTelemetryAlert("Old Visit Delete", err); }
}

// Collect service providers in same order as itemsRendered
export function _collectServiceProviders(checkedInputs) {
    const providers = [];
    checkedInputs.forEach(input => {
        const wrapper = input.closest(".form-check");
        const sel = wrapper?.querySelector(".staff-provider-select");
        if (sel && sel.value) {
            const selOpt = sel.options[sel.selectedIndex];
            providers.push({
                userNo: sel.value,
                role: selOpt?.dataset?.role || ""
            });
        } else {
            providers.push({ userNo: "", role: "" });
        }
    });
    return providers;
}

export async function processVisitDeductionFormSubmission(e) {
    e.preventDefault();

    const isOldVisit = document.getElementById("utilize-visit-old")?.checked;

    // === OLD VISIT: update existing log ===
    if (isOldVisit) {
        if (!_oldVisitLogDocRef) return alert("Please select a previous visit date to modify.");
        // Capture to local const — Firestore type checks reject ES module live bindings directly
        const logDocRef = _oldVisitLogDocRef;

        const custNo  = document.getElementById("utilize-customer-select").value;
        const allotId = document.getElementById("utilize-pack-select").value;
        const visitDate = document.getElementById("utilize-visit-date").value;
        const newAddlAmt = parseFloat(document.getElementById("utilize-addl-amt-received")?.value) || 0;

        const checkedInputs = document.querySelectorAll(".chk-utilize-subservice:checked");
        let newCalcCost = 0;
        const newItemCodes = [];
        checkedInputs.forEach(input => {
            newCalcCost += Number(input.getAttribute("data-rate"));
            newItemCodes.push(input.value);
        });

        if (checkedInputs.length === 0 && newAddlAmt === 0)
            return alert("Validation: Please select at least one service or enter an additional amount.");

        try {
            // Get pack for packType
            const packQ = query(collection(db, COL.CUST_PACKS),
                where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                where("allotId",     "==", allotId));
            const packSnap = await getDocs(packQ);
            if (packSnap.empty) return alert("Error: Package record not found.");
            const packRef = packSnap.docs[0].ref;
            const pData   = packSnap.docs[0].data();

            // Reverse old deduction, apply new deduction
            const oldDeduction = pData.packType === "Type1"
                ? Number(document.getElementById("utilize-old-visit-date-select")
                    .options[document.getElementById("utilize-old-visit-date-select").selectedIndex]
                    .dataset.logData ? JSON.parse(document.getElementById("utilize-old-visit-date-select")
                    .options[document.getElementById("utilize-old-visit-date-select").selectedIndex]
                    .dataset.logData).unitsSubtracted || 0 : 0)
                : _oldVisitPrevCalcCost;
            const newDeduction = pData.packType === "Type1" ? checkedInputs.length : newCalcCost;

            const balanceDiff  = oldDeduction - newDeduction; // positive = balance restored
            const addlAmtDiff  = newAddlAmt - _oldVisitPrevAddlAmt;
            const newBalance   = Number(pData.remainingBalance) + balanceDiff;
            const newUnpaid    = Math.max(0, Number(pData.unpaidBalance || 0) - addlAmtDiff);

            await updateDoc(packRef, { remainingBalance: newBalance, unpaidBalance: newUnpaid, lastVisitDate: visitDate });

            // Update customer walletAmt (same deduction/restoration as remainingBalance)
            const custQ = query(collection(db, COL.USERS),
                where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                where("userNo", "==", custNo),
                where("role", "==", "CUSTOMER"));
            const custSnap = await getDocs(custQ);
            if (!custSnap.empty) {
                const currentWallet = custSnap.docs[0].data().walletAmt || 0;
                const newWallet = currentWallet + balanceDiff;
                await updateDoc(custSnap.docs[0].ref, { walletAmt: newWallet });
            }

            // Update the log document — replace all modifiable fields
            await updateDoc(logDocRef, {
                itemsRendered:       newItemCodes,
                serviceProviders:    _collectServiceProviders(checkedInputs),
                visitDate:           visitDate,
                calculatedValueCost: newCalcCost,
                addlAmtReceived:     newAddlAmt,
            });

            alert(`✅ Visit record updated. New Package Balance: ${newBalance}`);
            resetOldVisitUI();
            document.getElementById("utilize-visit-new").checked = true;
            await renderVisitHistory(allotId, custNo, pData);
            document.getElementById("frm-utilize-service-visit").reset();
            const _uSrch = document.getElementById("utilize-customer-search");
            if (_uSrch) { _uSrch.value = ""; _uSrch.dispatchEvent(new Event("input")); }
            document.getElementById("container-utilize-subservices").innerHTML = "";

        } catch(err) { await handleTelemetryAlert("Old Visit Modification", err); }
        return;
    }

    // === NEW VISIT (original logic below, unchanged) ===
    const custNo = document.getElementById("utilize-customer-select").value;
    const allotId = document.getElementById("utilize-pack-select").value;
    const visitDate = document.getElementById("utilize-visit-date").value;
    const addlAmtReceived = parseFloat(document.getElementById("utilize-addl-amt-received") ? document.getElementById("utilize-addl-amt-received").value : "") || 0;

    const checkedInputs = document.querySelectorAll(".chk-utilize-subservice:checked");
    // (d) Either addl amount received > 0 OR at least one service selected (or both)
    const addlPositive = addlAmtReceived > 0;
    const anyChecked   = checkedInputs.length > 0;
    if (!addlPositive && !anyChecked)
        return alert("Validation: Please either enter an additional amount received, or select at least one service item availed during this visit (or both).");

    try {
        const q = query(collection(db, COL.CUST_PACKS), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("allotId", "==", allotId)); 
        const res = await getDocs(q);
        if (res.empty) return alert("Error: The chosen package file references could not be verified.");
        
        const docRef = res.docs[0].ref;
        const pData = res.docs[0].data();

        // Rule Validation: Date Conflict checking framework rules
        if (pData.startDate && visitDate < pData.startDate) {
            return alert("Date Violation: Today's visit date occurs before the package package was actually activated.");
        }
        if (pData.expiryDate && visitDate > pData.expiryDate) {
            return alert("Date Violation: Today's visit occurs after this customer contract balance has officially expired.");
        }

        let totalSubServicesValueCost = 0;
        let renderedItemCodeTrackers = [];

        checkedInputs.forEach(input => {
            totalSubServicesValueCost += Number(input.getAttribute("data-rate"));
            renderedItemCodeTrackers.push(input.value);
        });

        let updatedBalance = Number(pData.remainingBalance);
        if (pData.packType === "Type1") {
            updatedBalance = updatedBalance - checkedInputs.length;
        } else {
            updatedBalance = updatedBalance - totalSubServicesValueCost;
        }

        if (updatedBalance < 0) {
            // Show red alert and prompt user to confirm override save
            const overrideMsg =
                `⛔ Transaction Declined: This package balance card does not have enough remaining capacity.\n` +
                `Balance Available: ${pData.remainingBalance}\n` +
                `Balance After This Visit: ${updatedBalance}\n\n` +
                `Do you still want to save this visit record (override)?`;
            const confirmed = window.confirm(overrideMsg);
            if (!confirmed) return;

            // User confirmed override — proceed to save, then email owner
            const ownerEmail = activeSessionUser.email || "bawa.codes@gmail.com";

            // Save the record first (fall through to rest of function),
            // flag for post-save owner email
            setUtilizeOverrideConfirmed(true);
            setUtilizeOverrideMeta({
                ownerEmail,
                custNo,
                allotId,
                packName: pData.packName,
                balanceBefore: pData.remainingBalance,
                balanceAfter: updatedBalance
            });
        } else {
            setUtilizeOverrideConfirmed(false);
            setUtilizeOverrideMeta(null);
        }

        // Query all prior logs for this allotId+customerNo to get true cumulative payments
        const priorLogsQ = query(collection(db, COL.VISIT_LOGS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("allotId",     "==", allotId),
            where("customerNo",  "==", custNo));
        const priorLogsSnap = await getDocs(priorLogsQ);
        let sumPriorAddlPaid = 0;
        priorLogsSnap.forEach(d => { sumPriorAddlPaid += Number(d.data().addlAmtReceived || 0); });

        // b: amtReceived = pData.amountReceived + sum of all prior addlAmtReceived in logs
        const initialAmtReceived = Number(pData.amountReceived !== undefined ? pData.amountReceived : 0);
        const trueAmtReceived    = initialAmtReceived + sumPriorAddlPaid + addlAmtReceived;

        // c: unpaidBalance = soldPrice - trueAmtReceived
        const packSoldPrice    = Number(pData.soldPrice !== undefined ? pData.soldPrice : 0);
        const newUnpaidBalance = Math.max(0, packSoldPrice - trueAmtReceived);

        const nowExhausted = updatedBalance <= 0;
        // a: Do NOT update amountReceived in customerServicePacks — it stays as initially recorded
        const exhaustionUpdate = { remainingBalance: updatedBalance, unpaidBalance: newUnpaidBalance, lastVisitDate: visitDate };
        if (nowExhausted) exhaustionUpdate.expiryDate = visitDate;
        await updateDoc(docRef, exhaustionUpdate);
        if (nowExhausted)
            alert(`⚠️ Package Fully Exhausted: "${pData.packName}" consumed. Expiry set to ${visitDate}.`);

        // Issue 1: sequential log ID — max existing serial for this owner + 1
        const allLogsQ = query(collection(db, COL.VISIT_LOGS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo));
        const allLogsSnap = await getDocs(allLogsQ);
        let maxLogSerial = 0;
        const logDocPattern = new RegExp(`^${activeSessionUser.ownerUserNo}_LOG_(\\d+)$`);
        allLogsSnap.forEach(d => {
            const m = d.id.match(logDocPattern);
            if (m) { const n = parseInt(m[1], 10); if (!isNaN(n) && n > maxLogSerial) maxLogSerial = n; }
        });
        const logSerial = maxLogSerial + 1;
        const logDocId  = `${activeSessionUser.ownerUserNo}_LOG_${logSerial}`;

        await setDoc(doc(db, COL.VISIT_LOGS, logDocId), {
            ownerUserNo: activeSessionUser.ownerUserNo, logId: logDocId,
            customerNo: custNo, allotId: allotId,
            packName: pData.packName, visitDate: visitDate,
            itemsRendered: renderedItemCodeTrackers,
            serviceProviders: _collectServiceProviders(checkedInputs),
            unitsSubtracted: checkedInputs.length, calculatedValueCost: totalSubServicesValueCost,
            addlAmtReceived: addlAmtReceived, loggedAt: new Date().toISOString()
        });

        // Update customer walletAmt (deducted by balanceDiff)
        const custQ = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("userNo", "==", custNo),
            where("role", "==", "CUSTOMER"));
        const custSnap = await getDocs(custQ);
        if (!custSnap.empty) {
            const currentWallet = custSnap.docs[0].data().walletAmt || 0;
            const walletDeduction = pData.packType === "Type1" ? checkedInputs.length : totalSubServicesValueCost;
            const newWallet = currentWallet - walletDeduction;
            await updateDoc(custSnap.docs[0].ref, { walletAmt: newWallet });
        }

        // Override-save: notify owner by email if user confirmed negative-balance save
        if (_utilizeOverrideConfirmed && _utilizeOverrideMeta) {
            const m = _utilizeOverrideMeta;
            try {
                await emailjs.send('service_050166', 'template_050166', {
                    to_email: m.ownerEmail,
                    subject: "⛔ OVERRIDE ALERT — Visit Saved with Negative Package Balance",
                    body: `Override Save Notification:\n\nA visit record has been saved despite insufficient package balance.\n\nCustomer ID: ${m.custNo}\nAllotment ID: ${m.allotId}\nPackage Name: ${m.packName}\nBalance Before Visit: ${m.balanceBefore}\nBalance After Visit: ${m.balanceAfter}\n\nPlease review this account at the earliest.`
                });
            } catch (_emailErr) { /* silent — do not block UI if email fails */ }
            setUtilizeOverrideConfirmed(false);
            setUtilizeOverrideMeta(null);
        }

        // Rule Validation: 20% Low-Balance Warning alerts dispatch pipeline via EmailJS 
        const warningThreshold = Number(pData.totalAmount) * 0.20;
        if (updatedBalance < warningThreshold) {
            alert("Low Balance Warning: This client's package balance has fallen below 20%. The salon owner has been notified via email reminder rules.");
            await emailjs.send('service_050166', 'template_050166', {
                to_email: 'bawa.codes@gmail.com',
                subject: "FOLLOWUP REMINDER ALERT - Low Capacity Package Detected",
                body: `Low Balance Notice:\nCustomer ID Reference: ${custNo}\nAllotment Account: ${allotId}\nRemaining Balance Capacity: ${updatedBalance}`
            });
        } else {
            alert(`Visit logged successfully. Remaining Account Balance: ${updatedBalance}`);
        }

        // Refresh visit history in place (before resetting the form)
        await renderVisitHistory(allotId, custNo, pData);

        document.getElementById("frm-utilize-service-visit").reset();
        const _uSrch = document.getElementById("utilize-customer-search");
        if (_uSrch) { _uSrch.value = ""; _uSrch.dispatchEvent(new Event("input")); }
        document.getElementById("container-utilize-subservices").innerHTML = "";
        setUtilizePrevUnpaidBalance(0);
        const financialEl = document.getElementById("utilize-pack-financial");
        if (financialEl) financialEl.style.display = "none";
        const totalEl = document.getElementById("utilize-services-total");
        if (totalEl) { totalEl.style.display = "none"; totalEl.textContent = ""; }
        const newUnpaidEl = document.getElementById("utilize-new-unpaid-display");
        if (newUnpaidEl) newUnpaidEl.textContent = "";
        const addlEl = document.getElementById("utilize-addl-amt-received");
        if (addlEl) addlEl.value = "0";
    } catch (err) { await handleTelemetryAlert("Service Visit Transaction Node", err); }
}

// =========================================================================
// Real-Time UI Presenter Tables
// =========================================================================
// ── Targeted refresh helpers ───────────────────────────────────────────────
// Use these instead of the full refreshAllAdministrativeTables + loadWorkspaceDropdownMappings
// pair when only a specific collection has changed. Reduces Firestore reads
// from 8+ collections down to 1-2 per save operation.

