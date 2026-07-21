// auth.js — GlamTrack
import { db, COL, invalidateServicesCache, invalidateSubServicesCache, invalidateCatalogCache, activeSessionUser, setActiveSessionUser, salonOwnerNameContext, setSalonOwnerNameContext, realtimePacksUnsubscribe, setRealtimePacksUnsubscribe, sessionWatchdogTimer, setSessionWatchdogTimer, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, setAllotExistingPacks, _allotExistingIdx, setAllotExistingIdx, _postRegAllotMode, setPostRegAllotMode, _quickAddCustomerMode, setQuickAddCustomerMode, _utilizeStaffOptions, setUtilizeStaffOptions, utilizePrevUnpaidBalance, setUtilizePrevUnpaidBalance, _oldVisitPrevCalcCost, setOldVisitPrevCalcCost, _oldVisitPrevAddlAmt, setOldVisitPrevAddlAmt, _oldVisitLogDocRef, setOldVisitLogDocRef, INACTIVITY_TIMEOUT_MS } from "./state.js";
import { collection, query, where, getDocs, doc, writeBatch } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { SAMPLE_CATEGORIES, SAMPLE_SERVICES, SAMPLE_SUB_SERVICES } from "../constants.js";
import { reportRuntimeCrash } from "../errorMailer.js";

// Cross-module imports
import { configureUserProfileFormForRole } from "./customers.js";
import { bindRealtimeAnalyticsStream } from "./dashboard.js";
import { refreshAllAdministrativeTables, loadWorkspaceDropdownMappings } from "./refresh.js";
import { renderCatalogSubServicesCheckboxes } from "./catalog.js";

export function showActiveFrame(sectionId, scrollToFormId) {
    document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add("active");
        if (scrollToFormId) {
            setTimeout(() => {
                const formEl = document.getElementById(scrollToFormId);
                if (formEl) formEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
        }
    }
}

export function resetSessionWatchdog() {
    if (sessionWatchdogTimer) clearTimeout(sessionWatchdogTimer);
    setSessionWatchdogTimer(setTimeout(() => {
        alert("Security Lockout: You have been signed out automatically due to 15 minutes of inactivity.");
        performSessionLogoutAction();
    }, INACTIVITY_TIMEOUT_MS));
}
const ACTIVITY_EVENTS = ["mousemove","keydown","click","scroll","touchstart"];
export function startSessionWatchdog() {
    resetSessionWatchdog();
    ACTIVITY_EVENTS.forEach(evt => document.addEventListener(evt, resetSessionWatchdog, { passive: true }));
}
export function stopSessionWatchdog() {
    if (sessionWatchdogTimer) clearTimeout(sessionWatchdogTimer);
    setSessionWatchdogTimer(null);
    ACTIVITY_EVENTS.forEach(evt => document.removeEventListener(evt, resetSessionWatchdog));
}

// Wrapper to interface safely with your errorMailer layout rules
export async function handleTelemetryAlert(contextLabel, errorPayload) {
    try {
        // Formatted to supply: reportRuntimeCrash(ownerName, activeSessionContext, errorObject)
        await reportRuntimeCrash(salonOwnerNameContext, activeSessionUser, {
            message: `[${contextLabel}] ${errorPayload.message || errorPayload}`,
            stack: errorPayload.stack || "No call-trace logged."
        });
    } catch (criticalLogErr) {
        console.error("Diagnostic reporting loop collapsed:", criticalLogErr);
    }
}

// =========================================================================
// Sign-In Security & Authorization Process
// =========================================================================
export async function processSecureProfileAuthentication() {
    const selectedRole   = document.getElementById("txt-login-role").value;
    const emailInput     = document.getElementById("txt-login-email").value.trim().toLowerCase();
    const passwordInput  = document.getElementById("txt-login-pass") ? document.getElementById("txt-login-pass").value : "";

    // ── Helper: show inline errors ───────────────────────────────────────────
    function _loginErr(field, msg) {
        // field: 'email' | 'pass' | 'general'
        if (field === 'email') {
            const el = document.getElementById("txt-login-email");
            const fb = document.getElementById("err-login-email");
            if (el) el.classList.add("is-invalid");
            if (fb) { fb.textContent = msg; }
        } else if (field === 'pass') {
            const el = document.getElementById("txt-login-pass");
            const fb = document.getElementById("err-login-pass");
            if (el) el.classList.add("is-invalid");
            if (fb) { fb.textContent = msg; }
        } else {
            const fb = document.getElementById("err-login-general");
            if (fb) { fb.textContent = msg; fb.classList.remove("d-none"); }
        }
    }
    function _loginClearErrors() {
        ["txt-login-email","txt-login-pass"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove("is-invalid");
        });
        const fb = document.getElementById("err-login-general");
        if (fb) { fb.textContent = ""; fb.classList.add("d-none"); }
    }
    _loginClearErrors();

    if (!emailInput) {
        _loginErr('email', 'Please enter your sign-in email address.');
        document.getElementById("txt-login-email").focus();
        return;
    }
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
        _loginErr('email', 'Please enter a valid email address.');
        document.getElementById("txt-login-email").focus();
        return;
    }

    // Disable button to prevent double-submit
    const btnEl = document.getElementById("btn-execute-auth");
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = "Signing in…"; }

    try {
        // --- 1. System Administrator Sign-In Link ---
        if (selectedRole === "SUPER_USER") {
            if (emailInput !== 'bawa.codes@gmail.com') {
                _loginErr('email', 'This email is not registered as a System Administrator.');
                return;
            }

            const otpInputVal = document.getElementById("txt-login-otp") ? document.getElementById("txt-login-otp").value.trim() : "";

            if (!otpInputVal) {
                const secureGeneratedToken = Math.floor(100000 + Math.random() * 900000);
                window.tempSessionOtpStorage = secureGeneratedToken;

                await emailjs.send('service_050166', 'template_050166', {
                    to_email: 'bawa.codes@gmail.com',
                    subject: "GlamTrack Security Access - Verification Code",
                    body: `Your verification code for GlamTrack Console Access is: ${secureGeneratedToken}. Code expires in 15 minutes.`
                });

                _loginErr('general', 'A secure 6-digit confirmation code has been sent to the administrator\'s email inbox.');
                return;
            }

            if (parseInt(otpInputVal, 10) !== window.tempSessionOtpStorage) {
                _loginErr('general', 'Incorrect Code: The confirmation code you entered does not match.');
                return;
            }

            delete window.tempSessionOtpStorage;

            setActiveSessionUser({
                userNo: "0001",
                role: "SUPER_USER",
                name: "System Administrator",
                email: "bawa.codes@gmail.com",
                ownerUserNo: "000"
            });
            setSalonOwnerNameContext("Platform Core Administration");

            renderAuthorizedWorkspaceSession();
            return;
        }

        // --- 2. Salon Owner / Manager / Staff Sign-In Link ---
        if (!passwordInput) {
            _loginErr('pass', 'Please enter your password.');
            document.getElementById("txt-login-pass").focus();
            return;
        }

        // Database Security Constraint Check
        const q = query(collection(db, COL.USERS), where("email", "==", emailInput), where("role", "==", selectedRole));
        const res = await getDocs(q);

        if (res.empty) {
            _loginErr('general', 'Sign In Failed: No account found matching this email and role. Please check your details.');
            return;
        }

        const userDoc = res.docs[0].data();

        if (userDoc.password !== passwordInput) {
            _loginErr('pass', 'Incorrect password. Please try again.');
            document.getElementById("txt-login-pass").focus();
            return;
        }

        const isoToday = new Date().toISOString().split("T")[0];

        // Simplified Profile Status Validations
        if (userDoc.startDate && isoToday < userDoc.startDate) {
            _loginErr('general', 'Access Notice: Your staff account is not scheduled to become active yet.');
            return;
        }
        if (userDoc.expiryDate && isoToday > userDoc.expiryDate) {
            _loginErr('general', 'Access Notice: The salon management contract for this account has expired.');
            return;
        }
        if (!userDoc.active) {
            _loginErr('general', 'Access Notice: This account has been marked as inactive. Please contact your manager.');
            return;
        }

        // Set successful login session
        setActiveSessionUser(userDoc);
        if (activeSessionUser.role === "OWNER") {
            setActiveSessionUser({ ...activeSessionUser, ownerUserNo: activeSessionUser.userNo });
        }
        setSalonOwnerNameContext(activeSessionUser.role === "OWNER" ? activeSessionUser.name : `Salon Branch [${activeSessionUser.ownerUserNo}]`);

        renderAuthorizedWorkspaceSession();

    } catch (crash) {
        await handleTelemetryAlert("Salon Sign In Security Error", crash);
        const isOffline = !navigator.onLine;
        document.getElementById("err-login-general") &&
            (() => {
                const fb = document.getElementById("err-login-general");
                fb.textContent = isOffline
                    ? "No internet connection. Please check your network and try again."
                    : "A connection problem occurred while signing in. Please try again in a moment.";
                fb.classList.remove("d-none");
            })();
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = "Sign In"; }
    }
}

export function renderAuthorizedWorkspaceSession() {
    document.getElementById("nav-logout").classList.remove("d-none");
    document.getElementById("nav-login").classList.add("d-none");

    const role = activeSessionUser.role;

    // Background image: keep for SUPER_USER, remove for all others
    if (role === "SUPER_USER") {
        document.body.classList.add("bg-glamtrack");
        document.getElementById("sec-glamtrack").style.display = "none";
    } else {
        document.body.classList.remove("bg-glamtrack");
        // sec-glamtrack shown only for OWNER
        document.getElementById("sec-glamtrack").style.display = (role === "OWNER") ? "" : "none";
    }

    // All logged-in users see Customers, Packages, Services
    document.getElementById("nav-customers-wrapper").classList.remove("d-none");
    document.getElementById("nav-packages-wrapper").classList.remove("d-none");
    document.getElementById("nav-services").classList.remove("d-none");
    // nav-gallery remains permanently hidden

    // Admin menu: OWNER and SUPER_USER only (not MANAGER)
    if (role === "OWNER" || role === "SUPER_USER") {
        document.getElementById("nav-admin-wrapper").classList.remove("d-none");
    }

    // MANAGER: hide Staff Registration submenu item
    if (role === "MANAGER") {
        document.getElementById("nav-staff-reg")?.classList.add("d-none");
        document.getElementById("nav-admin-wrapper")?.classList.remove("d-none"); // show Admin for pwd change only
    }

    // Hide the pre-login welcome block after login
    const secHome = document.getElementById("sec-home");
    if (secHome) secHome.style.display = "none";

    // btn-trigger-autopopulate remains hidden permanently (no classList.remove("d-none"))

    // Session bar: Salon Name | Logged In as Role | LogOut
    const salonName = (salonOwnerNameContext || "").trim();
    const salonNameEl = document.getElementById("lbl-salon-name");
    if (salonNameEl) salonNameEl.innerText = salonName;

    const roleEl = document.getElementById("lbl-logged-in-role");
    if (roleEl) roleEl.innerText = `Logged In as: ${activeSessionUser.role}`;

    // lbl-active-context: userNo hidden per requirement — element kept in DOM for JS compatibility
    const ctxEl = document.getElementById("lbl-active-context");
    if (ctxEl) { ctxEl.innerText = ""; ctxEl.classList.remove("d-none"); }
    configureUserProfileFormForRole(activeSessionUser.role);
    startSessionWatchdog();
    showActiveFrame("sec-glamtrack");
    
    bindRealtimeAnalyticsStream();
    loadWorkspaceDropdownMappings();
    refreshAllAdministrativeTables();
    renderCatalogSubServicesCheckboxes();
}

export function performSessionLogoutAction() {
    if (realtimePacksUnsubscribe) realtimePacksUnsubscribe();
    stopSessionWatchdog();
    setUtilizeStaffOptions(null); // clear staff cache on logout
    invalidateCatalogCache();    // clear services/subServices cache on logout
    setActiveSessionUser(null);
    window.location.reload();
}

// =========================================================================
// Automated Data Master Creation Mechanics (Using constants.js Models)
// =========================================================================
export async function getHighestFieldOffset(tableName, fieldKey) {
    let topVal = 0;
    const q = query(collection(db, tableName), where("ownerUserNo", "==", activeSessionUser.ownerUserNo)); 
    const snap = await getDocs(q);
    snap.forEach(d => {
        const parsed = parseInt(d.data()[fieldKey], 10);
        if(!isNaN(parsed) && parsed > topVal) topVal = parsed;
    });
    return topVal;
}

export async function executeDynamicAutopopulateMenuTask() {
    if(!activeSessionUser) return alert("Access Failure: Session details missing.");
    const ownerId = activeSessionUser.ownerUserNo;

    try {
        const batch = writeBatch(db);
        const isoNow = new Date().toISOString().split("T")[0];
        const timestamp = new Date().toISOString();

        const offsetCat = await getHighestFieldOffset("serviceCategories", "catCode");
        const offsetSrv = await getHighestFieldOffset("services", "serviceCode");
        const offsetSub = await getHighestFieldOffset("subServices", "subServiceCode");

        const categoryMap = {}, serviceMap = {};

        // Hydrates system models safely matching your complete predefined constants schemas
        SAMPLE_CATEGORIES.forEach((c, idx) => {
            const calculatedCode = String(offsetCat + (idx + 1)).padStart(2, "0");
            categoryMap[c.catCode] = calculatedCode;
            batch.set(doc(db, COL.CATEGORIES, `${ownerId}_CAT_${calculatedCode}`), {
                ownerUserNo: ownerId, catCode: calculatedCode, catName: c.catName, catDescription: c.catDescription,
                active: true, createdBy: activeSessionUser.role, startDate: isoNow, expiryDate: null, createdAt: timestamp
            });
        });

        SAMPLE_SERVICES.forEach((s, idx) => {
            const calculatedCode = String(offsetSrv + (idx + 1)).padStart(2, "0");
            serviceMap[s.serviceCode] = calculatedCode;
            const contextCatParent = categoryMap[s.catCode] || s.catCode;
            batch.set(doc(db, COL.SERVICES, `${ownerId}_SRV_${calculatedCode}`), {
                ownerUserNo: ownerId, serviceCode: calculatedCode, serviceName: s.serviceName, serviceDescription: s.serviceDescription,
                catCode: contextCatParent, active: true, createdBy: activeSessionUser.role, startDate: isoNow, expiryDate: null, createdAt: timestamp
            });
        });

        SAMPLE_SUB_SERVICES.forEach((ss, idx) => {
            const calculatedCode = String(offsetSub + (idx + 1)).padStart(3, "0");
            const contextSrvParent = serviceMap[ss.serviceCode] || ss.serviceCode;
            batch.set(doc(db, COL.SUB_SERVICES, `${ownerId}_SUB_${calculatedCode}`), {
                ownerUserNo: ownerId, subServiceCode: calculatedCode, subServiceName: ss.subServiceName, serviceCode: contextSrvParent,
                rate: Number(ss.rate), durationMinutes: Number(ss.durationMinutes), active: true, createdBy: activeSessionUser.role,
                startDate: isoNow, expiryDate: null, createdAt: timestamp
            });
        });

        await batch.commit();
        invalidateCatalogCache(); // batch wrote both services AND subServices — clear both
        alert("Success: The standard salon service sheets and price models have been loaded into your profile.");
        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
        renderCatalogSubServicesCheckboxes();
    } catch(err) {
        await handleTelemetryAlert("Autopopulate Operational Pipeline", err);
    }
}

// =========================================================================
// GlamTrack Section — Expiries, Unengaged, Premium Lists
// =========================================================================

// Full datasets cached for View More modal
// [_glamtrackFullExpiries imported from state.js]
// [_glamtrackFullUnengaged imported from state.js]
// [_glamtrackFullPremium imported from state.js]
