// refresh.js — GlamTrack
import { db, COL, _ownerFilter, _getCachedServices, _getCachedSubServices, invalidateServicesCache, invalidateSubServicesCache, invalidateCatalogCache, activeSessionUser, setActiveSessionUser, salonOwnerNameContext, setSalonOwnerNameContext, realtimePacksUnsubscribe, setRealtimePacksUnsubscribe, sessionWatchdogTimer, setSessionWatchdogTimer, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, setAllotExistingPacks, _allotExistingIdx, setAllotExistingIdx, _postRegAllotMode, setPostRegAllotMode, _quickAddCustomerMode, setQuickAddCustomerMode, _utilizeStaffOptions, setUtilizeStaffOptions, utilizePrevUnpaidBalance, setUtilizePrevUnpaidBalance, _oldVisitPrevCalcCost, setOldVisitPrevCalcCost, _oldVisitPrevAddlAmt, setOldVisitPrevAddlAmt, _oldVisitLogDocRef, setOldVisitLogDocRef, INACTIVITY_TIMEOUT_MS } from "./state.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
;
;

// Cross-module imports
import { _refreshUserTableForMode } from "./customers.js";
;

export async function refreshCustomerDropdown() {
    // Refreshes allot-customer-select and utilize-customer-select
    if (!activeSessionUser) return;
    const ownerId = activeSessionUser.ownerUserNo;
    const custQ = query(collection(db, COL.USERS),
        where("ownerUserNo", "==", ownerId), where("role", "==", "CUSTOMER"));
    const custSnap = await getDocs(custQ);

    const allotEl = document.getElementById("allot-customer-select");
    if (allotEl) {
        allotEl.innerHTML = `<option value="">-- Choose from Available List --</option>`;
        custSnap.forEach(d => {
            const data = d.data();
            allotEl.innerHTML += `<option value="${data.userNo}">${data.name} (ID: ${data.userNo})</option>`;
        });
        allotEl._allOptions = Array.from(allotEl.options);
    }
    const ucEl = document.getElementById("utilize-customer-select");
    if (ucEl) {
        ucEl.innerHTML = `<option value="">-- Choose from Available List --</option>`;
        custSnap.forEach(d => {
            const data = d.data();
            ucEl.innerHTML += `<option value="${data.userNo}">${data.name} (Ph: ${data.phone || "—"})</option>`;
        });
        ucEl._allOptions = Array.from(ucEl.options);
    }
}

export async function refreshUserProfileDropdown() {
    // Refreshes usr-select-existing based on current form mode
    if (!activeSessionUser) return;
    const ownerId = activeSessionUser.ownerUserNo;
    const userProfileSelect = document.getElementById("usr-select-existing");
    if (!userProfileSelect) return;
    const activeMode = document.getElementById("sec-adm-users")?.dataset?.userMode;
    let q;
    if (activeMode === "CUSTOMER")
        q = query(collection(db, COL.USERS), where("ownerUserNo", "==", ownerId), where("role", "==", "CUSTOMER"));
    else if (activeMode === "MANAGER")
        q = query(collection(db, COL.USERS), where("ownerUserNo", "==", ownerId), where("role", "in", ["MANAGER", "STAFF"]));
    else
        q = query(collection(db, COL.USERS), where("ownerUserNo", "==", ownerId));
    const snap = await getDocs(q);
    userProfileSelect.innerHTML = `<option value="">-- Choose from Available List --</option>`;
    snap.forEach(d => {
        const data = d.data();
        userProfileSelect.innerHTML += `<option value="${data.userNo}">${data.name} — ${data.role} (ID: ${data.userNo})</option>`;
    });
    userProfileSelect._allOptions = Array.from(userProfileSelect.options);
}

export async function refreshPackDropdowns() {
    // Refreshes allot-pack-select and pack-select-existing
    if (!activeSessionUser) return;
    const ownerId = activeSessionUser.ownerUserNo;
    const packQ = query(collection(db, COL.COMMON_PACKS),
        where("ownerUserNo", "==", ownerId), where("packType", "==", "Type3"));
    const packSnap = await getDocs(packQ);

    allotPacksCache.clear();
    const allotEl = document.getElementById("allot-pack-select");
    if (allotEl) {
        allotEl.innerHTML = `<option value="">-- Choose from Available List --</option>`;
        packSnap.forEach(d => {
            const data = d.data();
            allotPacksCache.set(data.packName, data);
            allotEl.innerHTML += `<option value="${data.packName}">${data.packName} (Pack ID: ${data.packCode || d.id})</option>`;
        });
        allotEl._allOptions = Array.from(allotEl.options);
    }
    const pse = document.getElementById("pack-select-existing");
    if (pse) {
        pse.innerHTML = `<option value="">-- Choose from Available List --</option>`;
        packSnap.forEach(d => {
            const data = d.data();
            pse.innerHTML += `<option value="${data.packName}">${data.packName} (ID: ${data.packCode || d.id})</option>`;
        });
        pse._allOptions = Array.from(pse.options);
    }
}

export async function refreshAllAdministrativeTables() {
    if(!activeSessionUser) return;
    const ownerId = activeSessionUser.ownerUserNo;

    const renderTable = async (colName, elementId, rowBuilder) => {
        const q = query(collection(db, colName), where("ownerUserNo", "==", ownerId)); 
        const snap = await getDocs(q);
        const tbody = document.getElementById(elementId);
        if(tbody) {
            tbody.innerHTML = "";
            snap.forEach(d => tbody.appendChild(rowBuilder(d.data(), d.id)));
        }
    };

    {
        const catQ = query(collection(db, COL.CATEGORIES),
            where("ownerUserNo", "==", ownerId),
            where("active", "==", true));
        const catSnap = await getDocs(catQ);
        const catTbody = document.getElementById("tbl-adm-categories");
        if (catTbody) {
            catTbody.innerHTML = "";
            catSnap.forEach(d => {
                const data = d.data();
                const tr = document.createElement("tr");
                tr.innerHTML = `<td><strong>[${data.catCode}]</strong></td><td>${data.catName}</td>`;
                catTbody.appendChild(tr);
            });
        }
    }

    {
        const srvQ = query(collection(db, COL.SERVICES),
            where("ownerUserNo", "==", ownerId),
            where("active", "==", true));
        const srvSnap = await getDocs(srvQ);
        const srvTbody = document.getElementById("tbl-adm-services");
        if (srvTbody) {
            srvTbody.innerHTML = "";
            srvSnap.forEach(d => {
                const data = d.data();
                const tr = document.createElement("tr");
                tr.innerHTML = `<td><strong>[${data.serviceCode}]</strong></td><td>${data.serviceName}</td>`;
                srvTbody.appendChild(tr);
            });
        }
    }

    {
        // Fetch subServices grouped by sex and serviceCode
        const effectiveOwnerId = _ownerFilter();
        // Use cached subServices, filter active ones
        const _rawSsSnap = await _getCachedSubServices();
        const _activeSsDocs = _rawSsSnap.docs.filter(d => d.data().active === true);
        const ssSnap = { docs: _activeSsDocs, forEach: (fn) => _activeSsDocs.forEach(fn) };

        // Also fetch services for serviceCode→serviceName lookup
        const srvNameMap = new Map();
        const srvForNameSnap = await _getCachedServices(); // uses in-memory cache
        srvForNameSnap.forEach(d => { const s = d.data(); srvNameMap.set(s.serviceCode, s.serviceName); });

        // Group by sex first, then by serviceCode
        const groupedBySex = new Map();
        ssSnap.forEach(d => {
            const data = d.data();
            const sex = data.sex || "U";
            if (!groupedBySex.has(sex)) groupedBySex.set(sex, new Map());
            const sexMap = groupedBySex.get(sex);
            if (!sexMap.has(data.serviceCode)) sexMap.set(data.serviceCode, []);
            sexMap.get(data.serviceCode).push(data);
        });

        const ssTbody = document.getElementById("tbl-adm-subservices");
        if (ssTbody) {
            ssTbody.innerHTML = "";

            // Sex-level sorting with custom headings
            const sexOrder = ["M", "F"];
            const sexHeadings = {
                "M": "Men's Grooming & Barbeing",
                "F": "Women's Styling & Salon"
            };

            sexOrder.forEach(sex => {
                const sexMap = groupedBySex.get(sex);
                if (!sexMap || sexMap.size === 0) return;

                // Add sex-level heading
                const sexHeadTr = document.createElement("tr");
                sexHeadTr.innerHTML = `<td colspan="4" class="fw-bold text-uppercase bg-secondary text-white small py-2 px-2">${sexHeadings[sex] || sex}</td>`;
                ssTbody.appendChild(sexHeadTr);

                // Sort services within sex by serviceName
                const sortedGroups = [...sexMap.entries()].sort((a, b) => {
                    const nameA = srvNameMap.get(a[0]) || a[0];
                    const nameB = srvNameMap.get(b[0]) || b[0];
                    return nameA.localeCompare(nameB);
                });

                sortedGroups.forEach(([serviceCode, items]) => {
                    const srvName = srvNameMap.get(serviceCode) || serviceCode;
                    // Group heading row spanning 4 cols (2 cols × 2 sub-cols each)
                    const headTr = document.createElement("tr");
                    headTr.innerHTML = `<td colspan="4" class="fw-bold text-uppercase bg-light small py-1 px-2">${srvName}</td>`;
                    ssTbody.appendChild(headTr);

                    // Render items in pairs (2 per row)
                    items.sort((a, b) => (a.subServiceName || "").localeCompare(b.subServiceName || ""));
                    for (let i = 0; i < items.length; i += 2) {
                        const tr = document.createElement("tr");
                        const left  = items[i];
                        const right = items[i + 1];
                        const leftCell  = `<td class="ps-3 small">${left.subServiceName}</td><td class="text-end small pe-3"><strong>₹${left.rate}</strong></td>`;
                        const rightCell = right
                            ? `<td class="ps-3 small">${right.subServiceName}</td><td class="text-end small pe-3"><strong>₹${right.rate}</strong></td>`
                            : `<td></td><td></td>`;
                        tr.innerHTML = leftCell + rightCell;
                        ssTbody.appendChild(tr);
                    }
                });
            });
        }
    }

    // (c) tbl-adm-commonpacks: show Type3 packages only
    {
        const packType3Q = query(collection(db, COL.COMMON_PACKS),
            where("ownerUserNo", "==", ownerId),
            where("packType", "==", "Type3"));
        const packType3Snap = await getDocs(packType3Q);
        const packTbody = document.getElementById("tbl-adm-commonpacks");
        if (packTbody) {
            packTbody.innerHTML = "";
            packType3Snap.forEach(d => {
                const data = d.data();
                const tr = document.createElement("tr");
                const serviceCount = data.subServicesArray ? data.subServicesArray.length : 0;
                const discount = (data.totalAmount > 0 && data.offerPrice >= 0)
                    ? ((data.totalAmount - data.offerPrice) / data.totalAmount * 100)
                    : null;
                const discountBadge = (discount !== null && discount > 0)
                    ? ` <span class="badge bg-success ms-1">${discount.toFixed(1)}% off</span>`
                    : "No Discount";

                const linkedWord = (data.packType === "Type3") ? "excluded" : "included";
                const packNameLink = `<a href="#" class="text-decoration-none fw-bold" onclick="event.preventDefault(); const sel = document.getElementById('pack-select-existing'); if (sel) { sel.value = '${data.packName}'; sel.dispatchEvent(new Event('change')); }">${data.packName}</a>`;
                tr.innerHTML = `
                    <td>${packNameLink}</td>
                    <td hidden><span class="badge bg-dark">${data.packType === "Type1" ? "Item Counts" : "Cash Value Balance"}</span></td>
                    <td>₹${data.offerPrice}${discountBadge}</td>
                    <td>₹${data.totalAmount}</td>
                    <td>${serviceCount} item${serviceCount === 1 ? "" : "s"} ${linkedWord}</td>
                    <td><span class="badge ${data.active ? 'bg-success' : 'bg-secondary'}">${data.active ? 'Active' : 'Hidden'}</span></td>
                    <td><button class="btn btn-outline-secondary btn-sm py-0 px-2 copy-pack-btn" title="Copy package summary to clipboard">📋 Copy</button></td>`;

                tr.querySelector(".copy-pack-btn").addEventListener("click", () => {
                    const discountLine = (discount !== null && discount > 0)
                        ? `\nDiscount: ${discount.toFixed(1)}% off list price`
                        : "";
                    const includesWord = data.packType === "Type3" ? "Excludes" : "Includes";
                    const summary = [
                        `📦 ${data.packName}`,
                        `Offered Price: ₹${data.offerPrice}${discountLine}`,
                        `Total Services Value: ₹${data.totalAmount}`,
                        `${includesWord}: ${serviceCount} service item${serviceCount === 1 ? "" : "s"}`,
                        `Status: ${data.active ? "Available for subscription" : "Currently unavailable"}`
                    ].join("\n");

                    navigator.clipboard.writeText(summary).then(() => {
                        const btn = tr.querySelector(".copy-pack-btn");
                        btn.textContent = "✅ Copied!";
                        btn.classList.replace("btn-outline-secondary", "btn-success");
                        setTimeout(() => {
                            btn.textContent = "📋 Copy";
                            btn.classList.replace("btn-success", "btn-outline-secondary");
                        }, 2000);
                    }).catch(() => {
                        alert("Clipboard access was blocked. Please copy manually.");
                    });
                });

                packTbody.appendChild(tr);
            });
        }
    }

    // tbl-adm-users: apply role filter matching the current active form mode
    {
        const currentMode = document.getElementById("sec-adm-users")?.dataset?.userMode;
        if (currentMode) {
            // Mode is set — delegate entirely to _refreshUserTableForMode for correct role filter
            await _refreshUserTableForMode(currentMode);
        } else {
            // No mode set — fallback: show all users (should not happen in normal flow)
            const usrQ = query(collection(db, COL.USERS),
                where("ownerUserNo", "==", ownerId));
            const usrSnap = await getDocs(usrQ);
            const usrTbody = document.getElementById("tbl-adm-users");
            if (usrTbody) {
                usrTbody.innerHTML = "";
                usrSnap.forEach(d => {
                    const data = d.data();
                    const tr = document.createElement("tr");
                    const userNoLink = `<a href="#" class="text-decoration-none fw-bold" onclick="event.preventDefault(); const sel = document.getElementById('usr-select-existing'); if (sel) { sel.value = '${data.userNo}'; sel.dispatchEvent(new Event('change')); }">#${data.userNo}</a>`;
                    tr.innerHTML = `<td>${userNoLink}</td><td><span class="badge bg-secondary text-uppercase">${data.role}</span></td><td><strong>${data.name}</strong></td><td>${data.phone || "—"}</td><td>${data.email || "—"}</td><td><span class="badge ${data.active?'bg-success':'bg-secondary'}">${data.active?'Active Card':'Archived'}</span></td><td>-</td>`;
                    usrTbody.appendChild(tr);
                });
            }
        }
    }
}

export async function loadWorkspaceDropdownMappings() {
    if (!activeSessionUser) return;
    const ownerId = activeSessionUser.ownerUserNo;

    const populateSelect = async (colName, elementId, valKey, txtKey, customFilterRole) => {
        let q = query(collection(db, colName), where("ownerUserNo", "==", ownerId)); 
        if (customFilterRole) {
            q = query(collection(db, colName), where("ownerUserNo", "==", ownerId), where("role", "==", customFilterRole)); 
        }
        const snap = await getDocs(q);
        const el = document.getElementById(elementId);
        if(el) {
            el.innerHTML = `<option value="">-- Choose from Available List --</option>`;
            snap.forEach(d => {
                const data = d.data();
                el.innerHTML += `<option value="${data[valKey]}">${data[txtKey]} (ID: ${data[valKey]})</option>`;
            });
        }
    };

    await populateSelect("serviceCategories", "srv-parent-cat", "catCode", "catName");
    await populateSelect("serviceCategories", "cat-select-existing", "catCode", "catName");
    await populateSelect("services", "srv-select-existing", "serviceCode", "serviceName");
    {
        const effectiveOwnerId = _ownerFilter();
        const srvSnap = await _getCachedServices(); // uses in-memory cache
        const subParentEl = document.getElementById("sub-parent-srv");
        if (subParentEl) {
            subParentEl.innerHTML = `<option value="">-- Choose from Available List --</option>`;
            srvSnap.forEach(d => {
                const data = d.data();
                subParentEl.innerHTML += `<option value="${data.serviceCode}">${data.serviceName} (ID: ${data.serviceCode})</option>`;
            });
            subParentEl._allOptions = Array.from(subParentEl.options);
        }
    }
    {
        const packQ = query(collection(db, COL.COMMON_PACKS),
            where("ownerUserNo", "==", ownerId),
            where("packType", "==", "Type3"));
        const packSnap = await getDocs(packQ);
        allotPacksCache.clear();
        const allotSelectEl = document.getElementById("allot-pack-select");
        if (allotSelectEl) {
            allotSelectEl.innerHTML = `<option value="">-- Choose from Available List --</option>`;
            packSnap.forEach(d => {
                const data = d.data();
                allotPacksCache.set(data.packName, data);
                const packId = data.id || d.id;
                allotSelectEl.innerHTML += `<option value="${data.packName}">${data.packName} (Pack ID: ${packId})</option>`;
            });
            allotSelectEl._allOptions = Array.from(allotSelectEl.options);
        }
    }
    // (b) pack-select-existing: show Type3 packages only
    {
        const pseQ = query(collection(db, COL.COMMON_PACKS),
            where("ownerUserNo", "==", ownerId),
            where("packType", "==", "Type3"));
        const pseSnap = await getDocs(pseQ);
        const pse = document.getElementById("pack-select-existing");
        if (pse) {
            pse.innerHTML = `<option value="">-- Choose from Available List --</option>`;
            pseSnap.forEach(d => {
                const data = d.data();
                const docId = d.id; // Firestore document ID = {ownerUserNo}_PACK_{packCode}
                pse.innerHTML += `<option value="${data.packName}">${data.packName} (ID: ${data.packCode || docId})</option>`;
            });
            pse._allOptions = Array.from(pse.options);
        }
    }
    await populateSelect("users", "allot-customer-select", "userNo", "name", "CUSTOMER");
    {
        const _acEl = document.getElementById("allot-customer-select");
        if (_acEl) _acEl._allOptions = Array.from(_acEl.options);
    }
    // utilize-customer-select: value=userNo, display=name + phone (not userNo)
    {
        const custQ = query(collection(db, COL.USERS),
            where("ownerUserNo", "==", ownerId),
            where("role", "==", "CUSTOMER"));
        const custSnap = await getDocs(custQ);
        const ucEl = document.getElementById("utilize-customer-select");
        if (ucEl) {
            ucEl.innerHTML = `<option value="">-- Choose from Available List --</option>`;
            custSnap.forEach(d => {
                const data = d.data();
                ucEl.innerHTML += `<option value="${data.userNo}">${data.name} (Ph: ${data.phone || "—"})</option>`;
            });
            ucEl._allOptions = Array.from(ucEl.options);
        }
    }

    const userProfileSelect = document.getElementById("usr-select-existing");
    if (userProfileSelect) {
        // Respect active user form mode: Customer Registration → CUSTOMER only;
        // Staff Registration → MANAGER/STAFF only; no mode set → all users
        const activeMode = document.getElementById("sec-adm-users")?.dataset?.userMode;
        let usersQuery;
        if (activeMode === "CUSTOMER") {
            usersQuery = query(collection(db, COL.USERS),
                where("ownerUserNo", "==", ownerId),
                where("role", "==", "CUSTOMER"));
        } else if (activeMode === "MANAGER") {
            usersQuery = query(collection(db, COL.USERS),
                where("ownerUserNo", "==", ownerId),
                where("role", "in", ["MANAGER", "STAFF"]));
        } else {
            usersQuery = query(collection(db, COL.USERS),
                where("ownerUserNo", "==", ownerId));
        }
        const usersSnap = await getDocs(usersQuery);
        userProfileSelect.innerHTML = `<option value="">-- Choose from Available List --</option>`;
        usersSnap.forEach(d => {
            const data = d.data();
            userProfileSelect.innerHTML += `<option value="${data.userNo}">${data.name} — ${data.role} (ID: ${data.userNo})</option>`;
        });
        userProfileSelect._allOptions = Array.from(userProfileSelect.options);
    }

    // sub-select-existing: custom population with serviceName join
    {
        const effectiveOwnerIdForSub = _ownerFilter();

        // Use cached snapshots for sub-select-existing
        const subSnap = await _getCachedSubServices();
        const srvSnapSub = await _getCachedServices();
        const srvNameMapSub = new Map();
        srvSnapSub.forEach(d => { const s = d.data(); srvNameMapSub.set(s.serviceCode, s.serviceName); });

        const subSelEl = document.getElementById("sub-select-existing");
        if (subSelEl) {
            subSelEl.innerHTML = `<option value="">-- Choose from Available List --</option>`;
            // Sort alphabetically by subServiceName
            const subDocs = subSnap.docs.map(d => d.data()).sort((a, b) =>
                (a.subServiceName || "").localeCompare(b.subServiceName || ""));
            subDocs.forEach(data => {
                const srvName = srvNameMapSub.get(data.serviceCode) || "";
                const label = srvName
                    ? `${data.subServiceName} (${srvName}) (ID: ${data.subServiceCode})`
                    : `${data.subServiceName} (ID: ${data.subServiceCode})`;
                subSelEl.innerHTML += `<option value="${data.subServiceCode}">${label}</option>`;
            });
            subSelEl._allOptions = Array.from(subSelEl.options);
        }
    }
}

export function setupMediaPreviewListener(inputId, imgId) {
    const fileEl = document.getElementById(inputId);
    const imgEl = document.getElementById(imgId);
    if (!fileEl || !imgEl) return;

    fileEl.addEventListener("change", function() {
        const assetFile = this.files[0];
        if (assetFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imgEl.src = e.target.result;
                imgEl.style.display = "block"; 
            };
            reader.readAsDataURL(assetFile);
        } else {
            imgEl.src = "";
            imgEl.style.display = "none"; // Rule check: Suppress layout placeholders when asset is empty
        }
    });
}

