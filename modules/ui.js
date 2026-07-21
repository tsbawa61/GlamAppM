// ui.js — GlamTrack (pack UI helpers + renderHomePage)
import { activeSessionUser, salonOwnerNameContext, allotCurrentPackTotalAmount, setAllotCurrentPackTotalAmount, allotPacksCache, _allotExistingPacks, _allotExistingIdx } from "./state.js";
;

export function updatePackDiscountDisplay() {
    const priceEl = document.getElementById("pack-price");
    const totalAmtEl = document.getElementById("pack-total-amt");
    const discountEl = document.getElementById("pack-discount-display");
    if (!priceEl || !totalAmtEl || !discountEl) return;

    const price = parseFloat(priceEl.value);
    const totalAmt = parseFloat(totalAmtEl.value);

    if (!isNaN(price) && !isNaN(totalAmt) && totalAmt > 0 && price >= 0) {
        // Point 17: price cannot exceed totalAmt
        if (price > totalAmt) {
            priceEl.value = totalAmt;
            discountEl.textContent = "⚠️ Price cannot exceed Total Amount — reset to match.";
            discountEl.className = "text-danger fw-bold small text-nowrap";
            return;
        }
        const discount = ((totalAmt - price) / totalAmt) * 100;
        if (discount > 0) {
            discountEl.textContent = `${discount.toFixed(1)}% discount`;
            discountEl.className = "text-success fw-bold small text-nowrap";
        } else if (discount < 0) {
            discountEl.textContent = `${Math.abs(discount).toFixed(1)}% above list`;
            discountEl.className = "text-danger fw-bold small text-nowrap";
        } else {
            discountEl.textContent = "No discount";
            discountEl.className = "text-muted fw-bold small text-nowrap";
        }
    } else {
        discountEl.textContent = "";
    }
}

export function updatePackSubServicesRunningSum() {
    const sumEl = document.getElementById("pack-subservices-sum");
    if (!sumEl) return;

    const checked = document.querySelectorAll(".chk-pack-subservice:checked");
    let total = 0;
    checked.forEach((input) => {
        total += Number(input.getAttribute("data-rate")) || 0;
    });

    const count = checked.length;
    sumEl.textContent = count === 0
        ? "Selected items total: ₹0"
        : `Selected items total: ₹${total.toLocaleString("en-IN")} (${count} item${count === 1 ? "" : "s"} selected)`;

    // Only auto-update pack-total-amt for Type1/Type2 — Type3 has manual entry
    const packType = document.getElementById("pack-type-select")?.value;
    if (packType !== "Type3") {
        const totalAmtEl = document.getElementById("pack-total-amt");
        if (totalAmtEl) {
            totalAmtEl.value = count === 0 ? "" : total;
            updatePackDiscountDisplay();
        }
    }
}

// ── Dynamic UI for pack type ────────────────────────────────────────────────
export function applyPackTypeUI(packType) {
    const totalAmtEl   = document.getElementById("pack-total-amt");
    const totalAmtLbl  = document.getElementById("lbl-pack-total-amt");
    const subLbl       = document.getElementById("lbl-pack-subservices");

    if (packType === "Type3") {
        // Editable total, mandatory, different placeholder
        if (totalAmtEl) {
            totalAmtEl.readOnly = false;
            totalAmtEl.required = true;
            totalAmtEl.placeholder = "Enter Total Price of Services";
        }
        if (totalAmtLbl) totalAmtLbl.textContent = "Total Price of Services (₹)";
        if (subLbl) subLbl.textContent = "Choose Individual Service Items NOT allowed in this Pack";
    } else {
        // Type1 / Type2 — original behaviour
        if (totalAmtEl) {
            totalAmtEl.readOnly = true;
            totalAmtEl.required = false;
            totalAmtEl.placeholder = "Sum of all included individual services";
        }
        if (totalAmtLbl) totalAmtLbl.textContent = "Total Price of Individual Services (₹)";
        if (subLbl) subLbl.textContent = "Choose Individual Service Items Allowed in this Pack";
    }
}

let _galleryTimer = null;
export function renderHomePage(role) {
    // Display suppressed — content retained for future use
    return;
    /* eslint-disable no-unreachable */
    const sec = document.getElementById("sec-home");
    if (!sec) return;
    if (_galleryTimer) { clearInterval(_galleryTimer); _galleryTimer = null; }
    if (role === "SUPER_USER" || role === "OWNER") {
        sec.style.backgroundImage = "url('WaterMarkVaultGlamApp.png')";
        sec.style.backgroundSize = "contain";
        sec.style.backgroundRepeat = "no-repeat";
        sec.style.backgroundPosition = "center center";
        sec.style.minHeight = "70vh";
    } else {
        sec.style.backgroundImage = "";
        sec.style.minHeight = "";
    }
    const galleryEl = document.getElementById("home-gallery");
    if (!galleryEl) return;
    if (role !== "OWNER") { galleryEl.style.display = "none"; return; }
    galleryEl.style.display = "block";
    const images = Array.from({length: 8}, (_, i) => `sample_package_${i + 1}.png`);
    const pages  = [images.slice(0, 4), images.slice(4, 8)];
    let pageIdx  = 0;
    const showPage = (idx) => {
        const grid = document.getElementById("home-gallery-grid");
        if (!grid) return;
        grid.innerHTML = "";
        pages[idx].forEach(src => {
            const col = document.createElement("div");
            col.className = "col-6";
            col.innerHTML = `<img src="${src}" alt="" class="img-fluid rounded shadow-sm" style="width:100%;height:200px;object-fit:contain;background:#f8f9fa;">`;
            grid.appendChild(col);
        });
        document.querySelectorAll(".home-gallery-dot").forEach((d, i) => {
            d.classList.toggle("bg-dark",      i === idx);
            d.classList.toggle("bg-secondary", i !== idx);
        });
    }
    showPage(0);
    _galleryTimer = setInterval(() => { pageIdx = (pageIdx + 1) % pages.length; showPage(pageIdx); }, 4000);
    document.querySelectorAll(".home-gallery-dot").forEach((dot, i) => {
        dot.addEventListener("click", () => { pageIdx = i; showPage(pageIdx); });
    });
    /* eslint-enable no-unreachable */
}
