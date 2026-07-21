// catalog.js — GlamTrack
import { db, COL, _getCachedServices, _getCachedSubServices, invalidateServicesCache, invalidateSubServicesCache, invalidateCatalogCache, activeSessionUser, setActiveSessionUser, salonOwnerNameContext, setSalonOwnerNameContext, realtimePacksUnsubscribe, setRealtimePacksUnsubscribe, sessionWatchdogTimer, setSessionWatchdogTimer, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, setAllotExistingPacks, _allotExistingIdx, setAllotExistingIdx, _postRegAllotMode, setPostRegAllotMode, _quickAddCustomerMode, setQuickAddCustomerMode, _utilizeStaffOptions, setUtilizeStaffOptions, utilizePrevUnpaidBalance, setUtilizePrevUnpaidBalance, _oldVisitPrevCalcCost, setOldVisitPrevCalcCost, _oldVisitPrevAddlAmt, setOldVisitPrevAddlAmt, _oldVisitLogDocRef, setOldVisitLogDocRef, INACTIVITY_TIMEOUT_MS } from "./state.js";
import { collection, query, where, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
;
;

// Cross-module imports
import { removeCatalogDeleteButton, fetchOwnerRecordByCode } from "./db.js";
import { updatePackSubServicesRunningSum, applyPackTypeUI } from "./ui.js";
import { handleTelemetryAlert, getHighestFieldOffset } from "./auth.js";
import { refreshPackDropdowns, refreshAllAdministrativeTables, loadWorkspaceDropdownMappings } from "./refresh.js";

export async function renderCatalogSubServicesCheckboxes() {
    if (!activeSessionUser) return;
    const container = document.getElementById("container-pack-subservices");
    if (!container) return;

    try {
        // Use cached snapshots to avoid redundant Firestore reads
        const _allSubSnap = await _getCachedSubServices();
        const snap = { empty: _allSubSnap.empty, docs: _allSubSnap.docs.filter(d => d.data().active === true), forEach: (fn) => _allSubSnap.docs.filter(d => d.data().active === true).forEach(fn) };

        // Join with services collection (cached)
        const srvNameMap = new Map();
        const srvSnap = await _getCachedServices();
        srvSnap.forEach(d => {
            const s = d.data();
            srvNameMap.set(s.serviceCode, s.serviceName);
        });

        const srchBox = document.getElementById("pack-subservices-search");
        if (srchBox) srchBox.value = "";
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<p class="text-danger small my-0">No active menu service items found. Please setup or load standard menus first.</p>`;
            return;
        }

        snap.forEach(d => {
            const ss = d.data();
            const parentServiceName = srvNameMap.get(ss.serviceCode) || "";
            const displayLabel = parentServiceName ? `${ss.subServiceName} (${parentServiceName})` : ss.subServiceName;
            container.innerHTML += `
                <div class="form-check">
                    <input class="form-check-input chk-pack-subservice" type="checkbox" value="${ss.subServiceCode}" data-rate="${ss.rate}" id="chk-ss-${ss.subServiceCode}">
                    <label class="form-check-label small" for="chk-ss-${ss.subServiceCode}">
                        ${displayLabel} (₹${ss.rate})
                    </label>
                </div>`;
        });
        updatePackSubServicesRunningSum();
    } catch (err) { await handleTelemetryAlert("Catalog Checkbox Mapping Engine", err); }
}

// =========================================================================
// Structural Administration Form Submission Handlers
// =========================================================================
export async function processCategoryADMFormSubmission(e) {
    e.preventDefault();
    const existingCode = document.getElementById("cat-select-existing").value;
    const name = document.getElementById("cat-name").value.trim();
    const desc = document.getElementById("cat-desc").value.trim();
    const activeFlag = document.getElementById("cat-active").checked;
    
    try {
        let targetCode = existingCode;
        let isNewItem = false;

        if (!targetCode) {
            isNewItem = true;
            targetCode = String(await getHighestFieldOffset("serviceCategories", "catCode") + 1).padStart(2, "0");
        }

        await setDoc(doc(db, COL.CATEGORIES, `${activeSessionUser.ownerUserNo}_CAT_${targetCode}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, catCode: targetCode, catName: name, catDescription: desc,
            active: activeFlag, createdBy: activeSessionUser.role, startDate: new Date().toISOString().split("T")[0],
            expiryDate: null, createdAt: new Date().toISOString()
        });

        alert(isNewItem ? "Success: Menu category added successfully." : `✅ Success: Changes saved for "${name}".`);

        document.getElementById("frm-adm-category").reset();
        document.getElementById("cat-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-cat-delete");

        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("Category Storage Submission Pipeline", err); }
}

export async function processServiceADMFormSubmission(e) {
    e.preventDefault();
    const existingCode = document.getElementById("srv-select-existing").value;
    const parentCat = document.getElementById("srv-parent-cat").value;
    const name = document.getElementById("srv-name").value.trim();
    const desc = document.getElementById("srv-desc").value.trim();
    const activeFlag = document.getElementById("srv-active").checked;

    try {
        let targetCode = existingCode;
        let isNewItem = false;

        if (!targetCode) {
            isNewItem = true;
            targetCode = String(await getHighestFieldOffset("services", "serviceCode") + 1).padStart(2, "0");
        }

        await setDoc(doc(db, COL.SERVICES, `${activeSessionUser.ownerUserNo}_SRV_${targetCode}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, serviceCode: targetCode, serviceName: name, serviceDescription: desc,
            catCode: parentCat, active: activeFlag, createdBy: activeSessionUser.role, startDate: new Date().toISOString().split("T")[0],
            expiryDate: null, createdAt: new Date().toISOString()
        });

        alert(isNewItem ? "Success: Main service group added successfully." : `✅ Success: Changes saved for "${name}".`);
        invalidateServicesCache(); // only services changed

        document.getElementById("frm-adm-service").reset();
        document.getElementById("srv-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-srv-delete");

        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("Service Storage Submission Pipeline", err); }
}

export async function processSubServiceFormSubmission(e) {
    e.preventDefault();
    
    const existingCode = document.getElementById("sub-select-existing").value;
    const parentSrv = document.getElementById("sub-parent-srv").value;
    const name = document.getElementById("sub-name").value.trim();
    const rate = document.getElementById("sub-rate").value;
    const duration = document.getElementById("sub-duration").value;
    const activeFlag = document.getElementById("sub-active").checked;
    const gender = document.getElementById("sub-gender").value;
    if (!parentSrv) return alert("Validation: Please select a Main Service this item belongs to.");
    if (!name)      return alert("Validation: Please enter a name for this service item.");
    try {
        let targetCode = existingCode;
        let isNewItem = false;

        if (!targetCode) {
            isNewItem = true;
            targetCode = String(await getHighestFieldOffset("subServices", "subServiceCode") + 1).padStart(3, "0");
        }

        await setDoc(doc(db, COL.SUB_SERVICES, `${activeSessionUser.ownerUserNo}_SUB_${targetCode}`), {
            ownerUserNo: activeSessionUser.ownerUserNo,
            subServiceCode: targetCode,
            subServiceName: name,
            serviceCode: parentSrv,
            rate: Number(rate),
            durationMinutes: Number(duration),
            sex: gender || null,
            active: activeFlag,
            createdBy: activeSessionUser.role,
            startDate: new Date().toISOString().split("T")[0],
            expiryDate: null,
            createdAt: new Date().toISOString()
        });

        alert(isNewItem ? `✨ Success: "${name}" added to menu!` : `✅ Success: Changes saved.`);
        invalidateSubServicesCache(); // only subServices changed

        document.getElementById("frm-adm-subservice").reset();
        document.getElementById("sub-active").checked = true;
        
        const oldDelBtn = document.getElementById("btn-dynamic-sub-delete");
        if (oldDelBtn) oldDelBtn.remove();
        
        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
        renderCatalogSubServicesCheckboxes();
    } catch(err) { 
        handleTelemetryAlert("Subservice Storage Pipeline", err); 
    }
}

export async function processCommonPackADMFormSubmission(e) {
    e.preventDefault();

    const existingPackName = document.getElementById("pack-select-existing").value;
    const nameId    = document.getElementById("pack-name-id").value.trim();
    const type      = document.getElementById("pack-type-select").value;
    const price     = parseFloat(document.getElementById("pack-price").value) || 0;
    const totalAmt  = parseFloat(document.getElementById("pack-total-amt").value) || 0;
    const activeFlag = document.getElementById("pack-active").checked;

    // Point 17: price cannot exceed totalAmt
    if (price > totalAmt)
        return alert("Validation Error: Price Offered (₹" + price.toLocaleString("en-IN") + ") cannot exceed Total Price (₹" + totalAmt.toLocaleString("en-IN") + "). Please correct before saving.");

    const selectedSubServices = [];
    document.querySelectorAll(".chk-pack-subservice:checked").forEach(input => selectedSubServices.push(input.value));
    // Type2: at least one subservice required. Type3: zero is allowed (excluded items list can be empty).
    if (type === "Type2" && selectedSubServices.length === 0)
        return alert("Validation: Please select at least one Individual Service Item for this package before saving.");

    if (totalAmt > 0) {
        const minAllowed = totalAmt * 0.15;
        if (price > totalAmt) {
            const go = confirm(`⚠️ Price Alert: Offered Price (₹${price.toLocaleString("en-IN")}) exceeds Total Services Price (₹${totalAmt.toLocaleString("en-IN")}). Proceed anyway?`);
            if (!go) return;
        } else if (price < minAllowed) {
            const go = confirm(`⚠️ Price Alert: Offered Price (₹${price.toLocaleString("en-IN")}) is below 15% of Total (₹${minAllowed.toLocaleString("en-IN",{maximumFractionDigits:0})} min). Proceed anyway?`);
            if (!go) return;
        }
    }

    try {
        let packDocRef;
        let isNewItem = false;

        if (existingPackName) {
            const targetDoc = await fetchOwnerRecordByCode("commonServicePacks", "packName", existingPackName);
            if (!targetDoc) return alert("Update blocked: Could not find the selected package in the catalog.");
            const allotQ = query(collection(db, COL.CUST_PACKS),
                where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                where("packName",    "==", existingPackName));
            const allotSnap = await getDocs(allotQ);
            if (!allotSnap.empty)
                return alert(`⚠️ Modification Blocked: "${existingPackName}" is allotted to ${allotSnap.size} customer(s). Create a new package instead.`);
            // (c) Use the SAME document ref regardless of name change — no new doc created
            packDocRef = targetDoc.ref;
        } else {
            isNewItem = true;
            // (b) ID format: <ownerUserNo>_PACK_<first3LettersOfName><serial>
            const prefix = nameId.replace(/\s+/g, "").substring(0, 3).toUpperCase();
            // Find next serial: query all packs for this owner whose packId starts with this prefix
            const allPacksQ = query(collection(db, COL.COMMON_PACKS),
                where("ownerUserNo", "==", activeSessionUser.ownerUserNo));
            const allPacksSnap = await getDocs(allPacksQ);
            let maxSerial = 0;
            const prefixPattern = new RegExp(`^${activeSessionUser.ownerUserNo}_PACK_${prefix}(\\d+)$`);
            allPacksSnap.forEach(d => {
                const m = d.id.match(prefixPattern);
                if (m) { const n = parseInt(m[1], 10); if (n > maxSerial) maxSerial = n; }
            });
            const serial = maxSerial + 1;
            packDocRef = doc(db, COL.COMMON_PACKS, `${activeSessionUser.ownerUserNo}_PACK_${prefix}${serial}`);
        }

        await setDoc(packDocRef, {
            ownerUserNo: activeSessionUser.ownerUserNo,
            id: packDocRef.id,
            packName: nameId, packType: type,
            offerPrice: price, totalAmount: totalAmt,
            subServicesArray: selectedSubServices,
            active: activeFlag, createdAt: new Date().toISOString()
        });

        alert(isNewItem ? "Success: New pre-paid package added." : `✅ Success: Changes saved for "${nameId}".`);
        document.getElementById("frm-adm-commonpack").reset();
        document.getElementById("pack-active").checked = true;
        document.getElementById("pack-type-select").value = "Type3"; applyPackTypeUI("Type3");
        const discEl2 = document.getElementById("pack-discount-display");
        if (discEl2) discEl2.textContent = "";
        removeCatalogDeleteButton("btn-dynamic-pack-delete");
        renderCatalogSubServicesCheckboxes();
        // Targeted: only pack dropdowns need updating after a pack save
        await refreshPackDropdowns();
        refreshAllAdministrativeTables(); // still needed for tbl-adm-commonpacks table
    } catch(err) { await handleTelemetryAlert("Master Package Creation Node", err); }
}

