/**
 * @module Receipt Scanner
 * @description Uses Azure Computer Vision Read API to extract text from a donated
 * food receipt / confirmation document, then maps the extracted key-value pairs
 * to donation form fields so the UI can autofill the form.
 */

import axios from 'axios';
import multer from 'multer';

// Use in-memory storage — we only need the buffer to forward to Azure, NOT to save it.
const memStorage = multer.memoryStorage();
export const receiptUpload = multer({
    storage: memStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only image or PDF files are accepted for receipt scanning'));
    },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Call Azure Computer Vision Read API (v3.2) and poll until the read result is ready.
 * Returns an array of text lines extracted from the document.
 */
async function extractTextWithAzureOCR(imageBuffer, mimeType) {
    const endpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT?.replace(/\/$/, '');
    const key = process.env.AZURE_COMPUTER_VISION_KEY;

    if (!endpoint || !key) {
        throw new Error('Azure Computer Vision is not configured on the server.');
    }

    const readUrl = `${endpoint}/vision/v3.2/read/analyze`;

    // Submit the image to the Read API (async operation)
    const submitRes = await axios.post(readUrl, imageBuffer, {
        headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': mimeType,
        },
        params: { language: 'en' },
    });

    const operationUrl = submitRes.headers['operation-location'];
    if (!operationUrl) throw new Error('Azure OCR did not return an operation URL.');

    // Poll until succeeded (up to 15s)
    for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise(r => setTimeout(r, 1000));
        const pollRes = await axios.get(operationUrl, {
            headers: { 'Ocp-Apim-Subscription-Key': key },
        });

        if (pollRes.data.status === 'succeeded') {
            const lines = [];
            for (const page of pollRes.data.analyzeResult.readResults) {
                for (const line of page.lines) {
                    lines.push(line.text);
                }
            }
            return lines;
        }

        if (pollRes.data.status === 'failed') {
            throw new Error('Azure OCR read operation failed.');
        }
    }

    throw new Error('Azure OCR timed out. Please try again with a clearer image.');
}

/**
 * Parse raw OCR lines into donation form fields.
 * The document from the photo has a "FIELD: value" structure.
 * We also handle free-text receipts via pattern matching.
 */
function parseReceiptLines(lines) {
    const result = {};
    const fullText = lines.join('\n').toLowerCase();

    // Build a key-value map from lines that contain ":"
    const kvMap = {};
    for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0 && colonIdx < line.length - 1) {
            const rawKey = line.slice(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
            const val = line.slice(colonIdx + 1).trim();
            if (val) kvMap[rawKey] = val;
        }
    }

    // ── Title ──────────────────────────────────────────────────────────────
    const titleKey = findKey(kvMap, ['title', 'item', 'food_item', 'donation_title', 'name']);
    if (titleKey) result.title = kvMap[titleKey];

    // ── Description ────────────────────────────────────────────────────────
    const descKey = findKey(kvMap, ['description', 'desc', 'details', 'notes', 'about']);
    if (descKey) result.description = kvMap[descKey];

    // ── Food Type ──────────────────────────────────────────────────────────
    const foodTypeKey = findKey(kvMap, ['food_type', 'foodtype', 'type', 'food']);
    if (foodTypeKey) {
        result.foodType = normalizeFoodType(kvMap[foodTypeKey]);
    }

    // ── Food Category ─────────────────────────────────────────────────────
    const catKey = findKey(kvMap, ['category', 'food_category', 'cat']);
    if (catKey) result.foodCategory = normalizeFoodCategory(kvMap[catKey]);

    // ── Storage Requirement ───────────────────────────────────────────────
    const storKey = findKey(kvMap, ['storage', 'storage_req', 'storage_requirement', 'store']);
    if (storKey) result.storageReq = normalizeStorage(kvMap[storKey]);

    // ── Quantity ──────────────────────────────────────────────────────────
    const qtyKey = findKey(kvMap, ['quantity', 'qty', 'amount', 'portions', 'servings', 'units', 'weight']);
    if (qtyKey) result.quantity = kvMap[qtyKey];

    // ── Perishability ─────────────────────────────────────────────────────
    const perKey = findKey(kvMap, ['perishability', 'perishable', 'urgency', 'shelf_life']);
    if (perKey) result.perishability = normalizePerishability(kvMap[perKey]);

    // ── Expiry Date ───────────────────────────────────────────────────────
    const expiryVal = kvMap[findKey(kvMap, ['expiry_date', 'expiry', 'best_before', 'use_by', 'expires', 'expiration_date'])] || '';
    if (expiryVal) {
        const parsed = parseDateString(expiryVal);
        if (parsed) result.expiryDate = parsed;
    }

    // ── Expiry Time ───────────────────────────────────────────────────────
    const timeVal = kvMap[findKey(kvMap, ['expiry_time', 'time', 'pickup_time', 'expiry_time'])] || '';
    if (timeVal) {
        const parsed = parseTimeString(timeVal);
        if (parsed) result.expiryTime = parsed;
    }

    // ── Pickup Address ────────────────────────────────────────────────────
    const addrKey = findKey(kvMap, ['pickup_address', 'address', 'location', 'pickup_location', 'venue']);
    if (addrKey) result.pickupAddress = kvMap[addrKey];

    // ── Fallback: free-text scan for dates if not detected above ─────────
    if (!result.expiryDate) {
        const dateMatch = fullText.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) result.expiryDate = dateMatch[1];
    }

    return result;
}

// ─── Normalization Helpers ────────────────────────────────────────────────────

function findKey(map, candidates) {
    for (const c of candidates) {
        if (map[c]) return c;
        // Fuzzy: find any key that starts with any candidate
        const match = Object.keys(map).find(k => k.startsWith(c) || c.startsWith(k));
        if (match) return match;
    }
    return null;
}

function normalizeFoodType(raw) {
    const r = raw.toLowerCase();
    if (r.includes('prepared') || r.includes('cooked') || r.includes('meal') || r.includes('meals')) return 'Prepared Meals';
    if (r.includes('bakery') || r.includes('bread') || r.includes('pastry')) return 'Bakery Items';
    if (r.includes('produce') || r.includes('vegetable') || r.includes('fruit')) return 'Fresh Produce';
    if (r.includes('dairy') || r.includes('milk') || r.includes('cheese')) return 'Dairy Products';
    if (r.includes('packaged') || r.includes('canned') || r.includes('tinned')) return 'Packaged Food';
    if (r.includes('beverage') || r.includes('drink') || r.includes('juice')) return 'Beverages';
    if (r.includes('event') || r.includes('leftover')) return 'Event Leftovers';
    // Return as-is if no match (capitalised)
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function normalizeFoodCategory(raw) {
    const r = raw.toLowerCase();
    if (r.includes('cooked') || r.includes('ready') || r.includes('prepared') || r.includes('hot')) return 'cooked';
    if (r.includes('raw') || r.includes('fresh') || r.includes('uncooked') || r.includes('ingredient')) return 'raw';
    if (r.includes('packaged') || r.includes('canned') || r.includes('sealed') || r.includes('packed')) return 'packaged';
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
    if (r.includes('high') || r.includes('very') || r.includes('urgent') || r.includes('critical')) return 'high';
    if (r.includes('medium') || r.includes('moderate') || r.includes('normal')) return 'medium';
    if (r.includes('low') || r.includes('long') || r.includes('shelf')) return 'low';
    return null;
}

function parseDateString(raw) {
    // Try YYYY-MM-DD
    const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    // Try DD/MM/YYYY or MM/DD/YYYY
    const slash = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slash) {
        const y = slash[3], m = slash[2].padStart(2, '0'), d = slash[1].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Try "March 5, 2026" or "5 March 2026"
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const textDate = raw.toLowerCase().match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/);
    if (textDate) return `${textDate[3]}-${months[textDate[2]]}-${textDate[1].padStart(2, '0')}`;

    const textDate2 = raw.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/);
    if (textDate2) return `${textDate2[3]}-${months[textDate2[1]]}-${textDate2[2].padStart(2, '0')}`;

    return null;
}

function parseTimeString(raw) {
    // HH:MM or HH:MM AM/PM
    const t = raw.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (t) {
        let h = parseInt(t[1]);
        const m = t[2];
        if (t[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
        if (t[3]?.toLowerCase() === 'am' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${m}`;
    }
    return null;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const scanReceipt = async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400);
            throw new Error('No receipt file provided. Please upload an image or PDF.');
        }

        // Extract text via Azure Computer Vision Read API
        const lines = await extractTextWithAzureOCR(req.file.buffer, req.file.mimetype);

        if (!lines || lines.length === 0) {
            return res.status(422).json({
                success: false,
                message: 'Could not extract any text from the uploaded document. Please ensure the image is clear and well-lit.',
                extractedFields: {},
                rawLines: [],
            });
        }

        // Parse extracted text into donation fields
        const extractedFields = parseReceiptLines(lines);

        res.status(200).json({
            success: true,
            extractedFields,
            rawLines: lines,
            totalFieldsExtracted: Object.keys(extractedFields).length,
        });
    } catch (error) {
        next(error);
    }
};
