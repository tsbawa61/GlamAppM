// customers.js — GlamTrack
import { db, COL, invalidateServicesCache, invalidateSubServicesCache, invalidateCatalogCache, activeSessionUser, setActiveSessionUser, salonOwnerNameContext, setSalonOwnerNameContext, realtimePacksUnsubscribe, setRealtimePacksUnsubscribe, sessionWatchdogTimer, setSessionWatchdogTimer, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, setAllotExistingPacks, _allotExistingIdx, setAllotExistingIdx, _postRegAllotMode, setPostRegAllotMode, _quickAddCustomerMode, setQuickAddCustomerMode, _utilizeStaffOptions, setUtilizeStaffOptions, utilizePrevUnpaidBalance, setUtilizePrevUnpaidBalance, _oldVisitPrevCalcCost, setOldVisitPrevCalcCost, _oldVisitPrevAddlAmt, setOldVisitPrevAddlAmt, _oldVisitLogDocRef, setOldVisitLogDocRef, INACTIVITY_TIMEOUT_MS,
    _allotFormOriginalNextSibling, _allotFormOriginalParent, _postRegAllotModalInstance, _quickAddCustomerModalInstance, _userProfileFormOriginalNextSibling, _userProfileFormOriginalParent,
    setQuickAddCustomerModalInstance, setUserProfileFormOriginalParent, setUserProfileFormOriginalNextSibling, setPostRegAllotModalInstance, setAllotFormOriginalParent, setAllotFormOriginalNextSibling
} from "./state.js";
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
;
;

// Cross-module imports
import { removeCatalogDeleteButton, fetchOwnerRecordByCode } from "./db.js";
import { handleTelemetryAlert } from "./auth.js";
import { resetAllotExistingPackUI, hideAllotExtraUIElements } from "./allotment.js";
import { refreshCustomerDropdown, refreshUserProfileDropdown, refreshAllAdministrativeTables } from "./refresh.js";

function formatDateToDDMMYYYY(dateStr) {
    if (!dateStr) return "NA";

    // Convert to string if it's not already
    dateStr = String(dateStr).trim();
    if (!dateStr) return "NA";

    // If already in dd/mm/yyyy format, return as is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;

    // If in yyyy-mm-dd format, convert to dd/mm/yyyy
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}/${year}`;
    }

    // If it's a Date object or timestamp, try to parse it
    try {
        const dateObj = new Date(dateStr);
        if (!isNaN(dateObj.getTime())) {
            const day = String(dateObj.getDate()).padStart(2, "0");
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const year = dateObj.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (e) {
        // Fall through to return original
    }

    return dateStr;
}

export function configureUserProfileFormForRole(loggedInRole) {
    const roleSelect = document.getElementById("usr-role");
    const distWrapper = document.getElementById("usr-distance-wrapper");
    if (!roleSelect) return;
    const ownerOpt = roleSelect.querySelector("option[value='OWNER']");
    const mgrOpt   = roleSelect.querySelector("option[value='MANAGER']");
    const custOpt  = roleSelect.querySelector("option[value='CUSTOMER']");
    if (loggedInRole === "SUPER_USER") {
        if (ownerOpt) ownerOpt.hidden = false;
        if (mgrOpt)   mgrOpt.hidden   = true;
        if (custOpt)  custOpt.hidden   = true;
        if (distWrapper) distWrapper.hidden = true;
    } else {
        if (ownerOpt) ownerOpt.hidden = true;
        if (mgrOpt)   mgrOpt.hidden   = false;
        if (custOpt)  custOpt.hidden   = false;
        if (distWrapper) distWrapper.hidden = false;
    }
}
export async function processUserADMFormSubmission(e) {
    e.preventDefault();
    const existingUserNo = document.getElementById("usr-select-existing").value;
    const role = document.getElementById("usr-role").value;
    if (!role) return alert("Validation Error: Please select a User Profile Type.");
    const name = document.getElementById("usr-fullname").value.trim();
    const sex = document.getElementById("usr-sex").value;
    const age = document.getElementById("usr-age").value;
    const email = document.getElementById("usr-email").value.trim().toLowerCase();
    const pass = document.getElementById("usr-password").value;
    const confirmPass = document.getElementById("usr-confirm-password").value;
    const mismatchMsg = document.getElementById("usr-pwd-mismatch-msg");

    // (a-i) Confirm password match — only enforce for NEW records, not modifications
    // When modifying, the user may leave confirm-password blank intentionally
    if (!existingUserNo) {
        if (pass || confirmPass) {
            if (pass !== confirmPass) {
                if (mismatchMsg) mismatchMsg.style.display = "block";
                document.getElementById("usr-confirm-password").focus();
                return;
            }
        }
        if (mismatchMsg) mismatchMsg.style.display = "none";
    } else {
        // Modifying: only check mismatch if BOTH fields are filled
        if (pass && confirmPass && pass !== confirmPass) {
            if (mismatchMsg) mismatchMsg.style.display = "block";
            document.getElementById("usr-confirm-password").focus();
            return;
        }
        if (mismatchMsg) mismatchMsg.style.display = "none";
    }

    const phone = document.getElementById("usr-phone").value.trim();
    // [e] 10-digit mobile number validation
    if (phone && !/^[0-9]{10}$/.test(phone))
        return alert("Validation Error: Mobile number must be exactly 10 digits.");
    // (a-i) Password mandatory only for NEW MANAGER/OWNER records, not modifications
    if (!existingUserNo && (role === "MANAGER" || role === "OWNER") && !pass.trim())
        return alert("Validation Error: Password is required for MANAGER and OWNER profiles.");
    const dist = document.getElementById("usr-distance").value;
    const addr = document.getElementById("usr-address").value.trim();
    const maps = document.getElementById("usr-mapurl").value.trim();
    const activeFlag = document.getElementById("usr-active").checked;
    const regFeeRaw = document.getElementById("usr-reg-fee")?.value;
    const regFee = (regFeeRaw !== "" && regFeeRaw !== undefined && !isNaN(parseFloat(regFeeRaw)) && parseFloat(regFeeRaw) >= 0)
        ? parseFloat(regFeeRaw) : null;
    const regDate = document.getElementById("usr-reg-date")?.value || null;

    // Requirement 2b: Make usr-age, usr-distance, usr-reg-date mandatory for CUSTOMER
    if (role === "CUSTOMER") {
        if (!age || age.trim() === "") return alert("Validation Error: Age is mandatory for Customer profiles.");
        if (!dist || dist.toString().trim() === "") return alert("Validation Error: Distance is mandatory for Customer profiles.");
        if (!regDate) return alert("Validation Error: Registration Date is mandatory for Customer profiles.");
    }

    try {
        let targetUserNo = existingUserNo;
        let isNewItem = false;

        if (!targetUserNo) {
            isNewItem = true;

            if (role === "CUSTOMER") {
                // 4-digit sequential, scoped to this owner
                const q = query(collection(db, COL.USERS),
                    where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                    where("role", "==", "CUSTOMER"));
                const snap = await getDocs(q);
                let maxNo = 0;
                snap.forEach(d => { const n = parseInt(d.data().userNo, 10); if (!isNaN(n) && n > maxNo) maxNo = n; });
                targetUserNo = String(maxNo + 1).padStart(4, "0");
            } else if (role === "MANAGER") {
                // 3-digit sequential, scoped to this owner
                const q = query(collection(db, COL.USERS),
                    where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                    where("role", "==", "MANAGER"));
                const snap = await getDocs(q);
                let maxNo = 0;
                snap.forEach(d => { const n = parseInt(d.data().userNo, 10); if (!isNaN(n) && n > maxNo) maxNo = n; });
                targetUserNo = String(maxNo + 1).padStart(3, "0");
            } else if (role === "STAFF") {
                // 3-digit sequential, scoped to this owner
                const q = query(collection(db, COL.USERS),
                    where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                    where("role", "==", "STAFF"));
                const snap = await getDocs(q);
                let maxNo = 0;
                snap.forEach(d => { const n = parseInt(d.data().userNo, 10); if (!isNaN(n) && n > maxNo) maxNo = n; });
                targetUserNo = String(maxNo + 1).padStart(3, "0");
            } else if (role === "OWNER") {
                // 3-digit sequential across ALL owners — query SUPER_USER scope (ownerUserNo='000')
                const q = query(collection(db, COL.USERS),
                    where("ownerUserNo", "==", "000"),
                    where("role", "==", "OWNER"));
                const snap = await getDocs(q);
                let maxNo = 0;
                snap.forEach(d => { const n = parseInt(d.data().userNo, 10); if (!isNaN(n) && n > maxNo) maxNo = n; });
                targetUserNo = String(maxNo + 1).padStart(3, "0");
            }
        }

        // Build document ID and ownerUserNo per role
        let docId, recordOwnerUserNo;

        if (!isNewItem) {
            // Modifying an existing record — fetch the actual Firestore doc ID
            // to avoid creating a duplicate document with a differently-formatted ID
            const existingDoc = await fetchOwnerRecordByCode("users", "userNo", targetUserNo);
            if (!existingDoc) return alert("Error: Could not locate the existing profile to update.");
            docId = existingDoc.id;
            recordOwnerUserNo = existingDoc.data().ownerUserNo;
        } else if (role === "CUSTOMER") {
            recordOwnerUserNo = activeSessionUser.ownerUserNo;
            docId = `${recordOwnerUserNo}_USR_${targetUserNo}`;
        } else if (role === "MANAGER") {
            recordOwnerUserNo = activeSessionUser.ownerUserNo;
            docId = `${recordOwnerUserNo}_USR_${targetUserNo}`;
        } else if (role === "STAFF") {
            recordOwnerUserNo = activeSessionUser.ownerUserNo;
            docId = `${recordOwnerUserNo}_USR_${targetUserNo}`;
        } else if (role === "OWNER") {
            recordOwnerUserNo = targetUserNo;
            docId = `${targetUserNo}_USR_${targetUserNo}`;
        } else {
            recordOwnerUserNo = activeSessionUser.ownerUserNo;
            docId = `${recordOwnerUserNo}_USR_${targetUserNo}`;
        }
        await setDoc(doc(db, COL.USERS, docId), {
            ownerUserNo: recordOwnerUserNo, userNo: targetUserNo, role: role, name: name, sex: sex,
            ageGroup: age, email: email, password: pass, phone: phone, distance: dist, address: addr,
            googleMapLink: maps, active: activeFlag, registrationFee: regFee, registrationDate: regDate,
            startDate: new Date().toISOString().split("T")[0], createdAt: new Date().toISOString(),
            walletAmt: 0
        });

        // Quick-add mode: close modal and auto-populate allot-customer-select, skip normal reset flow
        if (_quickAddCustomerMode) {
            alert(isNewItem
                ? `Success: Profile record file registered successfully as a salon ${role}.`
                : `✅ Success: Changes saved for "${name}".`);

            removeCatalogDeleteButton("btn-dynamic-usr-delete");
            // Targeted: only customer dropdowns need updating after a new customer save
            await refreshCustomerDropdown(); // ensures allot-customer-select has the new option

            closeQuickAddCustomerModal();
            setQuickAddCustomerMode(false);

            // Auto-populate allot-customer-select with the newly saved customer's userNo
            const allotCustSelect = document.getElementById("allot-customer-select");
            if (allotCustSelect) {
                allotCustSelect.value = targetUserNo;
                allotCustSelect.dispatchEvent(new Event("change"));
            }

            document.getElementById("frm-adm-user-profile").reset();
            document.getElementById("usr-active").checked = true;
            const _mMsgQA = document.getElementById("usr-pwd-mismatch-msg"); if (_mMsgQA) _mMsgQA.style.display = "none";
            return;
        }

        alert(isNewItem
            ? `Success: Profile record file registered successfully as a salon ${role}.`
            : `✅ Success: Changes saved for "${name}".`);

        document.getElementById("frm-adm-user-profile").reset();
        document.getElementById("usr-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-usr-delete");
        const _mMsgPost = document.getElementById("usr-pwd-mismatch-msg"); if (_mMsgPost) _mMsgPost.style.display = "none";

        refreshAllAdministrativeTables();
        // Targeted refresh: only reload dropdowns affected by user save
        if (role === "CUSTOMER") {
            await refreshCustomerDropdown();    // allot-customer-select + utilize-customer-select
        }
        await refreshUserProfileDropdown();     // usr-select-existing

        // Re-apply current mode (CUSTOMER/MANAGER) so form resets to correct dynamic state
        // This also refreshes "All Active Registered Profiles List" with the correct role filter
        const _postSaveMode = document.getElementById("sec-adm-users")?.dataset?.userMode;
        if (_postSaveMode) {
            applyUserFormMode(_postSaveMode);
            _refreshUserTableForMode(_postSaveMode);
        }

        // [a] After Customer Registration (normal flow), offer to sell a package in a modal
        if (role === "CUSTOMER") {
            const wantsToSell = confirm("Do you want to Sell a Package to this Customer (Y/N)?");
            if (wantsToSell) {
                resetAllotExistingPackUI();
                hideAllotExtraUIElements();
                const startEl = document.getElementById("allot-start-date");
                if (startEl && !startEl.value) startEl.value = new Date().toISOString().split("T")[0];

                openPostRegAllotModal();

                // Auto-populate allot-customer-select with this customer's userNo
                const allotCustSelect = document.getElementById("allot-customer-select");
                if (allotCustSelect) {
                    allotCustSelect.value = targetUserNo;
                    allotCustSelect.dispatchEvent(new Event("change"));
                }
            }
        }
    } catch(err) { await handleTelemetryAlert("User Identity Provisioning Endpoint", err); }
}

// =========================================================================
// Dynamic User Form Mode: "CUSTOMER" or "MANAGER" context
// =========================================================================
// Updates usr-password / usr-confirm-password placeholder text and required state
// based on the currently selected usr-role value. Password is mandatory for MANAGER,
// optional for STAFF (and for CUSTOMER, handled separately by hiding the row entirely).
export function _updatePasswordRequirementForRole(role) {
    const pwdField     = document.getElementById("usr-password");
    const confPwdField = document.getElementById("usr-confirm-password");
    const emailEl      = document.getElementById("usr-email");
    const emailLabel   = document.getElementById("lbl-usr-email");

    if (role === "STAFF") {
        if (pwdField)     { pwdField.placeholder     = "Create Login Password (Optional for Staff)"; pwdField.required     = false; }
        if (confPwdField) { confPwdField.placeholder = "Re-enter Password (Optional for Staff)";     confPwdField.required = false; }
        // [1a] Email optional for STAFF
        if (emailEl)    { emailEl.required = false; emailEl.placeholder = "client@domain.com (Mandatory for Manager)"; }
        if (emailLabel) emailLabel.textContent = "Email Address [Optional]";
    } else {
        // MANAGER (and default/fallback)
        // Never set required=true on password fields — they may be hidden in some modes
        // which causes "invalid form control not focusable" browser warning.
        // Password validation is handled in processUserADMFormSubmission() JS instead.
        if (pwdField)     { pwdField.placeholder     = "Create Login Password (Mandatory for Manager)"; pwdField.required     = false; }
        if (confPwdField) { confPwdField.placeholder = "Re-enter Password (Mandatory for Manager)";     confPwdField.required = false; }
        // [1a] Email mandatory for MANAGER
        if (emailEl)    { emailEl.required = true;  emailEl.placeholder = "client@domain.com (Mandatory for Manager)"; }
        if (emailLabel) emailLabel.textContent = "Email Address";
    }
}

// Make email optional when modifying a staff record (not required for modifications)
export function _updateEmailRequirementForModification(isModifying) {
    const emailEl      = document.getElementById("usr-email");
    const emailLabel   = document.getElementById("lbl-usr-email");

    if (isModifying) {
        if (emailEl)    { emailEl.required = false; emailEl.placeholder = "client@domain.com (Optional)"; }
        if (emailLabel) emailLabel.textContent = "Email Address [Optional]";
    } else {
        // When creating a new record, reapply the role-based requirement
        const role = document.getElementById("usr-role")?.value;
        if (role === "STAFF") {
            if (emailEl)    { emailEl.required = false; emailEl.placeholder = "client@domain.com (Mandatory for Manager)"; }
            if (emailLabel) emailLabel.textContent = "Email Address [Optional]";
        } else if (role === "MANAGER") {
            if (emailEl)    { emailEl.required = true;  emailEl.placeholder = "client@domain.com (Mandatory for Manager)"; }
            if (emailLabel) emailLabel.textContent = "Email Address";
        }
    }
}

// =========================================================================
// Quick-Add Customer Modal Helpers (used ONLY by the "+" button in the
// Sell Package form, per requirement). The normal "Customer Registration"
// nav menu flow is completely untouched — frm-adm-user-profile always
// displays inline in #sec-adm-users in that case, exactly as before.
//
// Technique: the EXISTING #card-user-profile-form DOM node (which contains
// frm-adm-user-profile) is MOVED into the quick-add modal's body when the
// "+" button is clicked, and MOVED BACK to its original parent/position in
// #sec-adm-users when the modal closes. This guarantees only ONE copy of
// frm-adm-user-profile ever exists in the DOM — so all existing save/load/
// delete JS logic (which references element IDs) keeps working unchanged,
// regardless of which entry point is used.
// =========================================================================
// [_quickAddCustomerModalInstance imported from state.js]
// [_quickAddCustomerMode imported from state.js]
// [_userProfileFormOriginalParent imported from state.js]
// [_userProfileFormOriginalNextSibling imported from state.js]

export function _getQuickAddCustomerModalInstance() {
    const modalEl = document.getElementById("modal-quick-add-customer");
    if (!modalEl) return null;
    if (!_quickAddCustomerModalInstance) {
        setQuickAddCustomerModalInstance(new bootstrap.Modal(modalEl, { backdrop: "static" }));
    }
    return _quickAddCustomerModalInstance;
}

export function openQuickAddCustomerModal() {
    const cardEl = document.getElementById("card-user-profile-form");
    const modalBodyEl = document.getElementById("modal-quick-add-customer-body");
    if (!cardEl || !modalBodyEl) return;

    // Remember exact original location so we can put it back later
    setUserProfileFormOriginalParent(cardEl.parentNode);
    setUserProfileFormOriginalNextSibling(cardEl.nextSibling);

    // Move the form card into the modal body
    modalBodyEl.appendChild(cardEl);

    setQuickAddCustomerMode(true);

    // Hide "choose existing" dropdown + its wrapper (quick-add is always a brand-new customer)
    const wrapperEl  = document.getElementById("usr-select-existing-wrapper");
    if (wrapperEl) wrapperEl.style.display = "none";
    // Relabel Reset -> Close
    const resetBtnEl = document.getElementById("btn-reset-userprofile");
    if (resetBtnEl) resetBtnEl.textContent = "Close";

    const modal = _getQuickAddCustomerModalInstance();
    if (modal) modal.show();
}

export function closeQuickAddCustomerModal() {
    // Blur any focused element inside the modal before hiding
    const modalEl = document.getElementById("modal-quick-add-customer");
    if (modalEl && modalEl.contains(document.activeElement)) {
        document.activeElement.blur();
    }
    const modal = _getQuickAddCustomerModalInstance();
    if (modal) modal.hide();
}

export function restoreUserProfileFormToOriginalLocation() {
    const cardEl = document.getElementById("card-user-profile-form");
    if (!cardEl || !_userProfileFormOriginalParent) return;

    if (_userProfileFormOriginalNextSibling) {
        _userProfileFormOriginalParent.insertBefore(cardEl, _userProfileFormOriginalNextSibling);
    } else {
        _userProfileFormOriginalParent.appendChild(cardEl);
    }

    setQuickAddCustomerMode(false);

    // Restore "choose existing" dropdown visibility and Reset button caption
    const wrapperEl  = document.getElementById("usr-select-existing-wrapper");
    if (wrapperEl) wrapperEl.style.display = "";
    const resetBtnEl = document.getElementById("btn-reset-userprofile");
    if (resetBtnEl) resetBtnEl.textContent = "Reset";
}

// =========================================================================
// Post-Customer-Registration "Sell Package" Modal Helpers. Used ONLY when
// the user answers "Yes" to "Do you want to Sell a Package to this
// Customer?" immediately after registering a new customer. The normal
// "Packages > Package Purchase" nav menu flow is completely untouched —
// frm-allot-membership always displays inline in #sec-allot in that case.
//
// Same node-relocation technique as the quick-add customer modal: move the
// EXISTING #card-allot-membership-form node into the modal body, then move
// it back to its original location in #sec-allot when the modal closes.
// =========================================================================
// [_postRegAllotModalInstance imported from state.js]
// [_postRegAllotMode imported from state.js]
// [_allotFormOriginalParent imported from state.js]
// [_allotFormOriginalNextSibling imported from state.js]

export function _getPostRegAllotModalInstance() {
    const modalEl = document.getElementById("modal-post-reg-allot");
    if (!modalEl) return null;
    if (!_postRegAllotModalInstance) {
        setPostRegAllotModalInstance(new bootstrap.Modal(modalEl, { backdrop: "static" }));
    }
    return _postRegAllotModalInstance;
}

export function openPostRegAllotModal() {
    const cardEl = document.getElementById("card-allot-membership-form");
    const modalBodyEl = document.getElementById("modal-post-reg-allot-body");
    if (!cardEl || !modalBodyEl) return;

    setAllotFormOriginalParent(cardEl.parentNode);
    setAllotFormOriginalNextSibling(cardEl.nextSibling);

    modalBodyEl.appendChild(cardEl);
    setPostRegAllotMode(true);

    // Hide "+" button — customer is already known in this context
    const plusBtn = document.getElementById("btn-quick-add-customer");
    if (plusBtn) plusBtn.style.display = "none";

    // Relabel Reset -> Close while inside this modal
    const resetBtnEl = document.getElementById("btn-reset-allot");
    if (resetBtnEl) resetBtnEl.textContent = "Close";

    const modal = _getPostRegAllotModalInstance();
    if (modal) modal.show();
}

export function closePostRegAllotModal() {
    // Blur any focused element inside the modal before hiding to avoid
    // aria-hidden on focused element warning (WAI-ARIA spec violation)
    const modalEl = document.getElementById("modal-post-reg-allot");
    if (modalEl && modalEl.contains(document.activeElement)) {
        document.activeElement.blur();
    }
    const modal = _getPostRegAllotModalInstance();
    if (modal) modal.hide();
}

export function restoreAllotFormToOriginalLocation() {
    const cardEl = document.getElementById("card-allot-membership-form");
    if (!cardEl || !_allotFormOriginalParent) return;

    if (_allotFormOriginalNextSibling) {
        _allotFormOriginalParent.insertBefore(cardEl, _allotFormOriginalNextSibling);
    } else {
        _allotFormOriginalParent.appendChild(cardEl);
    }

    setPostRegAllotMode(false);

    // Restore "+" button visibility
    const plusBtn = document.getElementById("btn-quick-add-customer");
    if (plusBtn) plusBtn.style.display = "";

    const resetBtnEl = document.getElementById("btn-reset-allot");
    if (resetBtnEl) resetBtnEl.textContent = "Reset";
}

export function applyUserFormMode(mode) {
    // Set mode immediately so refreshAllAdministrativeTables can read it
    document.getElementById("sec-adm-users").dataset.userMode = mode;

    // Reset form to blank state (except explicit dropdowns set below)
    const profileForm = document.getElementById("frm-adm-user-profile");
    if (profileForm) profileForm.reset();
    document.getElementById("usr-active").checked = true;
    const _mMsg = document.getElementById("usr-pwd-mismatch-msg");
    if (_mMsg) _mMsg.style.display = "none";
    removeCatalogDeleteButton("btn-dynamic-usr-delete");

    // --- Card header caption ---
    const cardHeader = document.querySelector("#sec-adm-users .card-header");
    if (cardHeader) cardHeader.textContent = mode === "CUSTOMER" ? "Add New Customer Profile" : "Add New Staff User Profile";

    // --- Leave-blank hint ---
    const hintEl = document.querySelector("#sec-adm-users .form-text.text-muted.small");
    if (hintEl) hintEl.textContent = mode === "CUSTOMER"
        ? "Leave blank when registering a new Customer."
        : "Leave blank when registering a new Staff member.";

    // --- usr-role dropdown: show only relevant option, set value, disable ---
    const roleSelect = document.getElementById("usr-role");
    if (roleSelect) {
        Array.from(roleSelect.options).forEach(opt => {
            if (opt.value === "") return; // keep placeholder
            opt.hidden = true;
        });
        if (mode === "CUSTOMER") {
            const custOpt = roleSelect.querySelector("option[value='CUSTOMER']");
            if (custOpt) { custOpt.hidden = false; }
            roleSelect.value = "CUSTOMER";
            roleSelect.disabled = true;
        } else {
            // STAFF mode: show MANAGER and STAFF, let user choose, default STAFF (requirement 1a)
            ["MANAGER","STAFF"].forEach(v => {
                const opt = roleSelect.querySelector(`option[value='${v}']`);
                if (opt) opt.hidden = false;
            });
            roleSelect.value = "STAFF";  // Changed from MANAGER to STAFF as default
            roleSelect.disabled = false;  // user can choose MANAGER or STAFF
        }
    }

    // Hide usr-role dropdown in CUSTOMER mode (Customer Registration only)
    const roleRow = document.getElementById("usr-role")?.closest(".mb-3");
    if (roleRow) roleRow.style.display = mode === "CUSTOMER" ? "none" : "";

    // --- Password fields: hide for CUSTOMER, show & relabel for MANAGER/STAFF ---
    const pwdRow = document.getElementById("usr-password")?.closest(".row");
    const pwdField    = document.getElementById("usr-password");
    const confPwdField= document.getElementById("usr-confirm-password");
    const pwdLabel    = pwdField?.previousElementSibling;
    const confPwdLabel= confPwdField?.previousElementSibling;
    if (mode === "CUSTOMER") {
        if (pwdRow) pwdRow.style.display = "none";
    } else {
        if (pwdRow) pwdRow.style.display = "";
        if (pwdLabel)    pwdLabel.textContent    = "Sign-In Password";
        if (confPwdLabel) confPwdLabel.textContent = "Confirm Password";
        // Apply mandatory/optional state based on currently selected role (default MANAGER)
        _updatePasswordRequirementForRole(roleSelect ? roleSelect.value : "MANAGER");
    }

    // --- Age and Distance: hide for MANAGER/STAFF, show for CUSTOMER ---
    const ageEl  = document.getElementById("usr-age")?.closest(".col-md-6");
    const distEl = document.getElementById("usr-distance-wrapper")?.closest(".col-md-6");
    if (mode === "MANAGER") {
        if (ageEl)  ageEl.style.display  = "none";
        if (distEl) distEl.style.display = "none";
    } else {
        if (ageEl)  ageEl.style.display  = "";
        if (distEl) distEl.style.display = "";
    }

    // --- Email: mandatory for MANAGER, optional for STAFF and CUSTOMER (requirement 1d) ---
    const emailEl    = document.getElementById("usr-email");
    const emailLabel = document.getElementById("lbl-usr-email");
    if (mode === "MANAGER") {
        if (emailEl)    { emailEl.required = true;  emailEl.placeholder = "client@domain.com (Mandatory for Manager)"; }
        if (emailLabel) emailLabel.textContent = "Email Address";
    } else {
        if (emailEl)    { emailEl.required = false; emailEl.placeholder = "client@domain.com (Optional for Staff)"; }
        if (emailLabel) emailLabel.textContent = "Email Address [Optional]";
    }

    // --- Registration Fee and Date: show for CUSTOMER only ---
    const regFeeWrapper = document.getElementById("usr-reg-fee-wrapper");
    if (regFeeWrapper) regFeeWrapper.style.display = mode === "CUSTOMER" ? "" : "none";

    // [b] Default Registration Date to today for new customer registrations
    if (mode === "CUSTOMER") {
        const regDateEl = document.getElementById("usr-reg-date");
        if (regDateEl && !regDateEl.value) regDateEl.value = new Date().toISOString().split("T")[0];
    }

    // --- Google Maps URL: hidden for MANAGER/STAFF (not relevant for staff) ---
    const mapUrlWrapper = document.getElementById("usr-mapurl-wrapper");
    if (mapUrlWrapper) mapUrlWrapper.style.display = mode === "CUSTOMER" ? "none" : "none"; // hidden for all modes via HTML default

    // --- Populate usr-select-existing with role filter ---
    _repopulateUserSelectExisting(mode);

    // --- Refresh the users table with role filter ---
    _refreshUserTableForMode(mode);
}

export async function _repopulateUserSelectExisting(mode) {
    if (!activeSessionUser) return;
    const ownerId = activeSessionUser.ownerUserNo;
    const userProfileSelect = document.getElementById("usr-select-existing");
    if (!userProfileSelect) return;

    let usersQuery;
    if (mode === "CUSTOMER") {
        usersQuery = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", ownerId),
            where("role", "==", "CUSTOMER"));
    } else {
        usersQuery = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", ownerId),
            where("role", "in", ["MANAGER", "STAFF"]));
    }
    const usersSnap = await getDocs(usersQuery);
    userProfileSelect.innerHTML = `<option value="">-- Creating a Brand New Profile --</option>`;
    usersSnap.forEach(d => {
        const data = d.data();
        userProfileSelect.innerHTML += `<option value="${data.userNo}">${data.name} — ${data.role} (ID: ${data.userNo})</option>`;
    });
    userProfileSelect._allOptions = Array.from(userProfileSelect.options);
}

export async function _refreshUserTableForMode(mode) {
    if (!activeSessionUser) return;
    const ownerId = activeSessionUser.ownerUserNo;
    const usrTbody = document.getElementById("tbl-adm-users");
    if (!usrTbody) return;

    let usrQ;
    if (mode === "CUSTOMER") {
        usrQ = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", ownerId),
            where("role", "==", "CUSTOMER"));
    } else {
        usrQ = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", ownerId),
            where("role", "in", ["MANAGER", "STAFF"]));
    }
    const usrSnap = await getDocs(usrQ);
    usrTbody.innerHTML = "";
    usrSnap.forEach(d => {
        const data = d.data();
        const tr = document.createElement("tr");
        const userNoLink = `<a href="#" class="text-decoration-none fw-bold" onclick="event.preventDefault(); const sel = document.getElementById('usr-select-existing'); if (sel) { sel.value = '${data.userNo}'; sel.dispatchEvent(new Event('change')); }">#${data.userNo}</a>`;

        // Requirement 2d: Add Copy button for CUSTOMER mode
        let actionCell = "-";
        if (mode === "CUSTOMER") {
            const customerNo = data.userNo || "NA";
            const copyBtnId = `copy-btn-${customerNo}`;
            const formattedRegDate = formatDateToDDMMYYYY(data.registrationDate);
            actionCell = `<button type="button" class="btn btn-sm btn-outline-primary copy-customer-btn" id="${copyBtnId}" title="Copy customer details to clipboard" data-customer-no="${customerNo}" data-name="${(data.name || "NA").replace(/"/g, '&quot;')}" data-phone="${data.phone || "NA"}" data-email="${data.email || "NA"}" data-reg-fee="${data.registrationFee !== null && data.registrationFee !== undefined ? data.registrationFee : "NA"}" data-reg-date="${formattedRegDate}">📋 Copy</button>`;
        }

        tr.innerHTML = `<td>${userNoLink}</td><td><span class="badge bg-secondary text-uppercase">${data.role}</span></td><td><strong>${data.name}</strong></td><td>${data.phone || "—"}</td><td>${data.email || "—"}</td><td><span class="badge ${data.active?'bg-success':'bg-secondary'}">${data.active?'Active Card':'Archived'}</span></td><td>${actionCell}</td>`;
        usrTbody.appendChild(tr);
    });

    // Add event listeners to Copy buttons
    document.querySelectorAll(".copy-customer-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            const customerNo = btn.dataset.customerNo;
            const name = btn.dataset.name;
            const phone = btn.dataset.phone;
            const email = btn.dataset.email;
            const regFee = btn.dataset.regFee;
            const regDate = btn.dataset.regDate;

            const text = `Customer#: ${customerNo}\nName: ${name}\nPhone: ${phone}\nEmail: ${email}\nReg Fee: ₹${regFee}\nReg Date: ${regDate}`;

            try {
                await navigator.clipboard.writeText(text);
                alert("✅ Customer details copied to clipboard");
            } catch (err) {
                console.error("Clipboard error:", err);
                alert("Error copying to clipboard. Please try again.");
            }
        });
    });
    setupTblAdmUsersSearch();
}

export function setupTblAdmUsersSearch() {
    const searchInput = document.getElementById("tbl-adm-users-search");
    const clearBtn = document.getElementById("btn-clear-tbl-adm-users-search");
    const usrTbody = document.getElementById("tbl-adm-users");

    if (!searchInput || !usrTbody) return;

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase().trim();
        clearBtn.style.display = query ? "block" : "none";

        Array.from(usrTbody.querySelectorAll("tr")).forEach(tr => {
            const nameCell = tr.cells[2]?.textContent.toLowerCase() || "";
            tr.style.display = nameCell.includes(query) ? "" : "none";
        });
    });

    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
        searchInput.focus();
    });
}

// =========================================================================
// Change Password
// =========================================================================
export async function processChangePasswordSubmission(e) {
    e.preventDefault();
    const oldPwd     = document.getElementById("chpwd-old").value;
    const newPwd     = document.getElementById("chpwd-new").value;
    const confirmPwd = document.getElementById("chpwd-confirm").value;
    const mismatchEl = document.getElementById("chpwd-mismatch-msg");

    // Match new vs confirm
    if (newPwd !== confirmPwd) {
        if (mismatchEl) mismatchEl.style.display = "block";
        document.getElementById("chpwd-confirm").focus();
        return;
    }
    if (mismatchEl) mismatchEl.style.display = "none";

    if (!newPwd.trim()) return alert("Validation Error: New Password cannot be empty.");

    try {
        // Build query to find the logged-in user's document
        let q;
        if (activeSessionUser.role === "MANAGER") {
            // Match both ownerUserNo and userNo for MANAGER
            q = query(collection(db, COL.USERS),
                where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                where("userNo",      "==", activeSessionUser.userNo),
                where("role",        "==", "MANAGER"));
        } else {
            q = query(collection(db, COL.USERS),
                where("userNo", "==", activeSessionUser.userNo));
        }
        const snap = await getDocs(q);
        if (snap.empty) return alert("Error: Could not locate your user record.");

        const userDoc  = snap.docs[0];
        const userData = userDoc.data();

        // Verify old password
        if (userData.password !== oldPwd)
            return alert("Error: Old Password is incorrect.");

        // Update password
        await updateDoc(userDoc.ref, { password: newPwd });
        alert("✅ Password updated successfully.");
        document.getElementById("frm-change-password").reset();
        if (mismatchEl) mismatchEl.style.display = "none";

    } catch(err) { await handleTelemetryAlert("Change Password Submission", err); }
}

// =========================================================================
// Allot Form — Existing Active Package Detection & UI
// =========================================================================
// [_allotExistingPacks imported from state.js]
// [_allotExistingIdx imported from state.js]

