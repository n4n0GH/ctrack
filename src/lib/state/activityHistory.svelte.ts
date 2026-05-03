import type { ActivityHistoryItem } from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';

export let activity = $state<{
	history: (ActivityHistoryItem | DocumentData)[];
}>({ history: [] });
