/**
 * main.js — GlamTrack Entry Point
 * All DOM event listeners are wired here directly (no initViewRouterLinks indirection).
 * This is the only file referenced from index.html as type="module".
 */
import { db, COL, _ownerFilter, invalidateServicesCache, invalidateSubServicesCache, invalidateCatalogCache, activeSessionUser, setActiveSessionUser, salonOwnerNameContext, setSalonOwnerNameContext, realtimePacksUnsubscribe, setRealtimePacksUnsubscribe, sessionWatchdogTimer, setSessionWatchdogTimer, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, setAllotExistingPacks, _allotExistingIdx, setAllotExistingIdx, _postRegAllotMode, setPostRegAllotMode, _quickAddCustomerMode, setQuickAddCustomerMode, _utilizeStaffOptions, setUtilizeStaffOptions, utilizePrevUnpaidBalance, setUtilizePrevUnpaidBalance, _oldVisitPrevCalcCost, setOldVisitPrevCalcCost, _oldVisitPrevAddlAmt, setOldVisitPrevAddlAmt, _oldVisitLogDocRef, setOldVisitLogDocRef, INACTIVITY_TIMEOUT_MS } from "./state.js";
import { collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
;
;

// ── Domain module imports ─────────────────────────────────────────────────
import { removeCatalogDeleteButton, appendCatalogDeleteButton, fetchOwnerRecordByCode } from "./db.js";
import { updatePackDiscountDisplay, updatePackSubServicesRunningSum, applyPackTypeUI } from "./ui.js";
import { showActiveFrame, handleTelemetryAlert, processSecureProfileAuthentication, renderAuthorizedWorkspaceSession, performSessionLogoutAction, getHighestFieldOffset, executeDynamicAutopopulateMenuTask } from "./auth.js";
import { renderGlamtrackUnengaged, renderGlamtrackPremium, scrollToGlamtrackSection, openGlamtrackModal, bindRealtimeAnalyticsStream } from "./dashboard.js";
import { renderCatalogSubServicesCheckboxes, processCategoryADMFormSubmission, processServiceADMFormSubmission, processSubServiceFormSubmission, processCommonPackADMFormSubmission } from "./catalog.js";
import { configureUserProfileFormForRole, processUserADMFormSubmission, _updatePasswordRequirementForRole, _updateEmailRequirementForModification, _getQuickAddCustomerModalInstance, openQuickAddCustomerModal, closeQuickAddCustomerModal, restoreUserProfileFormToOriginalLocation, _getPostRegAllotModalInstance, openPostRegAllotModal, closePostRegAllotModal, restoreAllotFormToOriginalLocation, applyUserFormMode, _repopulateUserSelectExisting, _refreshUserTableForMode, processChangePasswordSubmission } from "./customers.js";
import { resetAllotExistingPackUI, hideAllotExtraUIElements, handleAllotCustomerSelectChange, buildAllotExistingReason, showAllotExistingPackAtIndex, navigateAllotExistingPack, handleAllotModifyClick, handleAllotPackSelectChange, updateAllotmentDiscountAndBalance, processAllotmentFormSubmission, processAccessControlFormSubmission, loadPackagesTable, filterPackagesTable, resetPackagesTable } from "./allotment.js";
import { updateCustomerAllottedPacksDropdown, updateCustomerWalletDisplay, displayWalletLedger, _loadStaffOptions, _buildStaffDropdownHtml, _attachStaffDropdownHandler, renderUtilizeSubServicesCheckboxes, renderVisitHistory, updateUtilizeNewUnpaidDisplay, updateUtilizeServicesTotal, resetOldVisitUI, populateOldVisitDates, prefillOldVisitData, deleteOldVisitRecord, _collectServiceProviders, processVisitDeductionFormSubmission, toggleUtilizeSubservicesView } from "./visits.js";
import { refreshAllAdministrativeTables, loadWorkspaceDropdownMappings, refreshPackDropdowns, setupMediaPreviewListener } from "./refresh.js";

document.addEventListener("DOMContentLoaded", () => {
    // initViewRouterLinks body inlined below:
    setupMediaPreviewListener("pack-promo-file", "preview-pack-img");

    const packSubservicesContainer = document.getElementById("container-pack-subservices");
    if (packSubservicesContainer) {
        packSubservicesContainer.addEventListener("change", (e) => {
            if (e.target.matches(".chk-pack-subservice")) {
                updatePackSubServicesRunningSum();
            }
        });
    }

    // Apply Type3 UI on initial load (Type3 is default)
    applyPackTypeUI(document.getElementById("pack-type-select")?.value || "Type3");

    const packTypeSelect = document.getElementById("pack-type-select");
    if (packTypeSelect) {
        packTypeSelect.addEventListener("change", () => {
            applyPackTypeUI(packTypeSelect.value);
            // Re-run sum to sync pack-total-amt when switching back to Type1/Type2
            updatePackSubServicesRunningSum();
        });
    }

    const packSubSearch = document.getElementById("pack-subservices-search");
    if (packSubSearch) {
        packSubSearch.addEventListener("input", () => {
            const term = packSubSearch.value.toLowerCase().trim();
            document.querySelectorAll("#container-pack-subservices .form-check").forEach(item => {
                const label = item.querySelector("label");
                const text = label ? label.textContent.toLowerCase() : "";
                item.style.display = term === "" || text.includes(term) ? "" : "none";
            });
            // [a] Show/hide × button
            const clearBtn = document.getElementById("btn-clear-pack-subservices-search");
            if (clearBtn) clearBtn.style.display = term !== "" ? "" : "none";
        });
    }
    // [a] × button: clear pack-subservices-search and restore all checkboxes
    document.getElementById("btn-clear-pack-subservices-search")?.addEventListener("click", () => {
        const s = document.getElementById("pack-subservices-search");
        if (s) { s.value = ""; s.dispatchEvent(new Event("input")); s.focus(); }
        const btn = document.getElementById("btn-clear-pack-subservices-search");
        if (btn) btn.style.display = "none";
        // Show all hidden checkboxes
        document.querySelectorAll("#container-pack-subservices .form-check").forEach(item => {
            item.style.display = "";
        });
    });

    const utilizeSubSearch = document.getElementById("utilize-subservices-search");
    if (utilizeSubSearch) {
        utilizeSubSearch.addEventListener("input", () => {
            const term = utilizeSubSearch.value.toLowerCase().trim();
            document.querySelectorAll("#container-utilize-subservices .form-check").forEach(item => {
                const label = item.querySelector("label");
                const text = label ? label.textContent.toLowerCase() : "";
                item.style.display = term === "" || text.includes(term) ? "" : "none";
            });
        });
    }

    // ── allot-customer-search: custom listener — no change dispatch while typing ──
    const allotCustSearch = document.getElementById("allot-customer-search");
    if (allotCustSearch) {
        allotCustSearch.addEventListener("input", () => {
            const term = allotCustSearch.value.toLowerCase().trim();
            const sel = document.getElementById("allot-customer-select");
            if (!sel || !sel._allOptions) return;
            const prevVal = sel.value;
            sel.innerHTML = "";
            sel._allOptions.forEach(opt => {
                if (term === "" || opt.text.toLowerCase().includes(term)) {
                    sel.appendChild(opt.cloneNode(true));
                }
            });
            if ([...sel.options].some(o => o.value === prevVal)) {
                sel.value = prevVal;
                // Only fire change if a real customer is selected (not placeholder)
            } else if (term !== "") {
                const ph = document.createElement("option");
                ph.value = ""; ph.text = "-- Choose from Filtered List --";
                sel.insertBefore(ph, sel.options[0]);
                sel.value = "";
            }
            // Show/hide × button
            const btn = document.getElementById("btn-clear-allot-customer-search");
            if (btn) btn.style.display = term !== "" ? "" : "none";
        });
    }
    // × button: clear allot-customer-search + reset dropdown to first option
    document.getElementById("btn-clear-allot-customer-search")?.addEventListener("click", () => {
        const s = document.getElementById("allot-customer-search");
        if (s) { s.value = ""; s.dispatchEvent(new Event("input")); s.focus(); }
        const btn = document.getElementById("btn-clear-allot-customer-search");
        if (btn) btn.style.display = "none";
        const sel = document.getElementById("allot-customer-select");
        if (sel) sel.selectedIndex = 0;
    });

    // ── utilize-customer-search: custom listener (same pattern as sub-select-search) ──
    const utilizeCustSearch = document.getElementById("utilize-customer-search");
    if (utilizeCustSearch) {
        utilizeCustSearch.addEventListener("input", () => {
            const term = utilizeCustSearch.value.toLowerCase().trim();
            const sel = document.getElementById("utilize-customer-select");
            if (!sel || !sel._allOptions) return;
            const prevVal = sel.value;
            sel.innerHTML = "";
            sel._allOptions.forEach(opt => {
                if (term === "" || opt.text.toLowerCase().includes(term)) {
                    sel.appendChild(opt.cloneNode(true));
                }
            });
            if ([...sel.options].some(o => o.value === prevVal)) {
                sel.value = prevVal;
                // Only fire change if the selected value is a real customer (not placeholder)
                // to avoid triggering focus-shift and pack-dropdown reload while user is typing
                if (prevVal) sel.dispatchEvent(new Event("change"));
            } else if (term !== "") {
                // Inject "-- Choose from Filtered List --" to avoid blank
                const ph = document.createElement("option");
                ph.value = ""; ph.text = "-- Choose from Filtered List --";
                sel.insertBefore(ph, sel.options[0]);
                sel.value = "";
                // Do NOT dispatch change here — no real customer selected yet
            }
            // Show/hide × button
            const btn = document.getElementById("btn-clear-utilize-customer-search");
            if (btn) btn.style.display = term !== "" ? "" : "none";
        });
    }

    // × button: clear customer search + restore dropdown to first option
    document.getElementById("btn-clear-utilize-customer-search")?.addEventListener("click", () => {
        const s = document.getElementById("utilize-customer-search");
        if (s) { s.value = ""; s.dispatchEvent(new Event("input")); s.focus(); }
        const btn = document.getElementById("btn-clear-utilize-customer-search");
        if (btn) btn.style.display = "none";
        const sel = document.getElementById("utilize-customer-select");
        if (sel) sel.selectedIndex = 0;
    });

    // Generic search filter helper
    function wireDropdownSearch(searchId, selectId, dispatchChange) {
        const si = document.getElementById(searchId);
        if (!si) return;
        si.addEventListener("input", () => {
            const term = si.value.toLowerCase().trim();
            const sel  = document.getElementById(selectId);
            if (!sel || !sel._allOptions) return;
            const pv   = sel.value;
            sel.innerHTML = "";
            sel._allOptions.forEach(o => {
                if (term === "" || o.text.toLowerCase().includes(term)) sel.appendChild(o.cloneNode(true));
            });
            // Restore previous selection if still present in filtered results
            if ([...sel.options].some(o => o.value === pv)) {
                sel.value = pv;
            } else if (term !== "") {
                // User has typed something and the previous selection is not in filtered results.
                // Inject a placeholder at top so dropdown shows text instead of blank.
                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.text  = "-- Choose from Filtered List --";
                sel.insertBefore(placeholder, sel.options[0]);
                sel.value = "";
            }
            // When term === "" the full _allOptions list (with its own "-- Choose from
            // Available List --" at index 0) is already restored above — no extra action needed.
            if (dispatchChange) sel.dispatchEvent(new Event("change"));
        });
    }
    wireDropdownSearch("sub-select-search",      "sub-select-existing",  false);
    wireDropdownSearch("sub-parent-srv-search",  "sub-parent-srv",       false);

    // ── usr-select-search: inline handler (same pattern as sub-select-search) ──
    {
        const si = document.getElementById("usr-select-search");
        if (si) {
            si.addEventListener("input", () => {
                const term = si.value.toLowerCase().trim();
                const sel = document.getElementById("usr-select-existing");
                if (!sel || !sel._allOptions) return;
                const pv = sel.value;
                sel.innerHTML = "";
                sel._allOptions.forEach(o => {
                    if (term === "" || o.text.toLowerCase().includes(term)) sel.appendChild(o.cloneNode(true));
                });
                if ([...sel.options].some(o => o.value === pv)) {
                    sel.value = pv;
                    // Fire change only if a real user was already selected and still matches
                    if (pv) sel.dispatchEvent(new Event("change"));
                } else if (term !== "") {
                    const ph = document.createElement("option");
                    ph.value = ""; ph.text = "-- Choose from Filtered List --";
                    sel.insertBefore(ph, sel.options[0]);
                    sel.value = "";
                }
                const btn = document.getElementById("btn-clear-usr-select-search");
                if (btn) btn.style.display = term !== "" ? "" : "none";
            });
        }
    }
    // × button: clear usr-select-search + reset dropdown to first option
    document.getElementById("btn-clear-usr-select-search")?.addEventListener("click", () => {
        const s = document.getElementById("usr-select-search");
        if (s) { s.value = ""; s.dispatchEvent(new Event("input")); s.focus(); }
        const btn = document.getElementById("btn-clear-usr-select-search");
        if (btn) btn.style.display = "none";
        const sel = document.getElementById("usr-select-existing");
        if (sel) sel.selectedIndex = 0;
    });

    // ── pack-select-search: inline handler (same pattern as sub-select-search) ──
    {
        const si = document.getElementById("pack-select-search");
        if (si) {
            si.addEventListener("input", () => {
                const term = si.value.toLowerCase().trim();
                const sel = document.getElementById("pack-select-existing");
                if (!sel || !sel._allOptions) return;
                const pv = sel.value;
                sel.innerHTML = "";
                sel._allOptions.forEach(o => {
                    if (term === "" || o.text.toLowerCase().includes(term)) sel.appendChild(o.cloneNode(true));
                });
                if ([...sel.options].some(o => o.value === pv)) {
                    sel.value = pv;
                    // Fire change only if a real pack was already selected and still matches
                    if (pv) sel.dispatchEvent(new Event("change"));
                } else if (term !== "") {
                    const ph = document.createElement("option");
                    ph.value = ""; ph.text = "-- Choose from Filtered List --";
                    sel.insertBefore(ph, sel.options[0]);
                    sel.value = "";
                }
                const btn = document.getElementById("btn-clear-pack-select-search");
                if (btn) btn.style.display = term !== "" ? "" : "none";
            });
        }
    }
    // × button: clear pack-select-search + reset dropdown to first option
    document.getElementById("btn-clear-pack-select-search")?.addEventListener("click", () => {
        const s = document.getElementById("pack-select-search");
        if (s) { s.value = ""; s.dispatchEvent(new Event("input")); s.focus(); }
        const btn = document.getElementById("btn-clear-pack-select-search");
        if (btn) btn.style.display = "none";
        const sel = document.getElementById("pack-select-existing");
        if (sel) sel.selectedIndex = 0;
    });
    // Clear pack-select-search + hide × when a pack is selected from dropdown
    // (handled inside the existing pack-select-existing change listener below)

    // ── allot-pack-search: inline handler (same pattern as sub-select-search) ──
    {
        const si = document.getElementById("allot-pack-search");
        if (si) {
            si.addEventListener("input", () => {
                const term = si.value.toLowerCase().trim();
                const sel = document.getElementById("allot-pack-select");
                if (!sel || !sel._allOptions) return;
                const pv = sel.value;
                sel.innerHTML = "";
                sel._allOptions.forEach(o => {
                    if (term === "" || o.text.toLowerCase().includes(term)) sel.appendChild(o.cloneNode(true));
                });
                if ([...sel.options].some(o => o.value === pv)) {
                    sel.value = pv;
                    // Fire change only when a real pack was previously selected and still matches
                    if (pv) sel.dispatchEvent(new Event("change"));
                } else if (term !== "") {
                    const ph = document.createElement("option");
                    ph.value = ""; ph.text = "-- Choose from Filtered List --";
                    sel.insertBefore(ph, sel.options[0]);
                    sel.value = "";
                }
                const btn = document.getElementById("btn-clear-allot-pack-search");
                if (btn) btn.style.display = term !== "" ? "" : "none";
            });
        }
    }
    // × button: clear allot-pack-search + reset dropdown to first option
    document.getElementById("btn-clear-allot-pack-search")?.addEventListener("click", () => {
        const s = document.getElementById("allot-pack-search");
        if (s) { s.value = ""; s.dispatchEvent(new Event("input")); s.focus(); }
        const btn = document.getElementById("btn-clear-allot-pack-search");
        if (btn) btn.style.display = "none";
        const sel = document.getElementById("allot-pack-select");
        if (sel) sel.selectedIndex = 0;
    });

    // ── utilize-pack-search: inline handler (same pattern as sub-select-search) ──
    {
        const si = document.getElementById("utilize-pack-search");
        if (si) {
            si.addEventListener("input", () => {
                const term = si.value.toLowerCase().trim();
                const sel = document.getElementById("utilize-pack-select");
                if (!sel || !sel._allOptions) return;
                const pv = sel.value;
                sel.innerHTML = "";
                sel._allOptions.forEach(o => {
                    if (term === "" || o.text.toLowerCase().includes(term)) sel.appendChild(o.cloneNode(true));
                });
                if ([...sel.options].some(o => o.value === pv)) {
                    sel.value = pv;
                } else if (term !== "") {
                    const ph = document.createElement("option");
                    ph.value = ""; ph.text = "-- Choose from Filtered List --";
                    sel.insertBefore(ph, sel.options[0]);
                    sel.value = "";
                }
                // Show/hide × button
                const btn = document.getElementById("btn-clear-utilize-pack-search");
                if (btn) btn.style.display = term !== "" ? "" : "none";
            });
        }
    }
    // × button: clear pack search + restore dropdown to first option
    document.getElementById("btn-clear-utilize-pack-search")?.addEventListener("click", () => {
        const s = document.getElementById("utilize-pack-search");
        if (s) { s.value = ""; s.dispatchEvent(new Event("input")); s.focus(); }
        const btn = document.getElementById("btn-clear-utilize-pack-search");
        if (btn) btn.style.display = "none";
        const sel = document.getElementById("utilize-pack-select");
        if (sel) sel.selectedIndex = 0;
    });

    // [a] × clear button for sub-select-search — show/hide as user types
    function _updateSubSelectClearBtn() {
        const s = document.getElementById("sub-select-search");
        const btn = document.getElementById("btn-clear-sub-select-search");
        if (!s || !btn) return;
        btn.style.display = s.value.length > 0 ? "" : "none";
    }
    document.getElementById("sub-select-search")?.addEventListener("input", _updateSubSelectClearBtn);
    // [a+b] clicking × clears field and dispatches input → wireDropdownSearch restores all options
    document.getElementById("btn-clear-sub-select-search")?.addEventListener("click", () => {
        const s = document.getElementById("sub-select-search");
        if (s) { s.value = ""; s.dispatchEvent(new Event("input")); s.focus(); }
        const btn = document.getElementById("btn-clear-sub-select-search");
        if (btn) btn.style.display = "none";
        // [a] Reset dropdown to first option "-- Choose from Available List --"
        const sel = document.getElementById("sub-select-existing");
        if (sel) sel.selectedIndex = 0;
    });

    // [1a from previous] Clear sub-select-search when an item is chosen from sub-select-existing
    document.getElementById("sub-select-existing")?.addEventListener("change", () => {
        const s = document.getElementById("sub-select-search");
        if (s) { s.value = ""; }
        const btn = document.getElementById("btn-clear-sub-select-search");
        if (btn) btn.style.display = "none";
    });

    // [1b from previous] Clear sub-parent-srv-search when sub-parent-srv value is set (selection)
    document.getElementById("sub-parent-srv")?.addEventListener("change", () => {
        const s = document.getElementById("sub-parent-srv-search");
        if (s) { s.value = ""; s.dispatchEvent(new Event("input")); }
        _updateParentSrvClearBtn();
    });

    // [1c / c] × clear button for sub-parent-srv-search — show/hide as user types
    // Dispatches input event so wireDropdownSearch restores all options when cleared
    function _updateParentSrvClearBtn() {
        const s = document.getElementById("sub-parent-srv-search");
        const btn = document.getElementById("btn-clear-parent-srv-search");
        if (!s || !btn) return;
        btn.style.display = s.value.length > 0 ? "" : "none";
    }
    document.getElementById("sub-parent-srv-search")?.addEventListener("input", _updateParentSrvClearBtn);
    document.getElementById("btn-clear-parent-srv-search")?.addEventListener("click", () => {
        const s = document.getElementById("sub-parent-srv-search");
        if (s) {
            s.value = "";
            s.dispatchEvent(new Event("input")); // [c] restores all options in sub-parent-srv
            s.focus();
        }
        const btn = document.getElementById("btn-clear-parent-srv-search");
        if (btn) btn.style.display = "none";
        // [b] Reset dropdown to first option "-- Choose from Available List --"
        const sel = document.getElementById("sub-parent-srv");
        if (sel) sel.selectedIndex = 0;
    });

    const packPriceInput = document.getElementById("pack-price");
    if (packPriceInput) {
        packPriceInput.addEventListener("input", () => {
            const val = parseFloat(packPriceInput.value);
            if (packPriceInput.value !== "" && (isNaN(val) || val <= 0)) packPriceInput.value = "";
            updatePackDiscountDisplay();
        });
    }

    const subRateInput = document.getElementById("sub-rate");
    if (subRateInput) {
        subRateInput.addEventListener("input", () => {
            const val = parseFloat(subRateInput.value);
            if (subRateInput.value !== "" && (isNaN(val) || val <= 0)) subRateInput.value = "";
        });
    }

    const regFeeInput = document.getElementById("usr-reg-fee");
    if (regFeeInput) {
        regFeeInput.addEventListener("input", () => {
            const val = parseFloat(regFeeInput.value);
            if (regFeeInput.value !== "" && (isNaN(val) || val < 0)) regFeeInput.value = "0";
        });
    }

    const utilizeAddlAmtInput = document.getElementById("utilize-addl-amt-received");
    if (utilizeAddlAmtInput) {
        utilizeAddlAmtInput.addEventListener("input", () => {
            const val = parseFloat(utilizeAddlAmtInput.value);
            if (utilizeAddlAmtInput.value !== "" && (isNaN(val) || val < 0)) {
                utilizeAddlAmtInput.value = "0";
            }
            updateUtilizeNewUnpaidDisplay();
        });
    }

    const allotSoldPriceInput = document.getElementById("allot-sold-price");
    if (allotSoldPriceInput) {
        allotSoldPriceInput.addEventListener("input", () => {
            const val = parseFloat(allotSoldPriceInput.value);
            if (allotSoldPriceInput.value !== "" && (isNaN(val) || val <= 0)) {
                allotSoldPriceInput.value = "";
            }
            updateAllotmentDiscountAndBalance();
        });
    }

    const allotAmtReceivedInput = document.getElementById("allot-amount-received");
    if (allotAmtReceivedInput) {
        allotAmtReceivedInput.addEventListener("input", () => {
            const val = parseFloat(allotAmtReceivedInput.value);
            if (allotAmtReceivedInput.value !== "" && (isNaN(val) || val < 0)) {
                allotAmtReceivedInput.value = "0";
            }
            updateAllotmentDiscountAndBalance();
        });
    }

    // ── initViewRouterLinks (nav event wiring) inlined ──────────────
    // GlamTrack brand — show stat-only glamtrack section
    document.getElementById("nav-glamtrack")?.addEventListener("click", async () => {
        // sec-glamtrack is shown only when OWNER is logged in
        if (!activeSessionUser || activeSessionUser.role !== "OWNER") {
            if (!activeSessionUser) showActiveFrame("sec-login");
            return;
        }
        showActiveFrame("sec-glamtrack");
        // Sync the stat count from the live stat-active-packs element
        const src = document.getElementById("stat-active-packs");
        const dst = document.getElementById("stat-active-packs-glamtrack");
        if (src && dst) dst.textContent = src.textContent;
        // Refresh all three lists
        await renderGlamtrackUnengaged();
        await renderGlamtrackPremium();
    });

    // Sign In
    document.getElementById("nav-login").addEventListener("click", () => showActiveFrame("sec-login"));

    // Log Out
    document.getElementById("nav-logout").addEventListener("click", performSessionLogoutAction);

    // Customers > Customer Visit
    document.getElementById("nav-customer-visit")?.addEventListener("click", () => {
        showActiveFrame("sec-visit");
        // [a] Pre-fill today's date for new visit
        const vdEl = document.getElementById("utilize-visit-date");
        if (vdEl && !vdEl.value) vdEl.value = new Date().toISOString().split("T")[0];
        setTimeout(() => document.getElementById("utilize-customer-select")?.focus(), 80);
    });

    // Customers > Customer Registration
    document.getElementById("nav-customer-reg")?.addEventListener("click", () => {
        applyUserFormMode("CUSTOMER");
        showActiveFrame("sec-adm-users");
    });

    // Packages > Package Purchase
    document.getElementById("nav-package-purchase")?.addEventListener("click", () => {
        showActiveFrame("sec-allot");
        // Reset the allot form to clean state (same as clicking Reset button)
        resetAllotExistingPackUI();
        hideAllotExtraUIElements();
        // [1c] Pre-fill today's date as initial Activation Date for new sale
        const startEl = document.getElementById("allot-start-date");
        if (startEl && !startEl.value) startEl.value = new Date().toISOString().split("T")[0];
    });

    // Packages > Package Inventory
    document.getElementById("nav-package-inventory")?.addEventListener("click", () => showActiveFrame("sec-adm-packs"));

    // Services
    document.getElementById("nav-services")?.addEventListener("click", () => {
        showActiveFrame("sec-adm-catalog");
        document.getElementById("frm-adm-subservice").reset();
        document.getElementById("sub-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-sub-delete");
    });

    // Gallery — nav-gallery is permanently hidden; no action needed
    document.getElementById("nav-gallery")?.addEventListener("click", () => {});

    // Admin > Staff Registration
    document.getElementById("nav-staff-reg")?.addEventListener("click", () => {
        applyUserFormMode("MANAGER");
        showActiveFrame("sec-adm-users");
    });

    // Admin > Password Change
    document.getElementById("nav-change-pwd")?.addEventListener("click", () => showActiveFrame("sec-change-password"));

    document.getElementById("frm-change-password")?.addEventListener("submit", processChangePasswordSubmission);

    // Legacy IDs kept for backward compat (no-op, already hidden)
    document.getElementById("nav-adm-users-custstaff")?.addEventListener("click", () => {});
    document.getElementById("nav-adm-users-changepwd")?.addEventListener("click", () => {});
    document.getElementById("nav-adm-catalog")?.addEventListener("click", () => {});
    document.getElementById("nav-adm-packs")?.addEventListener("click", () => {});
    document.getElementById("nav-dashboard")?.addEventListener("click", () => {});

    // UI Change interceptor for structural dual-factor verification
    document.getElementById("txt-login-role").addEventListener("change", (e) => {
        const passwordGroup = document.getElementById("grp-login-pass");
        const existingOtp = document.getElementById("grp-otp-challenge");
        if (existingOtp) existingOtp.remove();

        if (e.target.value === "SUPER_USER") {
            passwordGroup.insertAdjacentHTML('beforebegin', `
                <div class="mb-3" id="grp-otp-challenge">
                    <label class="form-label fw-bold text-danger small">Enter 6-Digit System Admin OTP Security Token</label>
                    <input type="text" class="form-control" id="txt-login-otp" placeholder="e.g., 123456" maxlength="6">
                </div>
            `);
            passwordGroup.style.display = "none";
        } else {
            passwordGroup.style.display = "block";
        }
    });

    document.getElementById("btn-execute-auth").addEventListener("click", processSecureProfileAuthentication);
    document.getElementById("btn-trigger-autopopulate").addEventListener("click", executeDynamicAutopopulateMenuTask);

    // Core Administrative Entity Lifecycle Pipelines
    document.getElementById("frm-adm-category").addEventListener("submit", processCategoryADMFormSubmission);
    document.getElementById("frm-adm-service").addEventListener("submit", processServiceADMFormSubmission);
    document.getElementById("frm-adm-subservice").addEventListener("submit", processSubServiceFormSubmission);
    document.getElementById("btn-reset-subservice")?.addEventListener("click", () => {
        document.getElementById("frm-adm-subservice").reset();
        document.getElementById("sub-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-sub-delete");
        // [c] Restore Reset button caption
        const rstBtn = document.getElementById("btn-reset-subservice");
        if (rstBtn) rstBtn.textContent = "Reset";
        // Restore all options in both filtered dropdowns after reset
        // (programmatic .reset() does NOT fire the DOM reset event,
        // so we restore manually here with term="" → shows all _allOptions)
        setTimeout(() => {
            ["sub-select-search", "sub-parent-srv-search"].forEach(searchId => {
                const si = document.getElementById(searchId);
                if (si && si.value === "") si.dispatchEvent(new Event("input"));
            });
            ["btn-clear-sub-select-search", "btn-clear-parent-srv-search"].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.style.display = "none";
            });
        }, 0);
    });
    document.getElementById("frm-adm-commonpack").addEventListener("submit", processCommonPackADMFormSubmission);
    document.getElementById("btn-reset-commonpack")?.addEventListener("click", async () => {
        document.getElementById("frm-adm-commonpack").reset();
        document.getElementById("pack-active").checked = true;
        document.getElementById("pack-type-select").value = "Type3"; applyPackTypeUI("Type3");
        const discEl = document.getElementById("pack-discount-display");
        if (discEl) discEl.textContent = "";
        removeCatalogDeleteButton("btn-dynamic-pack-delete");
        renderCatalogSubServicesCheckboxes();
        await refreshPackDropdowns();
        // [1] Restore Reset caption
        const rstBtn = document.getElementById("btn-reset-commonpack");
        if (rstBtn) rstBtn.textContent = "Reset";
        // Restore pack-select-search
        const psrch = document.getElementById("pack-select-search");
        if (psrch) { psrch.value = ""; psrch.dispatchEvent(new Event("input")); }
        const pbtn = document.getElementById("btn-clear-pack-select-search");
        if (pbtn) pbtn.style.display = "none";
        // [a] Clear pack-subservices-search and show all checkboxes
        const subSrch = document.getElementById("pack-subservices-search");
        if (subSrch) { subSrch.value = ""; subSrch.dispatchEvent(new Event("input")); }
        const subBtn = document.getElementById("btn-clear-pack-subservices-search");
        if (subBtn) subBtn.style.display = "none";
    });

    document.getElementById("frm-adm-user-profile").addEventListener("submit", processUserADMFormSubmission);
    document.getElementById("usr-role")?.addEventListener("change", (e) => {
        // Only relevant in MANAGER/STAFF (Staff Registration) mode — CUSTOMER mode hides the row entirely
        const currentMode = document.getElementById("sec-adm-users")?.dataset?.userMode;
        if (currentMode === "MANAGER") {
            // Requirement 1e: If role becomes blank, default to STAFF
            if (!e.target.value || e.target.value === "") {
                e.target.value = "STAFF";
            }
            _updatePasswordRequirementForRole(e.target.value);
            // When modifying a record, email should stay optional regardless of role
            const existingUserNo = document.getElementById("usr-select-existing").value;
            if (existingUserNo) {
                _updateEmailRequirementForModification(true);
            } else {
                _updateEmailRequirementForModification(false);
            }
        }
    });
    document.getElementById("btn-reset-userprofile")?.addEventListener("click", () => {
        // Quick-add mode (opened via "+" in Sell Package form): just close the modal
        if (_quickAddCustomerMode) {
            closeQuickAddCustomerModal();
            return;
        }
        document.getElementById("frm-adm-user-profile").reset();
        document.getElementById("usr-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-usr-delete");
        if (activeSessionUser) configureUserProfileFormForRole(activeSessionUser.role);
        const _mMsg = document.getElementById("usr-pwd-mismatch-msg"); if (_mMsg) _mMsg.style.display = "none";
        // Re-apply the current mode (CUSTOMER or MANAGER) so dynamic UI state is preserved
        const currentMode = document.getElementById("sec-adm-users")?.dataset?.userMode;
        if (currentMode) applyUserFormMode(currentMode);
        // [c] Restore Reset button caption
        const rstBtn = document.getElementById("btn-reset-userprofile");
        if (rstBtn) rstBtn.textContent = "Reset";
        // [a] Restore usr-select-search: fire input (term="") to show all options, hide ×
        const usrSrch = document.getElementById("usr-select-search");
        if (usrSrch) { usrSrch.value = ""; usrSrch.dispatchEvent(new Event("input")); }
        const usrBtn = document.getElementById("btn-clear-usr-select-search");
        if (usrBtn) usrBtn.style.display = "none";
    });

    // "+" Quick-add Customer button next to allot-customer-select
    // Moves the EXISTING #card-user-profile-form node (containing frm-adm-user-profile)
    // into the quick-add modal shell. The normal Customer Registration nav flow is
    // completely untouched — it always shows this same node inline in #sec-adm-users.
    document.getElementById("btn-quick-add-customer")?.addEventListener("click", () => {
        applyUserFormMode("CUSTOMER");
        openQuickAddCustomerModal();
    });
    // Initialize Bootstrap tooltip for the "+" button
    const quickAddBtnEl = document.getElementById("btn-quick-add-customer");
    if (quickAddBtnEl && window.bootstrap?.Tooltip) {
        new bootstrap.Tooltip(quickAddBtnEl);
    }

    // Whenever the quick-add modal closes by any means (Close btn, Esc, backdrop),
    // move the form node BACK to its original home in #sec-adm-users
    document.getElementById("modal-quick-add-customer")?.addEventListener("hidden.bs.modal", () => {
        restoreUserProfileFormToOriginalLocation();
    });

    document.getElementById("modal-post-reg-allot")?.addEventListener("hidden.bs.modal", () => {
        restoreAllotFormToOriginalLocation();
    });

    document.getElementById("frm-allot-membership").addEventListener("submit", processAllotmentFormSubmission);
    document.getElementById("btn-reset-allot")?.addEventListener("click", () => {
        // If inside the post-customer-reg modal, just close it
        if (_postRegAllotMode) {
            closePostRegAllotModal();
            return;
        }
        // Normal inline flow — full reset as before
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
        if (psrch) { psrch.value = ""; psrch.dispatchEvent(new Event("input")); }
        // Hide both × clear buttons
        ["btn-clear-allot-customer-search", "btn-clear-allot-pack-search"].forEach(id => {
            const b = document.getElementById(id); if (b) b.style.display = "none";
        });
        resetAllotExistingPackUI();
        hideAllotExtraUIElements();
        resetPackagesTable();
        const startEl = document.getElementById("allot-start-date");
        if (startEl) startEl.value = new Date().toISOString().split("T")[0];
    });

    document.getElementById("btn-allot-modify")?.addEventListener("click", handleAllotModifyClick);
    document.getElementById("btn-allot-delete")?.addEventListener("click", async () => {
        const p = _allotExistingPacks?.[_allotExistingIdx];
        if (!p) return;

        // Delete guard: remainingBalance cannot be less than soldPrice
        const remainingBalance = parseFloat(p.remainingBalance || 0);
        const soldPrice = parseFloat(p.soldPrice || 0);
        if (remainingBalance < soldPrice) {
            return alert(`❌ Cannot delete this package.\n\nRemaining Balance (₹${remainingBalance.toLocaleString("en-IN")}) cannot be less than Sold Price (₹${soldPrice.toLocaleString("en-IN")}).\n\nPlease settle the balance first.`);
        }

        if (!confirm(`⚠️ Delete the package "${p.packName}" allotted to "${p.customerName}"?\nThis cannot be undone.`)) return;
        try {
            const q = query(collection(db, COL.CUST_PACKS),
                where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                where("allotId",     "==", p.allotId),
                where("customerNo",  "==", p.customerNo));
            const snap = await getDocs(q);
            if (snap.empty) return alert("Error: Package record not found.");
            await deleteDoc(snap.docs[0].ref);
            alert("✅ Package allotment deleted successfully.");
            resetAllotExistingPackUI();
            hideAllotExtraUIElements();
            document.getElementById("frm-allot-membership")?.reset();
            const custSel = document.getElementById("allot-customer-select");
            if (custSel) custSel.selectedIndex = 0;
            resetPackagesTable();
        } catch (err) {
            handleTelemetryAlert("Allotment Delete", err);
            alert("Error deleting package allotment. Please try again.");
        }
    });
    document.getElementById("btn-allot-prev")?.addEventListener("click", () => { navigateAllotExistingPack(-1); });
    document.getElementById("btn-allot-next")?.addEventListener("click", () => { navigateAllotExistingPack(1); });

    // [d] Payment History button — opens popup showing all payment receipts for current pack
    document.getElementById("btn-payment-history")?.addEventListener("click", async () => {
        const p = _allotExistingPacks?.[_allotExistingIdx];
        if (!p) return;

        const tbody = document.getElementById("tbl-payment-history");
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted small py-2">Loading…</td></tr>`;

        // Position modal near the ledger button before showing
        const modalEl = document.getElementById("modal-payment-history");
        const btnEl = document.getElementById("btn-payment-history");
        if (modalEl && btnEl) {
            // Blur the trigger button before showing to prevent aria-hidden focus conflict
            if (document.activeElement) document.activeElement.blur();
            const rect = btnEl.getBoundingClientRect();
            const dialogEl = modalEl.querySelector(".modal-dialog");
            if (dialogEl) {
                const dialogW = 280;
                let left = rect.right - dialogW + window.scrollX;
                let top  = rect.bottom + 8 + window.scrollY;
                left = Math.max(8, Math.min(left, window.innerWidth - dialogW - 8));
                dialogEl.style.position = "absolute";
                dialogEl.style.margin   = "0";
                dialogEl.style.left     = left + "px";
                dialogEl.style.top      = top  + "px";
            }
            const bsModal = new bootstrap.Modal(modalEl);
            bsModal.show();
        }

        try {
            tbody.innerHTML = "";

            // Row 1: Initial payment from customerServicePacks
            let createdDateStr = "—";
            if (p.createdAt) {
                const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
                createdDateStr = d.toISOString().substring(0, 10);
            }
            const initAmt = Number(p.amountReceived || 0);
            const tr0 = document.createElement("tr");
            tr0.className = "table-success";
            tr0.innerHTML = `<td class="text-nowrap">${createdDateStr} <span class="badge bg-success ms-1">Initial</span></td>
                             <td class="text-end fw-bold">₹${initAmt.toLocaleString("en-IN")}</td>`;
            tbody.appendChild(tr0);

            // Subsequent rows: addlAmtReceived > 0 from serviceUtilizationLogs
            const logsSnap = await getDocs(query(
                collection(db, COL.VISIT_LOGS),
                where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                where("customerNo",  "==", p.customerNo),
                where("allotId",     "==", p.allotId)
            ));

            const visitRows = [];
            logsSnap.forEach(d => {
                const l = d.data();
                if (Number(l.addlAmtReceived || 0) > 0) {
                    visitRows.push({ date: l.visitDate || "—", amt: Number(l.addlAmtReceived) });
                }
            });
            // Sort by date ascending
            visitRows.sort((a, b) => a.date.localeCompare(b.date));
            visitRows.forEach(row => {
                const tr = document.createElement("tr");
                tr.innerHTML = `<td class="text-nowrap">${row.date}</td>
                                <td class="text-end fw-bold">₹${row.amt.toLocaleString("en-IN")}</td>`;
                tbody.appendChild(tr);
            });

            if (visitRows.length === 0 && initAmt === 0) {
                tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted small py-2">No payments recorded yet.</td></tr>`;
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="2" class="text-danger small py-2">Error loading payment history.</td></tr>`;
            handleTelemetryAlert("Payment History Popup", err);
        }
    });

    // Initialize Bootstrap tooltip for payment history button
    const payHistBtn = document.getElementById("btn-payment-history");
    if (payHistBtn && window.bootstrap?.Tooltip) new bootstrap.Tooltip(payHistBtn);

    // Wallet Ledger button click handler
    document.getElementById("btn-wallet-ledger")?.addEventListener("click", async () => {
        const custNo = document.getElementById("utilize-customer-select").value;
        if (!custNo) {
            alert("Please select a customer first.");
            return;
        }

        await displayWalletLedger();
        const modalEl = document.getElementById("modal-wallet-ledger");
        if (modalEl) {
            if (document.activeElement) document.activeElement.blur();
            const bsModal = new bootstrap.Modal(modalEl);
            bsModal.show();

            modalEl.addEventListener("hidden.bs.modal", () => {
                if (document.activeElement) document.activeElement.blur();
            }, { once: true });
        }
    });

    // Initialize Bootstrap tooltip for wallet ledger button
    const walletBtn = document.getElementById("btn-wallet-ledger");
    if (walletBtn && window.bootstrap?.Tooltip) new bootstrap.Tooltip(walletBtn);

    // Core Security Configuration Form Submit Pipelines
    document.getElementById("frm-access-control-matrix")?.addEventListener("submit", processAccessControlFormSubmission);
    document.getElementById("frm-utilize-service-visit")?.addEventListener("submit", processVisitDeductionFormSubmission);
    document.getElementById("btn-reset-utilize")?.addEventListener("click", () => {
        document.getElementById("frm-utilize-service-visit").reset();
        // Re-check "New Visit" radio (reset() clears radio group)
        const newVisitRadio = document.getElementById("utilize-visit-new");
        if (newVisitRadio) newVisitRadio.checked = true;
        resetOldVisitUI();
        document.getElementById("container-utilize-subservices").innerHTML = "";
        setUtilizePrevUnpaidBalance(0);
        const financialEl = document.getElementById("utilize-pack-financial");
        if (financialEl) financialEl.style.display = "none";
        const totalEl = document.getElementById("utilize-services-total");
        if (totalEl) { totalEl.style.display = "none"; totalEl.textContent = ""; }
        const newUnpaidEl = document.getElementById("utilize-new-unpaid-display");
        if (newUnpaidEl) newUnpaidEl.textContent = "";
        const srch = document.getElementById("utilize-customer-search");
        if (srch) { srch.value = ""; srch.dispatchEvent(new Event("input")); }
        const psrch = document.getElementById("utilize-pack-search");
        if (psrch) { psrch.value = ""; psrch.dispatchEvent(new Event("input")); }
        // Hide both × clear buttons
        ["btn-clear-utilize-customer-search","btn-clear-utilize-pack-search"].forEach(id => {
            const b = document.getElementById(id); if (b) b.style.display = "none";
        });
        const histPanel = document.getElementById("utilize-visit-history");
        if (histPanel) histPanel.style.display = "none";
        // [a] Restore today's date after reset
        const vdEl = document.getElementById("utilize-visit-date");
        if (vdEl) vdEl.value = new Date().toISOString().split("T")[0];
        // [b] Restore Reset button caption after cancel
        const resetBtn = document.getElementById("btn-reset-utilize");
        if (resetBtn) resetBtn.textContent = "Reset";
    });

    // Automated reactive lookups processing links
    document.getElementById("utilize-customer-select")?.addEventListener("change", async () => {
        // Clear customer search + hide × when a customer is selected
        const csrch = document.getElementById("utilize-customer-search");
        if (csrch) csrch.value = "";
        const cbtn = document.getElementById("btn-clear-utilize-customer-search");
        if (cbtn) cbtn.style.display = "none";
        resetOldVisitUI();
        updateCustomerAllottedPacksDropdown();
        await updateCustomerWalletDisplay();
        setTimeout(() => document.getElementById("utilize-pack-select")?.focus(), 80);
    });
    document.getElementById("utilize-pack-select")?.addEventListener("change", async () => {
        // Clear pack search + hide × when a package is selected
        const psrch = document.getElementById("utilize-pack-search");
        if (psrch) psrch.value = "";
        const pbtn = document.getElementById("btn-clear-utilize-pack-search");
        if (pbtn) pbtn.style.display = "none";
        resetOldVisitUI();
        renderUtilizeSubServicesCheckboxes();
        const allotId = document.getElementById("utilize-pack-select")?.value;
        const custNo  = document.getElementById("utilize-customer-select")?.value;
        if (allotId && custNo) await renderVisitHistory(allotId, custNo);
        setTimeout(() => document.getElementById("container-utilize-subservices")?.focus(), 80);
    });

    // Radio button: show/hide old-visit dropdown
    document.getElementById("utilize-visit-new")?.addEventListener("change", () => {
        resetOldVisitUI();
        // [2c] Set today's date as default for new visit
        const vdEl = document.getElementById("utilize-visit-date");
        if (vdEl) vdEl.value = new Date().toISOString().split("T")[0];
        // [b] Restore Reset caption when switching back to New Visit
        const resetBtn = document.getElementById("btn-reset-utilize");
        if (resetBtn) resetBtn.textContent = "Reset";
    });
    document.getElementById("utilize-visit-old")?.addEventListener("change", async () => {
        // [b] Change Reset caption to Cancel when Modify Old Visit is selected
        const resetBtn = document.getElementById("btn-reset-utilize");
        if (resetBtn) resetBtn.textContent = "Cancel";
        await populateOldVisitDates();
    });

    // Old visit date selected → pre-fill form
    document.getElementById("utilize-old-visit-date-select")?.addEventListener("change", () => prefillOldVisitData());

    // Delete button for old visit
    document.getElementById("btn-utilize-delete")?.addEventListener("click", () => deleteOldVisitRecord());
    // Toggle subservices view (full vs. checked-only)
    document.getElementById("btn-toggle-subservices")?.addEventListener("click", (e) => {
        e.preventDefault();
        toggleUtilizeSubservicesView();
    });
    document.getElementById("allot-pack-select")?.addEventListener("change", handleAllotPackSelectChange);
    document.getElementById("allot-customer-select")?.addEventListener("change", async () => {
        // Clear customer search + hide × when a real customer is selected
        const csrch = document.getElementById("allot-customer-search");
        if (csrch) csrch.value = "";
        const cbtn = document.getElementById("btn-clear-allot-customer-search");
        if (cbtn) cbtn.style.display = "none";
        handleAllotCustomerSelectChange();
        // Load all packages for selected customer
        const custSel = document.getElementById("allot-customer-select");
        if (custSel?.value) await loadPackagesTable(custSel.value);
    });
    document.getElementById("allot-pack-select")?.addEventListener("change", () => {
        // Clear pack search + hide × when a pack is selected
        const psrch = document.getElementById("allot-pack-search");
        if (psrch) psrch.value = "";
        const pbtn = document.getElementById("btn-clear-allot-pack-search");
        if (pbtn) pbtn.style.display = "none";
    });

    // Packages table search box
    document.getElementById("allot-packages-search")?.addEventListener("input", (e) => {
        const searchText = e.target.value || "";
        const clearBtn = document.getElementById("btn-clear-allot-packages-search");
        if (clearBtn) clearBtn.style.display = searchText ? "block" : "none";
        filterPackagesTable(searchText);
    });
    document.getElementById("btn-clear-allot-packages-search")?.addEventListener("click", (e) => {
        e.preventDefault();
        const searchField = document.getElementById("allot-packages-search");
        if (searchField) {
            searchField.value = "";
            searchField.dispatchEvent(new Event("input"));
        }
    });

    document.getElementById("cat-select-existing")?.addEventListener("change", async (e) => {
        const selectedCode = e.target.value ? e.target.value.trim() : "";
        removeCatalogDeleteButton("btn-dynamic-cat-delete");

        if (!selectedCode) {
            document.getElementById("frm-adm-category").reset();
            document.getElementById("cat-active").checked = true;
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("serviceCategories", "catCode", selectedCode);
            if (!targetDoc) {
                console.warn(`No category record matched code signature: ${selectedCode}`);
                return;
            }

            const itemData = targetDoc.data();
            document.getElementById("cat-name").value = itemData.catName || "";
            document.getElementById("cat-desc").value = itemData.catDescription || "";
            document.getElementById("cat-active").checked = itemData.active === true;

            appendCatalogDeleteButton({
                formId: "frm-adm-category",
                buttonId: "btn-dynamic-cat-delete",
                itemName: itemData.catName || selectedCode,
                targetDocRef: targetDoc.ref,
                onDeleted: () => {
                    document.getElementById("frm-adm-category").reset();
                    document.getElementById("cat-active").checked = true;
                    removeCatalogDeleteButton("btn-dynamic-cat-delete");
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                }
            });
        } catch (err) {
            handleTelemetryAlert("Category Autofill Pipeline", err);
        }
    });

    document.getElementById("srv-select-existing")?.addEventListener("change", async (e) => {
        const selectedCode = e.target.value ? e.target.value.trim() : "";
        removeCatalogDeleteButton("btn-dynamic-srv-delete");

        if (!selectedCode) {
            document.getElementById("frm-adm-service").reset();
            document.getElementById("srv-active").checked = true;
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("services", "serviceCode", selectedCode);
            if (!targetDoc) {
                console.warn(`No service record matched code signature: ${selectedCode}`);
                return;
            }

            const itemData = targetDoc.data();
            document.getElementById("srv-parent-cat").value = itemData.catCode || "";
            document.getElementById("srv-name").value = itemData.serviceName || "";
            document.getElementById("srv-desc").value = itemData.serviceDescription || "";
            document.getElementById("srv-active").checked = itemData.active === true;

            appendCatalogDeleteButton({
                formId: "frm-adm-service",
                buttonId: "btn-dynamic-srv-delete",
                itemName: itemData.serviceName || selectedCode,
                targetDocRef: targetDoc.ref,
                onDeleted: () => {
                    document.getElementById("frm-adm-service").reset();
                    document.getElementById("srv-active").checked = true;
                    removeCatalogDeleteButton("btn-dynamic-srv-delete");
                    invalidateServicesCache(); // service deleted — only services cache cleared
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                }
            });
        } catch (err) {
            handleTelemetryAlert("Service Autofill Pipeline", err);
        }
    });

    document.getElementById("usr-select-existing")?.addEventListener("change", async (e) => {
        const selectedUserNo = e.target.value ? e.target.value.trim() : "";
        // Clear search + hide × whenever selection changes
        const usrSrch = document.getElementById("usr-select-search");
        if (usrSrch) usrSrch.value = "";
        const usrBtn = document.getElementById("btn-clear-usr-select-search");
        if (usrBtn) usrBtn.style.display = "none";
        removeCatalogDeleteButton("btn-dynamic-usr-delete");

        if (!selectedUserNo) {
            document.getElementById("frm-adm-user-profile").reset();
            document.getElementById("usr-active").checked = true;
            _updateEmailRequirementForModification(false);
            // Restore Reset button caption
            const resetBtn = document.getElementById("btn-reset-userprofile");
            if (resetBtn) resetBtn.textContent = "Reset";
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("users", "userNo", selectedUserNo);
            if (!targetDoc) {
                console.warn(`No user profile matched ID: ${selectedUserNo}`);
                return;
            }

            const itemData = targetDoc.data();

            // [g/f] Only populate if the retrieved record's role matches the current form mode
            const currentMode = document.getElementById("sec-adm-users")?.dataset?.userMode;
            if (currentMode === "CUSTOMER" && itemData.role !== "CUSTOMER") {
                alert("Selected profile is not a Customer record.");
                document.getElementById("usr-select-existing").value = "";
                return;
            }
            if (currentMode === "MANAGER") {
                // In Staff Registration mode, only MANAGER or STAFF records are valid
                if (itemData.role !== "MANAGER" && itemData.role !== "STAFF") {
                    alert("Selected profile is not a Staff or Manager record.");
                    document.getElementById("usr-select-existing").value = "";
                    return;
                }
                // (f) Additionally, if usr-role dropdown already has a specific role chosen,
                // the retrieved record's role must match it exactly
                const chosenRole = document.getElementById("usr-role")?.value;
                if (chosenRole && chosenRole !== "" && chosenRole !== itemData.role) {
                    const confirmed = confirm(
                        `The selected profile is a "${itemData.role}" but you have "${chosenRole}" selected in the Role dropdown.\n\n` +
                        `The Role dropdown will be updated to "${itemData.role}". Do you want to continue?`
                    );
                    if (!confirmed) {
                        document.getElementById("usr-select-existing").value = "";
                        return;
                    }
                }
            }

            // Requirement 1c: Initialize UI elements first before updating values
            document.getElementById("frm-adm-user-profile").reset();
            document.getElementById("usr-active").checked = true;
            _updateEmailRequirementForModification(false);

            // Now update values with retrieved data
            document.getElementById("usr-role").value = itemData.role || "";
            document.getElementById("usr-fullname").value = itemData.name || "";
            document.getElementById("usr-sex").value = itemData.sex || "F";
            document.getElementById("usr-age").value = itemData.ageGroup || "";
            document.getElementById("usr-email").value = itemData.email || "";
            document.getElementById("usr-password").value = itemData.password || "";
            document.getElementById("usr-phone").value = itemData.phone || "";
            document.getElementById("usr-distance").value = itemData.distance !== undefined ? itemData.distance : "";
            document.getElementById("usr-address").value = itemData.address || "";
            document.getElementById("usr-mapurl").value = itemData.googleMapLink || "";
            document.getElementById("usr-active").checked = itemData.active === true;
            const regFeeEl = document.getElementById("usr-reg-fee");
            if (regFeeEl) regFeeEl.value = itemData.registrationFee !== null && itemData.registrationFee !== undefined ? itemData.registrationFee : "";
            const regDateEl = document.getElementById("usr-reg-date");
            if (regDateEl) {
                const rawDate = itemData.registrationDate || "";
                // Normalise to yyyy-MM-dd regardless of whether stored as ISO timestamp or plain date
                regDateEl.value = rawDate ? rawDate.substring(0, 10) : "";
            }

            _updateEmailRequirementForModification(true);

            appendCatalogDeleteButton({
                formId: "frm-adm-user-profile",
                buttonId: "btn-dynamic-usr-delete",
                itemName: itemData.name || selectedUserNo,
                targetDocRef: targetDoc.ref,
                onDeleted: () => {
                    document.getElementById("frm-adm-user-profile").reset();
                    document.getElementById("usr-active").checked = true;
                    _updateEmailRequirementForModification(false);
                    removeCatalogDeleteButton("btn-dynamic-usr-delete");
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                    const _delMode = document.getElementById("sec-adm-users")?.dataset?.userMode;
                    if (_delMode) {
                        applyUserFormMode(_delMode);
                        _refreshUserTableForMode(_delMode);
                    }
                    // [c] Restore Reset caption after delete
                    const rstBtnD = document.getElementById("btn-reset-userprofile");
                    if (rstBtnD) rstBtnD.textContent = "Reset";
                },
                preDeleteConfirm: itemData.role === "OWNER"
                    ? () => {
                        if (!confirm(
                            `⚠️ WARNING: You are about to delete the Owner profile "${itemData.name || selectedUserNo}".

` +
                            `All data linked to this owner (sub-services, packages, customer profiles, visit logs) ` +
                            `will NOT be automatically removed from the database — it must be cleaned up manually.

` +
                            `Are you sure you want to proceed?`
                        )) return false;
                        return confirm(
                            `Final confirmation: Permanently delete Owner "${itemData.name || selectedUserNo}"?

This cannot be undone.`
                        );
                    }
                    : (itemData.role === "CUSTOMER")
                    ? async () => {
                        // [1b] Effective ownerUserNo for comparison
                        const effectiveOwnerId = _ownerFilter();

                        // [1c] Check if customer has any record in customerServicePacks
                        const packSnap = await getDocs(query(
                            collection(db, COL.CUST_PACKS),
                            where("ownerUserNo", "==", effectiveOwnerId),
                            where("customerNo",  "==", itemData.userNo)
                        ));
                        if (!packSnap.empty) {
                            alert("This Customer has already been sold a Package, CANNOT delete.");
                            return false;
                        }
                        return confirm(`Are you absolutely sure you want to permanently delete "${itemData.name || selectedUserNo}"? This action cannot be reversed.`);
                    }
                    : (itemData.role === "MANAGER" || itemData.role === "STAFF")
                    ? async () => {
                        // [1b from staff req] Effective ownerUserNo for comparison
                        const effectiveOwnerId = _ownerFilter();

                        // Check serviceUtilizationLogs serviceProviders array for this staff's userNo
                        const logsSnap = await getDocs(query(
                            collection(db, COL.VISIT_LOGS),
                            where("ownerUserNo", "==", effectiveOwnerId)
                        ));
                        const staffUserNo = itemData.userNo;
                        let foundInVisit = false;
                        logsSnap.forEach(d => {
                            if (foundInVisit) return;
                            const providers = d.data().serviceProviders || [];
                            if (providers.some(sp => sp.userNo === staffUserNo)) {
                                foundInVisit = true;
                            }
                        });
                        if (foundInVisit) {
                            alert("Staff's record already Exists in Customer Visits, CANNOT delete this User.");
                            return false;
                        }
                        return confirm(`Are you absolutely sure you want to permanently delete "${itemData.name || selectedUserNo}"? This action cannot be reversed.`);
                    }
                    : undefined
            });

            // [c] Change Reset button to "Cancel" when a record is loaded
            const resetBtn = document.getElementById("btn-reset-userprofile");
            if (resetBtn && !_quickAddCustomerMode) resetBtn.textContent = "Cancel";

        } catch (err) {
            handleTelemetryAlert("User Profile Autofill Pipeline", err);
        }
    });

    document.getElementById("pack-select-existing")?.addEventListener("change", async (e) => {
        const selectedPackName = e.target.value ? e.target.value.trim() : "";
        // Clear search box + hide × whenever a selection is made (including placeholder)
        const psrch = document.getElementById("pack-select-search");
        if (psrch) psrch.value = "";
        const pbtn = document.getElementById("btn-clear-pack-select-search");
        if (pbtn) pbtn.style.display = "none";
        removeCatalogDeleteButton("btn-dynamic-pack-delete");

        if (!selectedPackName) {
            document.getElementById("frm-adm-commonpack").reset();
            document.getElementById("pack-active").checked = true;
            document.getElementById("pack-type-select").value = "Type3"; applyPackTypeUI("Type3");
            const discEl = document.getElementById("pack-discount-display");
            if (discEl) discEl.textContent = "";
            renderCatalogSubServicesCheckboxes();
            // [1] Restore Reset caption on blank selection
            const rstBtn = document.getElementById("btn-reset-commonpack");
            if (rstBtn) rstBtn.textContent = "Reset";
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("commonServicePacks", "packName", selectedPackName);
            if (!targetDoc) {
                console.warn(`No package record matched name: ${selectedPackName}`);
                return;
            }

            const itemData = targetDoc.data();
            document.getElementById("pack-name-id").value = itemData.packName || "";
            const loadedType = itemData.packType || "Type3";
            document.getElementById("pack-type-select").value = loadedType; applyPackTypeUI(loadedType);
            document.getElementById("pack-total-amt").value = itemData.totalAmount !== undefined ? itemData.totalAmount : "";
            document.getElementById("pack-price").value = itemData.offerPrice !== undefined ? itemData.offerPrice : "";
            document.getElementById("pack-active").checked = itemData.active === true;
            updatePackDiscountDisplay();

            await renderCatalogSubServicesCheckboxes();
            const selectedCodes = itemData.subServicesArray || [];
            document.querySelectorAll(".chk-pack-subservice").forEach((input) => {
                input.checked = selectedCodes.includes(input.value);
            });
            updatePackSubServicesRunningSum();

            appendCatalogDeleteButton({
                formId: "frm-adm-commonpack",
                buttonId: "btn-dynamic-pack-delete",
                itemName: itemData.packName || selectedPackName,
                targetDocRef: targetDoc.ref,
                preDeleteConfirm: async () => {
                    const aQ = query(collection(db, COL.CUST_PACKS),
                        where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                        where("packName",    "==", selectedPackName));
                    const aSnap = await getDocs(aQ);
                    if (!aSnap.empty) {
                        alert(`⚠️ Deletion Blocked: "${selectedPackName}" is allotted to ${aSnap.size} customer(s). Create a new package instead.`);
                        return false;
                    }
                    return confirm(`Permanently delete "${itemData.packName || selectedPackName}"? Cannot be undone.`);
                },
                onDeleted: () => {
                    document.getElementById("frm-adm-commonpack").reset();
                    document.getElementById("pack-active").checked = true;
                    document.getElementById("pack-type-select").value = "Type3"; applyPackTypeUI("Type3");
                    const discEl = document.getElementById("pack-discount-display");
                    if (discEl) discEl.textContent = "";
                    removeCatalogDeleteButton("btn-dynamic-pack-delete");
                    renderCatalogSubServicesCheckboxes();
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                    // [1] Restore Reset caption after delete
                    const rstBtn = document.getElementById("btn-reset-commonpack");
                    if (rstBtn) rstBtn.textContent = "Reset";
                }
            });

            // [1] Change Reset button to Cancel when record is loaded
            const rstBtnLoaded = document.getElementById("btn-reset-commonpack");
            if (rstBtnLoaded) rstBtnLoaded.textContent = "Cancel";
        } catch (err) {
            handleTelemetryAlert("Package Autofill Pipeline", err);
        }
    });

    document.getElementById("sub-select-existing")?.addEventListener("change", async (e) => {
        const selectedCode = e.target.value ? e.target.value.trim() : "";
        removeCatalogDeleteButton("btn-dynamic-sub-delete");

        if (!selectedCode) {
            document.getElementById("frm-adm-subservice").reset();
            document.getElementById("sub-active").checked = true;
            const rstBtn = document.getElementById("btn-reset-subservice");
            if (rstBtn) rstBtn.textContent = "Reset";
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("subServices", "subServiceCode", selectedCode);
            if (!targetDoc) {
                console.warn(`No collection record matched code signature: ${selectedCode}`);
                return;
            }

            const itemData = targetDoc.data();
            document.getElementById("sub-parent-srv").value = itemData.serviceCode || "";
            // [1b] Clear the search box whenever sub-parent-srv is populated programmatically
            const _pSearch = document.getElementById("sub-parent-srv-search");
            if (_pSearch) { _pSearch.value = ""; }
            const _pClearBtn = document.getElementById("btn-clear-parent-srv-search");
            if (_pClearBtn) _pClearBtn.style.display = "none";
            document.getElementById("sub-name").value = itemData.subServiceName || "";
            document.getElementById("sub-rate").value = (itemData.rate !== undefined && !isNaN(Number(itemData.rate))) ? itemData.rate : "";
            document.getElementById("sub-duration").value = itemData.durationMinutes || "";
            document.getElementById("sub-gender").value = itemData.sex || "";
            document.getElementById("sub-active").checked = itemData.active === true;

            appendCatalogDeleteButton({
                formId: "frm-adm-subservice",
                buttonId: "btn-dynamic-sub-delete",
                itemName: itemData.subServiceName || selectedCode,
                targetDocRef: targetDoc.ref,
                preDeleteConfirm: async () => {
                    // [point a] Effective ownerUserNo for comparison
                    const effectiveOwnerId = _ownerFilter();

                    // [point b] Check if this subServiceCode is in any commonServicePacks subServicesArray
                    const packCheckSnap = await getDocs(query(
                        collection(db, COL.COMMON_PACKS),
                        where("ownerUserNo", "==", effectiveOwnerId),
                        where("subServicesArray", "array-contains", itemData.subServiceCode)
                    ));
                    if (!packCheckSnap.empty) {
                        alert("This Sub Service is already part of some Multi-Service Package, CANNOT delete this sub-service.");
                        return false; // block deletion
                    }
                    // No package dependency — ask normal confirmation
                    return confirm(`Are you absolutely sure you want to permanently delete "${itemData.subServiceName || selectedCode}"? This action cannot be reversed.`);
                },
                onDeleted: () => {
                    document.getElementById("frm-adm-subservice").reset();
                    document.getElementById("sub-active").checked = true;
                    removeCatalogDeleteButton("btn-dynamic-sub-delete");
                    invalidateSubServicesCache(); // subService deleted — only subServices cache cleared
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                    renderCatalogSubServicesCheckboxes();
                    // [c] Restore Reset caption after delete
                    const rstBtnD = document.getElementById("btn-reset-subservice");
                    if (rstBtnD) rstBtnD.textContent = "Reset";
                }
            });

            // [c] Change Reset button to "Cancel" when a record is loaded
            const rstBtn = document.getElementById("btn-reset-subservice");
            if (rstBtn) rstBtn.textContent = "Cancel";

        } catch (err) {
            handleTelemetryAlert("Subservice Autofill Pipeline", err);
        }
    });

});
