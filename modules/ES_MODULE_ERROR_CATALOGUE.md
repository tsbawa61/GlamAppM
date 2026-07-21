# GlamTrack ES Module Error Catalogue
# Purpose: Reference for AI sessions — check this before modularisation work.
# All errors below were encountered and resolved during the July 2026 modularisation.

---

## ERROR CLASS 1 — `Unexpected end of input`
**Example:** `ui.js:159 Uncaught SyntaxError: Unexpected end of input`
**Cause:** Module boundary cut a function mid-body. The function declaration was included but its closing `}` was in a different line range assigned to another module.
**Fix:** Find the next top-level function after the cut point using `awk/grep`, extend the module boundary to include the full function body.
**Detection:** `node --check module.js`

---

## ERROR CLASS 2 — `Identifier 'X' has already been declared`
**Example:** `customers.js:287 Uncaught SyntaxError: Identifier '_quickAddCustomerMode' has already been declared`
**Cause A:** Variable declared as `export let X` in `state.js` AND also as bare `let X` in the module (both copied from `app.js`).
**Cause B:** Function imported from another module AND also defined in the same module (self-import).
**Cause C:** Same name imported twice from two different `import {}` blocks in the same module.
**Fix A:** Remove bare `let X` declarations from modules — they come from `state.js`.
**Fix B:** Remove the name from the import block — it's defined locally.
**Fix C:** Deduplicate import blocks.
**Detection script:**
```python
from collections import Counter
for m in re.finditer(r'import\s*\{([^}]+)\}', src):
    for name in re.split(r'[,\s\n]+', m.group(1)):
        all_names.append(name.strip())
dups = {k:v for k,v in Counter(all_names).items() if v > 1}
```

---

## ERROR CLASS 3 — `Assignment to constant variable`
**Example:** `TypeError: Assignment to constant variable at renderGlamtrackExpiries (dashboard.js:40)`
**Cause:** ES module imported bindings are READ-ONLY. `import { x } from "./state.js"` makes `x` a const — you cannot write `x = value`. This applies to ALL variables imported from `state.js`.
**Fix:** Use setter functions. Every state variable in `state.js` has a corresponding `setX(value)` function.
```js
// ❌ TypeError
activeSessionUser = userDoc;
// ✅ Correct
setActiveSessionUser(userDoc);
```
**Detection:** grep for `varName =` (not `==`) on imported state variable names.
**Variables requiring setters:** `activeSessionUser`, `salonOwnerNameContext`, `realtimePacksUnsubscribe`, `sessionWatchdogTimer`, `allotCurrentPackTotalAmount`, `_allotExistingPacks`, `_allotExistingIdx`, `_postRegAllotMode`, `_quickAddCustomerMode`, `_utilizeStaffOptions`, `utilizePrevUnpaidBalance`, `_oldVisitPrevCalcCost`, `_oldVisitPrevAddlAmt`, `_oldVisitLogDocRef`, `_glamtrackFullExpiries`, `_glamtrackFullUnengaged`, `_glamtrackFullPremium`.

---

## ERROR CLASS 4 — `X is not defined` (ReferenceError)
**Example:** `ReferenceError: configureUserProfileFormForRole is not defined at auth.js:212`
**Cause:** Function exists in another module but isn't imported. ES modules have no shared global scope — every cross-module function call needs an explicit import.
**Fix:** Add `import { funcName } from "./sourceModule.js"` to the module that calls it.
**Detection script:**
```python
for fn in all_exported_functions:
    if re.search(r'\b' + fn + r'\b', code_without_imports) and fn not in imported_names:
        print(f"Missing import: {fn}")
```

---

## ERROR CLASS 5 — `does not provide an export named 'X'`
**Example:** `SyntaxError: The requested module './ui.js' does not provide an export named 'setupMediaPreviewListener'`
**Cause A:** Function claimed to be from `ui.js` in the import but actually lives in another module (e.g. `refresh.js`).
**Cause B:** Function not yet exported — missing `export` keyword in the defining module.
**Fix A:** Find correct module: `grep -rl "^export function X" modules/`
**Fix B:** Add `export` keyword to the function definition.

---

## ERROR CLASS 6 — `missing ) after argument list`
**Example:** `SyntaxError: missing ) after argument list (at allotment.js:326:61)`
**Cause:** Automated setter-replacement script produced malformed calls:
- `setter(Number(x) || 0;)` — semicolon inside the call
- `setter(Number(x);)` — semicolon before closing paren
- `setter({);` — multi-line object literal broken at opening brace
**Fix:** Manually fix each case. For `setter(expr;)` → `setter(expr);`. For multi-line objects, wrap as `setter({ ... })` spanning multiple lines.
**Detection:** `grep -n "set[A-Z]\w*(.*;\)" module.js`

---

## ERROR CLASS 7 — `Unexpected identifier 'from'`
**Example:** `SyntaxError: Unexpected identifier 'from' (at main.js:7:51)`
**Cause:** Import cleanup script introduced `from from` duplication: `import { X } from from "./module.js"`.
**Fix:** Global replace `} from from "` → `} from "` across all module files.
**Detection:** `grep -n "from from" modules/*.js`

---

## ERROR CLASS 8 — Missing event-wiring code (search boxes not working)
**Example:** All search boxes non-functional after modularisation.
**Cause:** `main.js` was built from only the `initViewRouterLinks` body (lines 744–1564 of app.js). The first half of the DOMContentLoaded block (lines 165–743) — containing `wireDropdownSearch`, custom search listeners, × button handlers, and other setup — was completely excluded.
**Fix:** Rebuild `main.js` to include the FULL DOMContentLoaded block (lines 165–609) PLUS the inlined `initViewRouterLinks` body (lines 744–1564).

---

## ERROR CLASS 9 — `Unexpected token '}'`
**Example:** `SyntaxError: Unexpected token '}' (at main.js:1287:1)` then `(at main.js:1288:1)`
**Cause:** When `initViewRouterLinks()` was inlined into `main.js`, the function body was inserted but the matching closing `}` of the function declaration was left behind as a stray brace. Each fix shifted the line number by 1, making it appear as a new error at line 1288 after being fixed at line 1287 — but it was the same stray brace.
**Why it recurred:** The fix at line 1287 was correct but the Netlify deployment still had the unfixed version. The error at 1288 was from the old deployed file, not a new issue in the local file.
**Fix:** Remove the lone `}` that appears between the last `});` event listener and the DOMContentLoaded closing `});`.
**Detection:**
```bash
# Check the last 10 lines of main.js — should end with only:
#     });       ← last event listener close
#               ← blank line
# });           ← DOMContentLoaded close
tail -5 modules/main.js
node --check modules/main.js
```
**Prevention:** When inlining a function body, always remove BOTH the opening declaration line (`function X() {`) AND the final closing brace (`}`) before inserting the body. After inlining, verify `tail -5` shows only `});` as the last non-blank line.
**Key lesson:** When the same error recurs at line N+1 after fixing at line N, check whether Netlify has the UPDATED file — it may be a stale deployment, not a new code error.


```python
# 1. Syntax check
for mod in modules:
    node --check modules/{mod}.js

# 2. Duplicate imports
Counter(all_imported_names) — flag any count > 1

# 3. Direct state assignments
grep pattern: varName\s*=\s*(?!=) excluding export/import/setter lines

# 4. 'from from' typos
grep -n "from from" modules/*.js

# 5. Self-imports (module importing its own exports)
imported_names & own_exported_names — should be empty

# 6. Missing cross-module imports
For each function called in module, check it is either defined locally or imported
```

---

## KEY ARCHITECTURAL RULES FOR GLAMTRACK MODULES

1. **`state.js` owns ALL mutable shared state** — never declare `let X` in a module for a shared variable.
2. **All state writes go through setters** — `setActiveSessionUser(x)` not `activeSessionUser = x`.
3. **`main.js` is the event-wiring layer** — it imports from all modules and wires DOM listeners. It does NOT export anything.
4. **`initViewRouterLinks` body belongs in `main.js`** — not in `ui.js`. It depends on every other module.
5. **Import only what you use** — run the unused-import scan after any module change.
6. **`from from` is introduced by automated import-cleanup scripts** — always verify after running such scripts.

---

## ERROR CLASS 10 — `ReferenceError: X is not defined` (state variable, not function)
**Example:** `ReferenceError: _utilizeOverrideConfirmed is not defined at visits.js:753`
**Cause:** Distinct from Error Class 4 (missing function import). The missing name is a STATE VARIABLE (`export let`) from `state.js`, not a function from another domain module. Easy to miss because import-cleanup scripts only check for function usage.
**Commonly missed:** `_utilizeOverrideConfirmed`, `_utilizeOverrideMeta`, `_allotFormOriginalParent`, `_allotFormOriginalNextSibling`, `_postRegAllotModalInstance`, `_quickAddCustomerModalInstance`, `_userProfileFormOriginalParent`, `_userProfileFormOriginalNextSibling`.
**Fix:** Add the variable AND its setter to the `state.js` import block in the affected module.
**Detection script:**
```python
state_exports = set(re.findall(r'export (?:let|const|function) (\w+)', state_src))
missing = [n for n in state_exports if n not in state_imported and re.search(r'\b'+n+r'\b', code)]
```
**Run after every module change** — these only surface at runtime when that code path executes.

---

## NOT A CODE ERROR — `net::ERR_QUIC_PROTOCOL_ERROR` (Firestore network)
**Example:** `GET https://firestore.googleapis.com/.../Listen/channel... net::ERR_QUIC_PROTOCOL_ERROR 200 (OK)`
**This is NOT a code bug.** QUIC is a UDP-based transport protocol. The error means the network layer dropped a packet — not an app error. The `200 (OK)` confirms Firestore received the request. Firestore SDK reconnects automatically.
**Action required:** None. No code change needed.

---

## ERROR CLASS 11 — `FirebaseError: Expected type 'ug', but it was: a custom Object object`
**Example:** `FirebaseError: Expected type 'ug', but it was: a custom Object object` at `updateDoc(_oldVisitLogDocRef, ...)`
**Cause:** A Firestore `DocumentReference` was passed through `JSON.stringify()` → stored in a DOM `dataset` attribute → retrieved with `JSON.parse()`. `DocumentReference` objects are not JSON-serializable — they become empty plain objects `{}`. When that plain object is then passed to `updateDoc()`, Firestore expects a `DocumentReference` (internal type `'ug'`) but receives a plain object.
**The pattern that causes it:**
```js
// ❌ WRONG — ref becomes {} after JSON round-trip
logs.push({ ref: d.ref, ...d.data() });
opt.dataset.logData = JSON.stringify(log);   // ref → {}
const log = JSON.parse(opt.dataset.logData); // log.ref is now {}
updateDoc(log.ref, {...});                   // FirebaseError!
```
**Fix:** Store only the document ID (a plain string) in the serialized data, then reconstruct the `DocumentReference` using `doc(db, collection, id)` when needed:
```js
// ✅ CORRECT — store docId string, reconstruct ref from it
logs.push({ docId: d.id, ...d.data() });    // no ref stored
opt.dataset.logData = JSON.stringify(log);
const log = JSON.parse(opt.dataset.logData);
const logRef = doc(db, COL.VISIT_LOGS, log.docId); // reconstruct ref
updateDoc(logRef, {...});                    // works correctly
```
**Rule:** NEVER include `.ref` (DocumentReference), `.snapshot`, or any Firestore object in data that will be passed through `JSON.stringify()`. Store only primitive values (strings, numbers, booleans, arrays of primitives).
**Detection:** `grep -rn "JSON.stringify.*ref\|\.ref.*JSON.stringify" modules/*.js`

---

## ERROR CLASS 11 — `Expected type 'ug', but it was: a custom Object object` (Firestore)
**Example:** `FirebaseError: Expected type 'ug', but it was: a custom Object object at processVisitDeductionFormSubmission (visits.js:682)`
**Cause:** A Firestore `DocumentReference` stored in a `state.js` exported variable (e.g. `_oldVisitLogDocRef`) is passed directly to Firestore operations (`getDoc()`, `updateDoc()`, `deleteDoc()`). Firestore's internal type system (`ug` = DocumentReference type guard) rejects ES module live bindings because they are Proxy-like wrapper objects, not the raw `DocumentReference` instance.
**Affected variables:** Any `state.js` variable that holds a Firestore `DocumentReference` — currently `_oldVisitLogDocRef`.
**Fix:** Capture the imported binding to a local `const` before passing to Firestore:
```js
// ❌ Fails — passes ES module live binding to Firestore
await updateDoc(_oldVisitLogDocRef, { ... });

// ✅ Works — captures to local const first
const logDocRef = _oldVisitLogDocRef;
await updateDoc(logDocRef, { ... });
```
**Detection:** Search for `getDoc(`, `updateDoc(`, `deleteDoc(`, `setDoc(` followed immediately by a state variable name (prefixed with `_` or imported from state.js).
**Rule:** Any state variable that holds a Firestore reference must be captured to a local `const` before being passed to any Firestore SDK function.
