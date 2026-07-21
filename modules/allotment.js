// allotment.js — GlamTrack
import { db, COL, _getCachedServices, _getCachedSubServices, invalidateServicesCache, invalidateSubServicesCache, invalidateCatalogCache, activeSessionUser, setActiveSessionUser, salonOwnerNameContext, setSalonOwnerNameContext, realtimePacksUnsubscribe, setRealtimePacksUnsubscribe, sessionWatchdogTimer, setSessionWatchdogTimer, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, setAllotExistingPacks, _allotExistingIdx, setAllotExistingIdx, _postRegAllotMode, setPostRegAllotMode, _quickAddCustomerMode, setQuickAddCustomerMode, _utilizeStaffOptions, setUtilizeStaffOptions, utilizePrevUnpaidBalance, setUtilizePrevUnpaidBalance, _oldVisitPrevCalcCost, setOldVisitPrevCalcCost, _oldVisitPrevAddlAmt, setOldVisitPrevAddlAmt, _oldVisitLogDocRef, setOldVisitLogDocRef, INACTIVITY_TIMEOUT_MS } from "./state.js";
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
;
;

// Cross-module imports
import { handleTelemetryAlert } from "./auth.js";
import { closePostRegAllotModal } from "./customers.js";
;
;
;
;

export function resetAllotExistingPackUI() {
    setAllotExistingPacks([]);
    setAllotExistingIdx(0);

    // Re-enable pack-select
    const packSel = document.getElementById("allot-pack-select");
    if (packSel) packSel.removeAttribute("disabled");

    // (a) Restore allot-pack-search visibility
    const packSearch = document.getElementById("allot-pack-search");
    if (packSearch) packSearch.style.display = "";

    // (a) Remove the reason text element if it exists
    const reasonEl = document.getElementById("allot-pack-reason");
    if (reasonEl) reasonEl.remove();

    // Show Sell, hide Modify + Delete
    const sellBtn = document.getElementById("btn-allot-sell");
    const modBtn  = document.getElementById("btn-allot-modify");
    const delBtn  = document.getElementById("btn-allot-delete");
    if (sellBtn) { sellBtn.classList.remove("d-none"); sellBtn.disabled = false; }
    if (modBtn)  modBtn.classList.add("d-none");
    if (delBtn)  delBtn.classList.add("d-none");

    // Hide extra fields, alert, nav
    const extraEl = document.getElementById("allot-existing-extra-fields");
    if (extraEl) extraEl.style.display = "none";
    const alertEl = document.getElementById("allot-existing-alert");
    if (alertEl) {
        alertEl.style.display = "none";
    }
    const navEl = document.getElementById("allot-existing-nav");
    if (navEl) navEl.style.display = "none";
    ["btn-allot-prev","btn-allot-next","allot-existing-nav-label"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = "none"; if (el.tagName === "BUTTON") el.disabled = true; else el.textContent = ""; }
    });

    // Clear extra field values and restore their col visibility
    const opEl = document.getElementById("allot-original-price");
    if (opEl) {
        opEl.value = "";
        const opCol = opEl.closest(".col-md-4");
        if (opCol) opCol.style.display = "";
    }
    const rbEl = document.getElementById("allot-remaining-balance");
    if (rbEl) {
        rbEl.value = "";
        const rbCol = rbEl.closest(".col-md-4");
        if (rbCol) rbCol.style.display = "";
    }
    const ubEl = document.getElementById("allot-unpaid-balance-field");
    if (ubEl) {
        ubEl.value = "";
        const ubCol = ubEl.closest(".col-md-4");
        if (ubCol) ubCol.style.display = "";
    }
    const avEl = document.getElementById("allot-addl-amt-visits");
    if (avEl) { avEl.value = ""; const avCol = avEl.closest(".col-md-4"); if (avCol) avCol.style.display = ""; }

    // Clear pack preview
    const previewEl = document.getElementById("allot-pack-preview");
    if (previewEl) previewEl.style.display = "none";
    const discEl = document.getElementById("allot-sold-discount");
    if (discEl) discEl.textContent = "";
    const unpaidEl = document.getElementById("allot-unpaid-display");
    if (unpaidEl) unpaidEl.textContent = "";
    setAllotCurrentPackTotalAmount(0);
}

// Explicitly hides the three extra UI groups when no active package is found for the customer
export function hideAllotExtraUIElements() {
    // Hide the entire extra fields box (contains rows + payment history)
    const fieldsBox = document.getElementById("allot-extra-fields-box");
    if (fieldsBox) fieldsBox.style.display = "none";
    // Clear field values
    ["allot-original-price","allot-remaining-balance","allot-unpaid-balance-field","allot-addl-amt-visits"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ""; delete el.dataset.sumAddlAmt; }
    });
    // Hide allot-existing-nav and its contents
    const navEl = document.getElementById("allot-existing-nav");
    if (navEl) navEl.style.display = "none";
    ["btn-allot-prev","btn-allot-next","allot-existing-nav-label"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = "none"; if (el.tagName === "BUTTON") el.disabled = true; else el.textContent = ""; }
    });
}

export async function handleAllotCustomerSelectChange() {
    const custNo = document.getElementById("allot-customer-select").value;
    // Always reset existing-pack UI first (preserves customer selection)
    resetAllotExistingPackUI();
    // Also clear pack-related fields
    const packSel = document.getElementById("allot-pack-select");
    if (packSel) packSel.value = "";
    const startEl = document.getElementById("allot-start-date");
    if (startEl) startEl.value = "";
    const expiryEl = document.getElementById("allot-expiry-date");
    if (expiryEl) expiryEl.value = "";
    const soldEl = document.getElementById("allot-sold-price");
    if (soldEl) soldEl.value = "";
    const amtEl = document.getElementById("allot-amount-received");
    if (amtEl) amtEl.value = "";

    if (!custNo || !activeSessionUser) return;

    try {
        const today = new Date().toISOString().split("T")[0];
        const q = query(
            collection(db, COL.CUST_PACKS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("customerNo", "==", custNo),
            where("packType", "==", "Type3")
        );
        const snap = await getDocs(q);
        if (snap.empty) { hideAllotExtraUIElements(); return; }

        // Filter packs that are "in progress":
        // unpaidBalance > 0 OR
        // (expiryDate not null AND expiryDate >= today AND remainingBalance > 0) OR
        // (expiryDate is null AND remainingBalance > 0)
        const activePacks = [];
        for (const d of snap.docs) {
            const p = d.data();
            const unpaid = Number(p.unpaidBalance || 0);
            const remaining = Number(p.remainingBalance || 0);
            const expiry = p.expiryDate || null;

            const condition =
                unpaid > 0 ||
                (expiry !== null && expiry >= today && remaining > 0) ||
                (expiry === null && remaining > 0);

            if (condition) {
                // Compute total amountReceived: pack amountReceived + sum of addlAmtReceived in logs
                const logsQ = query(
                    collection(db, COL.VISIT_LOGS),
                    where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                    where("allotId", "==", p.allotId),
                    where("customerNo", "==", custNo)
                );
                const logsSnap = await getDocs(logsQ);
                let sumAddl = 0;
                logsSnap.forEach(ld => { sumAddl += Number(ld.data().addlAmtReceived || 0); });
                activePacks.push({ ...p, _totalAmtReceived: Number(p.amountReceived || 0) + sumAddl, _reason: buildAllotExistingReason(p, today) });
            }
        }

        if (activePacks.length === 0) { hideAllotExtraUIElements(); return; }

        // There are in-progress packages — block new allotment
        setAllotExistingPacks(activePacks);
        setAllotExistingIdx(0);
        showAllotExistingPackAtIndex(0);

    } catch (err) {
        await handleTelemetryAlert("Allot Customer Select Change", err);
    }
}

export function buildAllotExistingReason(p, today) {
    const reasons = [];
    const unpaid = Number(p.unpaidBalance || 0);
    const remaining = Number(p.remainingBalance || 0);
    const expiry = p.expiryDate || null;
    if (unpaid > 0) reasons.push(`Unpaid Balance: ₹${unpaid.toLocaleString("en-IN")}`);
    if (expiry !== null && expiry >= today && remaining > 0) reasons.push(`Package Not Expired (Expiry: ${expiry})`);
    if (expiry === null && remaining > 0) reasons.push(`No Expiry Set, Services Balance Remaining`);
    return reasons.join(" | ");
}

export function showAllotExistingPackAtIndex(idx) {
    const p = _allotExistingPacks[idx];
    if (!p) return;

    // Only pack-select is disabled (cannot change package); all price/date fields remain editable
    const packSel = document.getElementById("allot-pack-select");
    if (packSel) packSel.setAttribute("disabled", "true");

    // (a) Hide allot-pack-search when in existing-pack mode
    const packSearch = document.getElementById("allot-pack-search");
    if (packSearch) packSearch.style.display = "none";

    // Populate fields from existing pack
    if (packSel) {
        // Try to select the matching option
        let found = false;
        for (const opt of packSel.options) {
            if (opt.value === p.packName) { packSel.value = p.packName; found = true; break; }
        }
        if (!found) {
            // Add a temporary option
            const tempOpt = document.createElement("option");
            tempOpt.value = p.packName;
            tempOpt.textContent = p.packName;
            packSel.insertBefore(tempOpt, packSel.firstChild);
            packSel.value = p.packName;
        }
    }

    // (a) Inject reason text below allot-pack-select (create or reuse dedicated element)
    let reasonEl = document.getElementById("allot-pack-reason");
    if (!reasonEl) {
        reasonEl = document.createElement("div");
        reasonEl.id = "allot-pack-reason";
        reasonEl.className = "mt-1 small";
        // Insert it right after the allot-pack-select's parent col
        const packSelParent = packSel ? packSel.closest(".col-md-6") : null;
        if (packSelParent) packSelParent.appendChild(reasonEl);
    }
    if (reasonEl) {
        reasonEl.style.display = "block";
        reasonEl.innerHTML = `<span class="text-muted">Reason: </span><span class="text-dark">${p._reason}</span>`;
    }

    const soldEl = document.getElementById("allot-sold-price");
    if (soldEl) soldEl.value = p.soldPrice !== undefined ? p.soldPrice : "";

    // [1b-i] Populate amountReceived from customerServicePacks record (discard any prior UI value)
    const amtEl = document.getElementById("allot-amount-received");
    if (amtEl) amtEl.value = p.amountReceived !== undefined ? p.amountReceived : "";

    const startEl = document.getElementById("allot-start-date");
    if (startEl) startEl.value = p.startDate || "";
    const expiryEl = document.getElementById("allot-expiry-date");
    if (expiryEl) {
        expiryEl.value = p.expiryDate || "";
        expiryEl.removeAttribute("readonly");
    }

    // [1b-ii] Change Reset button caption to "Cancel" while in modify mode
    const resetBtn = document.getElementById("btn-reset-allot");
    if (resetBtn) resetBtn.textContent = "Cancel";

    // Show extra fields box (contains all rows + payment history)
    const fieldsBox = document.getElementById("allot-extra-fields-box");
    if (fieldsBox) fieldsBox.style.display = "";

    // Populate extra fields
    const opEl = document.getElementById("allot-original-price");
    if (opEl) opEl.value = p.totalAmount !== undefined ? `₹${Number(p.totalAmount).toLocaleString("en-IN")}` : "";
    const rbEl = document.getElementById("allot-remaining-balance");
    if (rbEl) rbEl.value = p.remainingBalance !== undefined ? p.remainingBalance : "";

    // Amt Recvd in Visits — populate from serviceUtilizationLogs
    const avEl = document.getElementById("allot-addl-amt-visits");
    if (avEl) {
        avEl.value = "Loading…";
        getDocs(query(collection(db, COL.VISIT_LOGS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("customerNo",  "==", p.customerNo),
            where("allotId",     "==", p.allotId)
        )).then(logsSnap => {
            let sum = 0;
            logsSnap.forEach(d => { sum += Number(d.data().addlAmtReceived || 0); });
            avEl.value = `₹${sum.toLocaleString("en-IN")}`;
            avEl.dataset.sumAddlAmt = sum;
        }).catch(() => { avEl.value = "—"; avEl.dataset.sumAddlAmt = 0; });
    }

    // Unpaid Balance
    const ubEl = document.getElementById("allot-unpaid-balance-field");
    if (ubEl) ubEl.value = p.unpaidBalance !== undefined ? `₹${Number(p.unpaidBalance).toLocaleString("en-IN")}` : "";

    // (b) Alert message: updated text — statically placed above Select Customer in HTML
    const alertEl = document.getElementById("allot-existing-alert");
    if (alertEl) {
        alertEl.style.display = "block";
        alertEl.innerHTML = `⚠️ <strong>Some Packages Already in Progress (Details below), Cannot allot another Package</strong>`;
    }

    // Nav buttons — shown only when more than one in-progress pack exists
    const navEl    = document.getElementById("allot-existing-nav");
    const navLabel = document.getElementById("allot-existing-nav-label");
    const prevBtn  = document.getElementById("btn-allot-prev");
    const nextBtn  = document.getElementById("btn-allot-next");
    if (navEl) {
        if (_allotExistingPacks.length > 1) {
            navEl.style.display = "flex";
            if (navLabel) { navLabel.textContent = `Package ${idx + 1} of ${_allotExistingPacks.length}`; navLabel.style.display = ""; }
            if (prevBtn)  { prevBtn.style.display = "";  prevBtn.disabled  = (idx === 0); }
            if (nextBtn)  { nextBtn.style.display = "";  nextBtn.disabled  = (idx === _allotExistingPacks.length - 1); }
        } else {
            navEl.style.display = "none";
            if (navLabel) { navLabel.textContent = ""; navLabel.style.display = "none"; }
            if (prevBtn)  { prevBtn.style.display  = "none"; prevBtn.disabled  = true; }
            if (nextBtn)  { nextBtn.style.display  = "none"; nextBtn.disabled  = true; }
        }
    }

    // Show Modify + Delete, hide Sell
    const sellBtn = document.getElementById("btn-allot-sell");
    const modBtn  = document.getElementById("btn-allot-modify");
    const delBtn  = document.getElementById("btn-allot-delete");
    if (sellBtn) { sellBtn.classList.add("d-none"); sellBtn.disabled = true; }
    if (modBtn)  modBtn.classList.remove("d-none");
    if (delBtn)  delBtn.classList.remove("d-none");

    // Update discount/balance display
    setAllotCurrentPackTotalAmount(Number(p.totalAmount || 0));
    updateAllotmentDiscountAndBalance();

    // Show pack preview if pack data is in cache, then HIDE it (d) — not shown in existing-pack mode
    const packCacheData = allotPacksCache.get(p.packName);
    if (packCacheData) {
        handleAllotPackSelectChange();
    }
    // (d) Hide "📦 Package Contents" panel in existing-pack mode
    const previewElHide = document.getElementById("allot-pack-preview");
    if (previewElHide) previewElHide.style.display = "none";
}

export function navigateAllotExistingPack(direction) {
    const newIdx = _allotExistingIdx + direction;
    if (newIdx < 0 || newIdx >= _allotExistingPacks.length) return;
    setAllotExistingIdx(newIdx);
    showAllotExistingPackAtIndex(_allotExistingIdx);
}

export async function handleAllotModifyClick() {
    const p = _allotExistingPacks[_allotExistingIdx];
    if (!p) return;

    const newExpiry    = document.getElementById("allot-expiry-date").value;
    const newSoldPrice = parseFloat(document.getElementById("allot-sold-price").value);
    const newAmtRcvd   = parseFloat(document.getElementById("allot-amount-received").value) || 0;
    const newStartDate = document.getElementById("allot-start-date").value;
    const origPrice    = parseFloat(document.getElementById("allot-original-price")?.value) || 0;

    // Old values from the currently loaded pack record
    const oldSoldPrice = parseFloat(p.soldPrice || 0);
    const oldAmtRcvd   = parseFloat(p.amountReceived || 0);

    // sumAddlAmt cached on the field when pack was loaded (avoids extra Firestore call)
    const avEl      = document.getElementById("allot-addl-amt-visits");
    const sumAddlAmt = avEl ? parseFloat(avEl.dataset.sumAddlAmt || 0) : 0;

    // ── Hard validations (block update) ──────────────────────────────────────
    if (isNaN(newSoldPrice) || newSoldPrice <= 0)
        return alert("Validation Error: Selling Price must be a positive number.");
    if (newAmtRcvd < 0)
        return alert("Validation Error: Amount Received cannot be negative.");
    if (!newStartDate)
        return alert("Validation Error: Activation Date is required.");

    // Validate start date against customer's registrationDate
    try {
        const custQ = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("userNo", "==", p.customerNo),
            where("role", "==", "CUSTOMER"));
        const custSnap = await getDocs(custQ);
        if (!custSnap.empty) {
            const custRegDate = custSnap.docs[0].data().registrationDate;
            if (custRegDate && newStartDate < custRegDate)
                return alert(`Validation Error: Activation Date cannot be before Customer's Registration Date (${custRegDate}).`);
        }
    } catch (err) {
        await handleTelemetryAlert("Validate Start Date", err);
    }

    // (b) Expiry cannot be before Start Date — hard block
    if (newExpiry && newStartDate && newExpiry < newStartDate)
        return alert("Validation Error: Expiry Date cannot be BEFORE Activation Date.");

    // (c) Start Date cannot be after earliest visit date — hard block
    const logsForDates = await getDocs(query(
        collection(db, COL.VISIT_LOGS),
        where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
        where("customerNo",  "==", p.customerNo),
        where("allotId",     "==", p.allotId)
    ));
    if (!logsForDates.empty) {
        const visitDates = [];
        logsForDates.forEach(d => { const vd = d.data().visitDate; if (vd) visitDates.push(vd); });
        if (visitDates.length > 0) {
            const minVisitDate = visitDates.sort()[0];
            if (newStartDate > minVisitDate)
                return alert(`Validation Error: Activation Date cannot be AFTER Visit Date (earliest visit: ${minVisitDate}).`);
        }
    }

    // ── Soft validations (warn, allow update after confirmation) ─────────────
    const warnings = [];
    const totalReceived = newAmtRcvd + sumAddlAmt;

    // (a-1) Selling Price < Amount Received
    if (newSoldPrice < newAmtRcvd)
        warnings.push("⚠️ Selling Price cannot be LESS than Amount Received.");

    // (a-2) Selling Price > Original Price
    if (origPrice > 0 && newSoldPrice > origPrice)
        warnings.push("⚠️ Selling Price cannot be MORE than Original Price.");

    // (d) Total receipts (amountReceived + visit addl amts) > Selling Price
    if (totalReceived > newSoldPrice)
        warnings.push(`⚠️ Amount Received (₹${newAmtRcvd.toLocaleString("en-IN")}) including visit collections (₹${sumAddlAmt.toLocaleString("en-IN")}) totals ₹${totalReceived.toLocaleString("en-IN")}, which cannot be more than Selling Price (₹${newSoldPrice.toLocaleString("en-IN")}).`);

    if (warnings.length > 0) {
        const proceed = confirm(warnings.join("\n\n") + "\n\nDo you still want to save these changes?");
        if (!proceed) return;
    }

    // ── New balance formulas ──────────────────────────────────────────────────
    // remainingBalance += newSoldPrice - oldSoldPrice
    const oldRemainingBalance = parseFloat(p.remainingBalance || 0);
    const newRemainingBalance = oldRemainingBalance + (newSoldPrice - oldSoldPrice);

    // unpaidBalance += oldAmtRcvd - newAmtRcvd
    const oldUnpaidBalance = parseFloat(p.unpaidBalance || 0);
    const newUnpaidBalance = Math.max(0, oldUnpaidBalance + (oldAmtRcvd - newAmtRcvd));

    // ── Perform the update ────────────────────────────────────────────────────
    try {
        const q = query(
            collection(db, COL.CUST_PACKS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("allotId",     "==", p.allotId),
            where("customerNo",  "==", p.customerNo)
        );
        const snap = await getDocs(q);
        if (snap.empty) return alert("Error: Could not locate the package record to update.");

        const updatePayload = {
            expiryDate:       newExpiry         || null,
            soldPrice:        newSoldPrice,
            amountReceived:   newAmtRcvd,
            startDate:        newStartDate,
            unpaidBalance:    newUnpaidBalance,
            // Note: remainingBalance is NOT updated here — it is only adjusted by visit deductions
        };
        await updateDoc(snap.docs[0].ref, updatePayload);
        alert("✅ Package record updated successfully.");

        // Refresh local in-memory cache
        _allotExistingPacks[_allotExistingIdx] = {
            ...p,
            expiryDate:       newExpiry         || null,
            soldPrice:        newSoldPrice,
            amountReceived:   newAmtRcvd,
            startDate:        newStartDate,
            unpaidBalance:    newUnpaidBalance,
        };

        // Refresh UI balance fields
        const ubEl2 = document.getElementById("allot-unpaid-balance-field");
        if (ubEl2) ubEl2.value = `₹${newUnpaidBalance.toLocaleString("en-IN")}`;

        // [c] Reset UI to initial state after modify
        resetAllotExistingPackUI();
        hideAllotExtraUIElements();
        // Reset customer and pack selects to first option
        const custSel = document.getElementById("allot-customer-select");
        if (custSel) custSel.selectedIndex = 0;
        const packSel = document.getElementById("allot-pack-select");
        if (packSel) packSel.selectedIndex = 0;
        // Clear form fields
        document.getElementById("frm-allot-membership")?.reset();
        // Restore pack-select-existing to first option
        const pseEl = document.getElementById("pack-select-existing");
        if (pseEl) pseEl.selectedIndex = 0;
        // Reset packages table
        resetPackagesTable();

    } catch (err) {
        await handleTelemetryAlert("Allot Modify Update", err);
    }
}

export async function handleAllotPackSelectChange() {
    const packName = document.getElementById("allot-pack-select").value;
    const previewEl = document.getElementById("allot-pack-preview");
    const detailsEl = document.getElementById("allot-pack-preview-details");
    const soldPriceEl = document.getElementById("allot-sold-price");
    const discountEl = document.getElementById("allot-sold-discount");
    const unpaidEl = document.getElementById("allot-unpaid-display");

    setAllotCurrentPackTotalAmount(0);
    if (previewEl) previewEl.style.display = "none";
    if (soldPriceEl) soldPriceEl.value = "";
    if (discountEl) discountEl.textContent = "";
    if (unpaidEl) unpaidEl.textContent = "";

    if (!packName) return;

    const pack = allotPacksCache.get(packName);
    if (!pack) return;

    setAllotCurrentPackTotalAmount(Number(pack.totalAmount) || 0);
    const offerPrice = pack.offerPrice !== undefined ? Number(pack.offerPrice) : null;
    const serviceCount = pack.subServicesArray ? pack.subServicesArray.length : 0;

    let discountBadge = "";
    if (offerPrice !== null && allotCurrentPackTotalAmount > 0) {
        const disc = ((allotCurrentPackTotalAmount - offerPrice) / allotCurrentPackTotalAmount * 100);
        if (disc > 0) discountBadge = ` <span class="badge bg-success">${disc.toFixed(1)}% off</span>`;
    }

    detailsEl.innerHTML = `
        <div class="row g-2">
            <div class="col-6"><span class="text-muted">Total Services Price (₹):</span> <strong>₹${allotCurrentPackTotalAmount.toLocaleString("en-IN")}</strong></div>
            <div class="col-6"><span class="text-muted">Pack Offered Price (₹):</span> <strong>${offerPrice !== null ? "₹" + offerPrice.toLocaleString("en-IN") : "N/A"}${discountBadge}</strong></div>
            <div class="col-12"><span class="text-muted">Service Items ${pack.packType === "Type3" ? "NOT " : ""}Allowed in this Pack:</span> <strong>${serviceCount} item${serviceCount === 1 ? "" : "s"}</strong></div>
            <div class="col-12" id="allot-subservice-list"><span class="text-muted small">Loading items…</span></div>
        </div>`;
    previewEl.style.display = "block";

    if (soldPriceEl && offerPrice !== null) {
        soldPriceEl.value = offerPrice;
        updateAllotmentDiscountAndBalance();
    }

    // [e] Set today's date as Activation Date only when selling a NEW package —
    // i.e. btn-allot-modify is hidden (existing pack mode sets its own startDate via showAllotExistingPackAtIndex)
    const startEl = document.getElementById("allot-start-date");
    const modifyBtn = document.getElementById("btn-allot-modify");
    const isExistingPackMode = modifyBtn && !modifyBtn.classList.contains("d-none");
    if (startEl && !isExistingPackMode) startEl.value = new Date().toISOString().split("T")[0];

    // (a) Fetch and display individual service items with serviceName join
    if (pack.subServicesArray && pack.subServicesArray.length > 0) {
        try {
            // Build subServiceCode → data map from cache (avoids N individual Firestore reads)
            const allSubSnap = await _getCachedSubServices();
            const subMap = new Map();
            allSubSnap.forEach(d => { const s = d.data(); subMap.set(s.subServiceCode, s); });

            // Build serviceCode → serviceName lookup from cache
            const srvNameMap = new Map();
            const srvSnap = await _getCachedServices();
            srvSnap.forEach(d => { const s = d.data(); srvNameMap.set(s.serviceCode, s.serviceName); });

            let listHtml = `<div class="mt-1"><span class="text-muted fw-bold small">${pack.packType === "Type3" ? "Excluded" : "Included"} Services:</span><div style="max-height:250px;overflow-y:auto;"><ul class="mb-0 mt-1 ps-3">`;
            pack.subServicesArray.forEach(code => {
                const ss = subMap.get(code);
                if (ss) {
                    const parentName = srvNameMap.get(ss.serviceCode) || "";
                    const displayName = parentName ? `${ss.subServiceName} (${parentName})` : ss.subServiceName;
                    listHtml += `<li class="small">${displayName} <span class="text-success fw-bold">₹${Number(ss.rate).toLocaleString("en-IN")}</span></li>`;
                }
            });
            listHtml += `</ul></div></div>`;
            const listEl = document.getElementById("allot-subservice-list");
            if (listEl) listEl.innerHTML = listHtml;
        } catch (e) {
            const listEl = document.getElementById("allot-subservice-list");
            if (listEl) listEl.innerHTML = `<span class="text-muted small">Could not load service items.</span>`;
        }
    } else {
        const listEl = document.getElementById("allot-subservice-list");
        if (listEl) listEl.innerHTML = "";
    }
}

export function updateAllotmentDiscountAndBalance() {
    const soldPriceEl = document.getElementById("allot-sold-price");
    const amtReceivedEl = document.getElementById("allot-amount-received");
    const discountEl = document.getElementById("allot-sold-discount");
    const unpaidEl = document.getElementById("allot-unpaid-display");
    if (!soldPriceEl || !discountEl || !unpaidEl) return;

    const soldPrice = parseFloat(soldPriceEl.value);
    const amtReceived = parseFloat(amtReceivedEl ? amtReceivedEl.value : "") || 0;

    if (!isNaN(soldPrice) && allotCurrentPackTotalAmount > 0) {
        const discount = ((allotCurrentPackTotalAmount - soldPrice) / allotCurrentPackTotalAmount * 100);
        if (discount > 0) {
            discountEl.textContent = `${discount.toFixed(1)}% off`;
            discountEl.className = "fw-bold small text-nowrap text-success";
        } else if (discount < 0) {
            discountEl.textContent = `${Math.abs(discount).toFixed(1)}% above list`;
            discountEl.className = "fw-bold small text-nowrap text-danger";
        } else {
            discountEl.textContent = "No discount";
            discountEl.className = "fw-bold small text-nowrap text-muted";
        }
    } else {
        discountEl.textContent = "";
    }

    if (!isNaN(soldPrice)) {
        const unpaid = soldPrice - amtReceived;
        if (unpaid > 0) {
            unpaidEl.textContent = `₹${unpaid.toLocaleString("en-IN")} unpaid wrt Initial Pmt`;
            unpaidEl.className = "fw-bold small text-nowrap text-danger";
        } else if (unpaid < 0) {
            unpaidEl.textContent = `₹${Math.abs(unpaid).toLocaleString("en-IN")} overpaid wrt Initial Pmt`;
            unpaidEl.className = "fw-bold small text-nowrap text-warning";
        } else {
            unpaidEl.textContent = "Fully paid ✓";
            unpaidEl.className = "fw-bold small text-nowrap text-success";
        }
    } else {
        unpaidEl.textContent = "";
    }
}

export async function processAllotmentFormSubmission(e) {
    e.preventDefault();
    const cust = document.getElementById("allot-customer-select").value;
    const templatePackName = document.getElementById("allot-pack-select").value;
    const start = document.getElementById("allot-start-date").value;
    const expiry = document.getElementById("allot-expiry-date").value;
    const soldPrice = parseFloat(document.getElementById("allot-sold-price").value) || 0;
    const amountReceived = parseFloat(document.getElementById("allot-amount-received") ? document.getElementById("allot-amount-received").value : "") || 0;
    const unpaidBalance = Math.max(0, soldPrice - amountReceived);

    if (!cust || !templatePackName) return alert("System Configuration Error: Please ensure you select both a valid client and an active package setup template.");

    if (expiry && start && expiry < start)
        return alert("Validation Error: Expiration Date cannot be before the Activation Date.");

    try {
        const q = query(collection(db, COL.COMMON_PACKS), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("packName", "==", templatePackName));
        const res = await getDocs(q);
        if (res.empty) return alert("Activation Blocked: Could not find the selected core packaging model blueprint rules.");
        const templateData = res.docs[0].data();

        // (c) allotId: <ownerUserNo>_APCK_<first3LettersOfPackName><serial>
        //     serial = max serial already used for THIS packName by THIS owner + 1
        const packPrefix = templatePackName.replace(/\s+/g, "").substring(0, 3).toUpperCase();
        const existingAllotsQ = query(collection(db, COL.CUST_PACKS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("packName",    "==", templatePackName));
        const existingAllotsSnap = await getDocs(existingAllotsQ);
        let maxPackSerial = 0;
        const packSerialPattern = new RegExp(`^${activeSessionUser.ownerUserNo}_APCK_${packPrefix}(\\d+)$`);
        existingAllotsSnap.forEach(d => {
            const m = (d.data().allotId || "").match(packSerialPattern);
            if (m) { const n = parseInt(m[1], 10); if (!isNaN(n) && n > maxPackSerial) maxPackSerial = n; }
        });
        const allotId = `${activeSessionUser.ownerUserNo}_APCK_${packPrefix}${maxPackSerial + 1}`;

        // (d) doc id: <ownerUserNo>_ALLOT_<num>
        //     num = max existing serial across ALL allotments for this owner + 1
        const allOwnerAllotsQ = query(collection(db, COL.CUST_PACKS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo));
        const allOwnerAllotsSnap = await getDocs(allOwnerAllotsQ);
        let maxAllotSerial = 0;
        const allotDocPattern = new RegExp(`^${activeSessionUser.ownerUserNo}_ALLOT_(\\d+)$`);
        allOwnerAllotsSnap.forEach(d => {
            const m = d.id.match(allotDocPattern);
            if (m) { const n = parseInt(m[1], 10); if (!isNaN(n) && n > maxAllotSerial) maxAllotSerial = n; }
        });
        const docNum = maxAllotSerial + 1;
        const docId  = `${activeSessionUser.ownerUserNo}_ALLOT_${docNum}`;

        // Fetch customer name for the allotment record
        const custQ = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where("userNo", "==", cust),
            where("role", "==", "CUSTOMER"));
        const custSnap = await getDocs(custQ);
        let customerName = "";
        let customerPhone = "";
        let custRef = null;
        if (!custSnap.empty) {
            const custDoc = custSnap.docs[0];
            const custData = custDoc.data();
            customerName = custData.name || "";
            customerPhone = custData.phone || "";
            custRef = custDoc.ref;
        }

        await setDoc(doc(db, COL.CUST_PACKS, docId), {
            ownerUserNo: activeSessionUser.ownerUserNo, allotId: allotId, customerNo: cust, customerName: customerName, customerPhone: customerPhone,
            packName: templatePackName, packType: templateData.packType,
            // Type3: remainingBalance = totalAmount (customer avails services up to full value, discount is in price paid)
            // Type1/Type2: remainingBalance = soldPrice
            remainingBalance: templateData.packType === "Type3" ? Number(templateData.totalAmount) : soldPrice,
            totalAmount: Number(templateData.totalAmount),
            soldPrice: soldPrice, amountReceived: amountReceived, unpaidBalance: unpaidBalance,
            subServicesArray: templateData.subServicesArray || [],
            startDate: start, expiryDate: expiry || null, active: true, createdAt: new Date().toISOString(),
            lastVisitDate: null
        });

        // Update customer wallet amount
        if (custRef) {
            const currentWallet = custSnap.docs[0].data().walletAmt || 0;
            const newWallet = currentWallet + Number(templateData.totalAmount);
            await updateDoc(custRef, { walletAmt: newWallet });
        }

        alert("Success: Package has been successfully assigned and logged to this client profile account card.");
        // No dropdown reload needed after selling a package —
        // customer and pack dropdowns are unchanged by this operation

        if (_postRegAllotMode) {
            // Opened via "Sell Package?" prompt after customer registration — close modal
            // The hidden.bs.modal listener restores the form to its original inline location
            closePostRegAllotModal();
        } else {
            // Normal inline flow — reset the form in place as before
            document.getElementById("frm-allot-membership").reset();
            setAllotCurrentPackTotalAmount(0);
            const previewEl = document.getElementById("allot-pack-preview");
            if (previewEl) previewEl.style.display = "none";
            const discEl = document.getElementById("allot-sold-discount");
            if (discEl) discEl.textContent = "";
            const unpaidEl = document.getElementById("allot-unpaid-display");
            if (unpaidEl) unpaidEl.textContent = "";
            const srch = document.getElementById("allot-customer-search");
            if (srch) { srch.value = ""; srch.dispatchEvent(new Event("input")); }
            const psrch = document.getElementById("allot-pack-search");
            if (psrch) psrch.value = "";
            resetAllotExistingPackUI();
            hideAllotExtraUIElements();
            resetPackagesTable();
        }
    } catch(err) { await handleTelemetryAlert("Customer Contract Assignment Frame", err); }
}

// =========================================================================
// Role Modification Ledger Access Subsystem
// =========================================================================
export async function processAccessControlFormSubmission(e) {
    e.preventDefault();
    const targetRole = document.getElementById("access-target-role").value;
    const allowReadCommon = document.getElementById("rights-read-common").checked;
    const allowReadCustomer = document.getElementById("rights-read-customer").checked;
    const allowWrite = document.getElementById("rights-write-allowed").checked;

    try {
        const rightsDocId = `${activeSessionUser.ownerUserNo}_ACL_${targetRole}`;
        await setDoc(doc(db, "accessControlRights", rightsDocId), {
            ownerUserNo: activeSessionUser.ownerUserNo, targetRole: targetRole,
            allowReadCommonPacks: allowReadCommon, allowReadCustomerPacks: allowReadCustomer,
            allowWritePrivileges: allowWrite, updatedAt: new Date().toISOString()
        });

        const uniqueLogId = "ACL-LOG-" + Math.floor(100000 + Math.random() * 900000);
        await setDoc(doc(db, "accessLogs", `${activeSessionUser.ownerUserNo}_ACLLOG_${uniqueLogId}`), {
            logId: uniqueLogId, ownerUserNo: activeSessionUser.ownerUserNo, managerUserId: targetRole,
            rightChanged: "allowWritePrivileges", newValue: allowWrite, changedBy: activeSessionUser.role,
            changedAt: new Date().toISOString()
        });

        alert(`Success: Staff management work permissions modified for group level: ${targetRole}`);
    } catch (err) { await handleTelemetryAlert("Access System Framework Controller", err); }
}

// =========================================================================
// Scrollable Packages Table - Non-expired (default) or Customer-specific
// =========================================================================
let _allPackagesDataCache = [];
let _selectedCustomerForTable = null;

export async function loadPackagesTable(selectedCustomerNo = null) {
    try {
        const tbody = document.getElementById("allot-packages-tbody");
        if (!tbody) return;

        const ownerId = activeSessionUser?.ownerUserNo;
        if (!ownerId) return;

        let query_obj;
        if (selectedCustomerNo) {
            // Show all packages for selected customer (expired or not)
            _selectedCustomerForTable = selectedCustomerNo;
            query_obj = query(
                collection(db, COL.CUST_PACKS),
                where("ownerUserNo", "==", ownerId),
                where("customerNo", "==", selectedCustomerNo)
            );
        } else {
            // Show non-expired packages only (including packages with no expiry date)
            _selectedCustomerForTable = null;
            query_obj = query(
                collection(db, COL.CUST_PACKS),
                where("ownerUserNo", "==", ownerId)
            );
        }

        const packSnap = await getDocs(query_obj);
        _allPackagesDataCache = packSnap.docs.map(d => d.data());

        // Enrich packages with customer data if missing (for old packages)
        for (let pkg of _allPackagesDataCache) {
            if (!pkg.customerName || !pkg.customerPhone) {
                try {
                    const custQ = query(collection(db, COL.USERS),
                        where("ownerUserNo", "==", ownerId),
                        where("userNo", "==", pkg.customerNo),
                        where("role", "==", "CUSTOMER"));
                    const custSnap = await getDocs(custQ);
                    if (!custSnap.empty) {
                        const custData = custSnap.docs[0].data();
                        pkg.customerName = pkg.customerName || custData.name || "";
                        pkg.customerPhone = pkg.customerPhone || custData.phone || "";
                    }
                } catch (err) {
                    console.error("Error fetching customer data:", err);
                }
            }
        }

        // Filter: if no customer selected, show only non-expired packages
        if (!selectedCustomerNo) {
            const today = new Date().toISOString().split("T")[0];
            _allPackagesDataCache = _allPackagesDataCache.filter(pkg => {
                if (!pkg.expiryDate) return true;  // No expiry = always show
                return pkg.expiryDate >= today;    // Show if expiry >= today
            });
        }

        // Sort by allotment date (most recent first), then by customer name
        _allPackagesDataCache.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (dateB !== dateA) return dateB - dateA;
            return (a.customerName || "").localeCompare(b.customerName || "");
        });

        renderPackagesTable(_allPackagesDataCache);
    } catch (err) {
        console.error("Error loading packages table:", err);
        await handleTelemetryAlert("Packages Table Loader", err);
    }
}

function renderPackagesTable(packages) {
    const tbody = document.getElementById("allot-packages-tbody");
    if (!tbody) return;

    if (packages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">No packages to display</td></tr>`;
        return;
    }

    tbody.innerHTML = packages.map(pkg => `
        <tr>
            <td>${pkg.customerName || "—"}</td>
            <td class="text-nowrap">${pkg.customerPhone || "—"}</td>
            <td>${pkg.packName || "—"}</td>
            <td class="text-nowrap">${pkg.createdAt ? new Date(pkg.createdAt).toISOString().split("T")[0] : "—"}</td>
            <td class="text-end">₹${Number(pkg.soldPrice || 0).toLocaleString("en-IN")}</td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-primary copy-pkg-btn"
                    data-customer-no="${pkg.customerNo || ""}"
                    data-customer-name="${(pkg.customerName || "").replace(/"/g, '&quot;')}"
                    data-customer-phone="${pkg.customerPhone || ""}"
                    data-pack-name="${(pkg.packName || "").replace(/"/g, '&quot;')}"
                    data-allot-date="${pkg.createdAt ? new Date(pkg.createdAt).toISOString().split("T")[0] : ""}"
                    data-selling-price="${Number(pkg.soldPrice || 0).toLocaleString("en-IN")}"
                    title="Copy to clipboard">📋</button>
            </td>
        </tr>
    `).join("");

    // Attach copy button listeners
    document.querySelectorAll(".copy-pkg-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            const customerNo = btn.dataset.customerNo;
            const customerName = btn.dataset.customerName;
            const customerPhone = btn.dataset.customerPhone;
            const packName = btn.dataset.packName;
            const allotDate = btn.dataset.allotDate;
            const sellingPrice = btn.dataset.sellingPrice;

            const text = `Customer#: ${customerNo}\nCustomer Name: ${customerName}\nPhone: ${customerPhone}\nPackage: ${packName}\nAllotment Date: ${allotDate}\nSelling Price: ₹${sellingPrice}`;

            try {
                await navigator.clipboard.writeText(text);
                alert("✅ Package details copied to clipboard");
            } catch (err) {
                console.error("Clipboard error:", err);
                alert("Error copying to clipboard. Please try again.");
            }
        });
    });
}

export function filterPackagesTable(searchText) {
    const filtered = _allPackagesDataCache.filter(pkg =>
        (pkg.customerName || "").toLowerCase().includes(searchText.toLowerCase())
    );
    renderPackagesTable(filtered);
}

export function resetPackagesTable() {
    _selectedCustomerForTable = null;
    loadPackagesTable();
}

// =========================================================================
// Service Consumption Terminal Functions
// =========================================================================

