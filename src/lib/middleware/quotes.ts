/**
 * Motivational quote client.
 *
 * Uses DummyJSON's free, key-less quotes API, which sends permissive CORS
 * headers so it can be called directly from the browser (no backend/proxy).
 * Throws on network/HTTP failure so the caller can fall back to a cached quote.
 */

const ENDPOINT = 'https://dummyjson.com/quotes/random';

/**
 * Fetches a single random quote. Throws on failure.
 */
export const fetchQuote = async (): Promise<{ quote: string; author: string }> => {
	const res = await fetch(ENDPOINT);
	if (!res.ok) throw new Error(`Quotes API responded ${res.status}`);
	const data = (await res.json()) as { quote?: unknown; author?: unknown };
	const quote = typeof data.quote === 'string' ? data.quote : '';
	const author = typeof data.author === 'string' ? data.author : 'Unknown';
	if (!quote) throw new Error('Quotes API returned no quote text');
	return { quote, author };
};
