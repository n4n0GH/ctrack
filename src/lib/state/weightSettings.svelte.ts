import type { WeightSettingItem } from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';

export let weightSettings = $state<(WeightSettingItem | DocumentData)[]>([]);
