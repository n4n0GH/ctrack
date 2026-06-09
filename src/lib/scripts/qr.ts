import QRCode from 'qrcode';
import type { FirebaseConfig } from '$lib/data/types';

// Envelope tag so a scanned code is recognisably a ctrack config and a random
// QR (a URL, a WiFi code, …) is never mistaken for one.
const CONFIG_QR_APP = 'ctrack-firebase';

type ConfigEnvelope = {
	app: typeof CONFIG_QR_APP;
	config: FirebaseConfig;
};

/**
 * Serialises a Firebase config into the QR payload string (a tagged JSON
 * envelope).
 */
export const encodeConfig = (config: FirebaseConfig): string => {
	const envelope: ConfigEnvelope = { app: CONFIG_QR_APP, config };
	return JSON.stringify(envelope);
};

/**
 * Parses a scanned QR payload back into a Firebase config. Returns null when the
 * text is not a ctrack config envelope or is missing the essential identifiers,
 * so callers can ignore unrelated codes. Only the known config fields are kept.
 */
export const decodeConfig = (text: string): FirebaseConfig | null => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}

	if (typeof parsed !== 'object' || parsed === null) return null;
	const envelope = parsed as Partial<ConfigEnvelope>;
	if (envelope.app !== CONFIG_QR_APP || typeof envelope.config !== 'object' || !envelope.config) {
		return null;
	}

	const c = envelope.config as Partial<FirebaseConfig>;
	// apiKey + projectId are the minimum needed to reach a Firestore project.
	if (!c.apiKey || !c.projectId) return null;

	return {
		apiKey: String(c.apiKey),
		authDomain: String(c.authDomain ?? ''),
		projectId: String(c.projectId),
		storageBucket: String(c.storageBucket ?? ''),
		messagingSenderId: String(c.messagingSenderId ?? ''),
		appId: String(c.appId ?? '')
	};
};

/**
 * Renders the given text to a QR code as a PNG data URL, suitable for an <img>
 * src. A generous margin and error-correction level keep it scannable on a
 * second device's camera.
 */
export const generateQrDataUrl = (text: string): Promise<string> => {
	return QRCode.toDataURL(text, {
		errorCorrectionLevel: 'M',
		margin: 2,
		width: 320
	});
};
