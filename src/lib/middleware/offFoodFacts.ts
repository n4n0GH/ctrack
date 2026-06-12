/**
 * Open Food Facts client (read-only).
 *
 * Looks up food products by barcode and normalises the sprawling OFF response
 * down to the handful of fields the calorie logger needs. Network errors are
 * thrown so the storage layer can fall back to its cache; a genuine "no such
 * product" resolves to null.
 *
 * Browser/CORS note: the request is a plain GET with only a `fields` query
 * param and no custom headers, so it stays a CORS "simple request" (no
 * preflight) and works directly from the client. Do NOT add an Authorization or
 * User-Agent header here — browsers forbid setting User-Agent anyway, and a
 * custom header would trigger a preflight that OFF can reject.
 */

import type { FoodProduct } from '$lib/data/types';

const BASE = 'https://world.openfoodfacts.org/api/v2';

// Only request the fields we map, to keep the payload small.
const FIELDS = 'code,product_name,brands,nutriments,serving_size';

/**
 * Parses OFF's free-text `serving_size` (e.g. "30 g", "1 portion (45g)") into a
 * gram amount, or undefined when no gram figure is present.
 */
const parseServingGrams = (servingSize: unknown): number | undefined => {
	if (typeof servingSize !== 'string') return undefined;
	const match = servingSize.match(/([\d.]+)\s*g/i);
	if (!match) return undefined;
	const grams = Number(match[1]);
	return Number.isFinite(grams) && grams > 0 ? grams : undefined;
};

/**
 * Normalises a raw OFF product into a FoodProduct, or null when it lacks a
 * usable per-100g energy value (without it the logger has nothing to pre-fill).
 */
const normalize = (barcode: string, product: Record<string, unknown>): FoodProduct | null => {
	const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
	const kcal100 = Number(nutriments['energy-kcal_100g']);
	if (!Number.isFinite(kcal100)) return null;

	const name = [product.product_name, product.brands]
		.map((part) => (typeof part === 'string' ? part.trim() : ''))
		.filter(Boolean)
		.join(' — ');

	const kcalServing = Number(nutriments['energy-kcal_serving']);

	return {
		barcode,
		name: name || 'Unknown product',
		kcal100,
		servingGrams: parseServingGrams(product.serving_size),
		kcalServing: Number.isFinite(kcalServing) && kcalServing > 0 ? kcalServing : undefined
	};
};

/**
 * Fetches a single product by barcode. Returns null when OFF has no such
 * product (or it carries no energy value); throws on network/HTTP failure so
 * the caller can fall back to its cache.
 */
export const fetchProductByBarcode = async (barcode: string): Promise<FoodProduct | null> => {
	const res = await fetch(`${BASE}/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`);
	if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`);
	const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };
	// status 0 = product not found; 1 = found.
	if (json.status !== 1 || !json.product) return null;
	return normalize(barcode, json.product);
};
