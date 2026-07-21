// db.js — GlamTrack
import { db, invalidateServicesCache, invalidateSubServicesCache, invalidateCatalogCache, activeSessionUser, setActiveSessionUser, salonOwnerNameContext, setSalonOwnerNameContext, realtimePacksUnsubscribe, setRealtimePacksUnsubscribe, sessionWatchdogTimer, setSessionWatchdogTimer, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, setAllotExistingPacks, _allotExistingIdx, setAllotExistingIdx, _postRegAllotMode, setPostRegAllotMode, _quickAddCustomerMode, setQuickAddCustomerMode, _utilizeStaffOptions, setUtilizeStaffOptions, utilizePrevUnpaidBalance, setUtilizePrevUnpaidBalance, _oldVisitPrevCalcCost, setOldVisitPrevCalcCost, _oldVisitPrevAddlAmt, setOldVisitPrevAddlAmt, _oldVisitLogDocRef, setOldVisitLogDocRef, INACTIVITY_TIMEOUT_MS } from "./state.js";
import { collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
;
;

export function removeCatalogDeleteButton(buttonId) {
    const oldBtn = document.getElementById(buttonId);
    if (oldBtn) oldBtn.remove();
}

export function appendCatalogDeleteButton({ formId, buttonId, itemName, targetDocRef, onDeleted, preDeleteConfirm }) {
    const formEl = document.getElementById(formId);
    const saveBtn = formEl.querySelector("button[type='submit']");
    removeCatalogDeleteButton(buttonId);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.id = buttonId;
    deleteBtn.className = "btn btn-danger btn-sm d-block w-100 mt-2 fw-bold";
    deleteBtn.innerText = "🗑️ Delete Item Permanently";
    deleteBtn.addEventListener("click", async () => {
        const proceed = preDeleteConfirm
            ? await preDeleteConfirm()
            : confirm(`Are you absolutely sure you want to permanently delete "${itemName}"? This action cannot be reversed.`);
        if (!proceed) return;
        try {
            await deleteDoc(targetDocRef);
            alert("Success: The item has been completely removed from the menu configuration.");
            onDeleted();
        } catch (delErr) {
            console.error("Deletion process fault trace:", delErr);
            alert("Failed to drop record item from database execution context.");
        }
    });
    saveBtn.parentNode.appendChild(deleteBtn);
}

// Apply background image for pre-login state immediately on load
document.body.classList.add("bg-glamtrack");

export async function fetchOwnerRecordByCode(collectionName, codeField, selectedCode) {
    const collRef = collection(db, collectionName);
    let q = query(
        collRef,
        where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
        where(codeField, "==", selectedCode)
    );
    let res = await getDocs(q);
    if (res.empty && !isNaN(selectedCode)) {
        q = query(
            collRef,
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where(codeField, "==", Number(selectedCode))
        );
        res = await getDocs(q);
    }
    return res.empty ? null : res.docs[0];
}

// =========================================================================
// UI Lifecycle Router Initialization Hook
// =========================================================================

