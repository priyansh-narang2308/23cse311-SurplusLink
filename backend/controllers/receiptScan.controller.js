/**
 * @module Receipt Scanner — Azure Document Intelligence ONLY
 * @description Uses Azure Document Intelligence (prebuilt-layout model) to scan
 * and extract text from food donation receipts. The DI-extracted lines are then
 * parsed using a multi-line key-value parser to map fields to the donation form.
 *
 * This module does NOT use Azure Computer Vision.
 *
 * Required .env variables:
 *   AZURE_DOCUMENT_INTELLIGENCE_KEY       — DI resource key
 *   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT  — e.g. https://my-di.cognitiveservices.azure.com
 */

import axios from 'axios';
import multer from 'multer';

// In-memory storage — the receipt image is forwarded to Azure; never saved to disk
const memStorage = multer.memoryStorage();
export const receiptUpload = multer({
    storage: memStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'application/pdf', 'image/tiff'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only image (JPEG, PNG, WEBP, BMP, TIFF) or PDF files are accepted'));
    },
});

// ─── Step 1: Call Azure Document Intelligence ─────────────────────────────────

/**
 * Submits the image to Azure Document Intelligence (prebuilt-layout) and polls
 * until the analysis is complete. Returns the full analyzeResult object.
 */
async function analyzeWithDI(imageBuffer, mimeType) {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.replace(/\/$/, '');
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

    if (!endpoint || !key) {
        throw new Error(
            'Azure Document Intelligence is not configured. ' +
            'Please set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY in .env'
        );
    }

    // Use prebuilt-layout: confirmed working on this resource
    const analyzeUrl =
        `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30`;

    // Submit: POST the image buffer directly
    const submitRes = await axios.post(analyzeUrl, imageBuffer, {
        headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': mimeType,
        },
    });

    const operationUrl = submitRes.headers['operation-location'];
    if (!operationUrl) throw new Error('Document Intelligence did not return an operation-location URL.');

    // Poll until succeeded (max 30 s)
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const poll = await axios.get(operationUrl, {
            headers: { 'Ocp-Apim-Subscription-Key': key },
        });

        if (poll.data.status === 'succeeded') return poll.data.analyzeResult;
        if (poll.data.status === 'failed') {
            throw new Error('DI analysis failed: ' + JSON.stringify(poll.data.error ?? {}));
        }
    }

    throw new Error('Document Intelligence timed out. Please try again.');
}

// ─── Step 2: Extract text lines from DI result ───────────────────────────────

/**
 * Pulls all text lines from the DI analyzeResult pages.
 * Also tries to use native keyValuePairs if the model detected them.
 */
function extractFromDIResult(analyzeResult) {
    // Collect lines from DI pages (this is always available)
    const lines = [];
    for (const page of (analyzeResult.pages ?? [])) {
        for (const line of (page.lines ?? [])) {
            lines.push(line.content ?? line.text ?? '');
        }
    }

    // Try native key-value pairs first (returned by prebuilt-layout when detected)
    const rawKVPairs = analyzeResult.keyValuePairs ?? [];
    const nativeKV = {};
    for (const pair of rawKVPairs) {
        if (!pair.value?.content) continue;
        const normKey = (pair.key?.content ?? '')
            .toLowerCase()
            .replace(/:$/, '')
            .replace(/\s+/g, '_')
            .trim();
        if (normKey) nativeKV[normKey] = pair.value.content.trim();
    }

    return { lines, nativeKV };
}

// ─── Step 3: Parse multi-line text into key-value pairs ──────────────────────

/**
 * Handles the common receipt format where key and value are on SEPARATE lines:
 *
 *   "TITLE:"                   ← key line (nothing after colon)
 *   "Surplus Chicken Biryani"  ← value on the next line
 *   "QUANTITY:"
 *   "15 Portions"
 *
 * Returns a flat object { normalisedKey: value }.
 */
function parseMultiLineText(lines) {
    const kvMap = {};
    let i = 0;

    // Build a map of all lines for easier lookahead
    const trimmedLines = lines.map(l => l.trim()).filter(l => l.length > 0);

    while (i < trimmedLines.length) {
        const line = trimmedLines[i];
        const colonIdx = line.indexOf(':');

        if (colonIdx > 0) {
            const rawKey = line.slice(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
            let val = line.slice(colonIdx + 1).trim();

            if (!val) {
                // Value is on the next line(s) — collect until the next KEY: line
                const parts = [];
                let j = i + 1;
                while (j < trimmedLines.length) {
                    const next = trimmedLines[j];
                    // Stop when we hit another "KEY:" pattern (at least 2 caps/chars + colon)
                    if (/^[A-Z][A-Z\s]{2,}:/.test(next)) break;
                    parts.push(next);
                    j++;
                    if (parts.length >= 3) break; // limit multi-line values to 3 lines
                }
                val = parts.join(' ');
                // If we found a value, skip those lines in the next iteration
                if (val) {
                    kvMap[rawKey] = val;
                    i = j;
                    continue;
                }
            } else {
                if (rawKey && val) kvMap[rawKey] = val;
            }
        }
        i++;
    }

    return kvMap;
}

// ─── Step 4: Map parsed KV → donation form fields ────────────────────────────

function mapToDonationFields(kvMap) {
    const result = {};

    const get = (...candidates) => {
        // First try exact matches among the candidates
        for (const c of candidates) {
            if (kvMap[c]) return kvMap[c];
        }
        // Then try fuzzy matches: any stored key that contains any candidate
        for (const c of candidates) {
            const match = Object.keys(kvMap).find(k => k.includes(c) || c.includes(k));
            if (match) return kvMap[match];
        }
        return null;
    };

    // Title
    const title = get('title', 'donation_title', 'food_item', 'item', 'name');
    if (title) result.title = title;

    // Description
    const desc = get('description', 'desc', 'details', 'notes');
    if (desc) result.description = desc;

    // Food Type
    const rawFoodType = get('food_type', 'foodtype', 'type');
    if (rawFoodType) result.foodType = normalizeFoodType(rawFoodType);

    // Food Category
    const rawCat = get('category', 'food_category', 'cat');
    if (rawCat) result.foodCategory = normalizeFoodCategory(rawCat);

    // Storage
    const rawStorage = get('storage', 'storage_req', 'storage_requirement');
    if (rawStorage) result.storageReq = normalizeStorage(rawStorage);

    // Quantity
    const qty = get('quantity', 'qty', 'amount', 'portions', 'servings', 'units');
    if (qty) result.quantity = qty;

    // Perishability
    const rawPerish = get('perishability', 'perishable', 'urgency');
    if (rawPerish) result.perishability = normalizePerishability(rawPerish);

    // Expiry Date
    const rawDate = get('expiry_date', 'expiry', 'best_before', 'use_by', 'expires', 'expiration_date', 'expiration');
    if (rawDate) {
        const d = parseDateString(rawDate);
        if (d) result.expiryDate = d;
    }

    // Expiry Time
    const rawTime = get('expiry_time', 'time');
    if (rawTime) {
        const t = parseTimeString(rawTime);
        if (t) result.expiryTime = t;
    }

    // Pickup Address
    const addr = get('pickup_address', 'address', 'location', 'pickup_location', 'venue');
    if (addr) result.pickupAddress = addr;

    return result;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

function normalizeFoodType(raw) {
    const r = raw.toLowerCase();
    if (r.includes('prepared') || r.includes('ready') || r.includes('meal')) return 'Prepared Meals';
    if (r.includes('bakery') || r.includes('bread') || r.includes('pastry')) return 'Bakery Items';
    if (r.includes('produce') || r.includes('vegetable') || r.includes('fruit')) return 'Fresh Produce';
    if (r.includes('dairy') || r.includes('milk') || r.includes('cheese')) return 'Dairy Products';
    if (r.includes('packaged') || r.includes('canned') || r.includes('tinned')) return 'Packaged Food';
    if (r.includes('beverage') || r.includes('drink') || r.includes('juice')) return 'Beverages';
    if (r.includes('event') || r.includes('leftover')) return 'Event Leftovers';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function normalizeFoodCategory(raw) {
    const r = raw.toLowerCase();
    if (r.includes('cooked') || r.includes('ready') || r.includes('prepared') || r.includes('hot')) return 'cooked';
    if (r.includes('raw') || r.includes('fresh') || r.includes('uncooked') || r.includes('ingredient')) return 'raw';
    if (r.includes('packaged') || r.includes('canned') || r.includes('sealed')) return 'packaged';
    return null;
}

function normalizeStorage(raw) {
    const r = raw.toLowerCase();
    if (r.includes('frozen') || r.includes('freeze')) return 'frozen';
    if (r.includes('cold') || r.includes('refrigerat') || r.includes('chill') || r.includes('cool')) return 'cold';
    if (r.includes('dry') || r.includes('room') || r.includes('ambient')) return 'dry';
    return null;
}

function normalizePerishability(raw) {
    const r = raw.toLowerCase();
    if (r.includes('high') || r.includes('very') || r.includes('urgent')) return 'high';
    if (r.includes('medium') || r.includes('moderate') || r.includes('normal')) return 'medium';
    if (r.includes('low') || r.includes('long') || r.includes('shelf')) return 'low';
    return null;
}

function parseDateString(raw) {
    // YYYY-MM-DD
    const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    // DD/MM/YYYY
    const slash = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slash) return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
    // "5 March 2026" or "March 5, 2026"
    const M = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const t1 = raw.toLowerCase().match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/);
    if (t1) return `${t1[3]}-${M[t1[2]]}-${t1[1].padStart(2, '0')}`;
    const t2 = raw.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/);
    if (t2) return `${t2[3]}-${M[t2[1]]}-${t2[2].padStart(2, '0')}`;
    return null;
}

function parseTimeString(raw) {
    const t = raw.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (!t) return null;
    let h = parseInt(t[1]);
    const m = t[2];
    if (t[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
    if (t[3]?.toLowerCase() === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const scanReceipt = async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400);
            throw new Error('No receipt file provided. Please upload an image or PDF.');
        }

        // ── Call Azure Document Intelligence ─────────────────────────────
        const analyzeResult = await analyzeWithDI(req.file.buffer, req.file.mimetype);

        // ── Extract text lines + any native KV pairs from DI result ───────
        const { lines, nativeKV } = extractFromDIResult(analyzeResult);

        if (lines.length === 0) {
            return res.status(422).json({
                success: false,
                message: 'Document Intelligence could not read any text from this document. Please ensure the image is clear and well-lit.',
                extractedFields: {},
                rawLines: [],
            });
        }

        // ── Parse the lines into a KV map (handles multi-line format) ─────
        const parsedKV = parseMultiLineText(lines);

        // Merge: native DI KV pairs take priority; parsed lines fill the gaps
        const mergedKV = { ...parsedKV, ...nativeKV };

        // ── Map to donation form fields ───────────────────────────────────
        const extractedFields = mapToDonationFields(mergedKV);

        if (Object.keys(extractedFields).length === 0) {
            return res.status(422).json({
                success: false,
                message: 'Could not map any fields from this document. Please ensure it follows the expected format (FIELD: Value).',
                extractedFields: {},
                rawLines: lines,
            });
        }

        res.status(200).json({
            success: true,
            extractedFields,
            rawLines: lines,
            totalFieldsExtracted: Object.keys(extractedFields).length,
            method: 'Azure Document Intelligence (prebuilt-layout)',
        });

    } catch (error) {
        next(error);
    }
};
