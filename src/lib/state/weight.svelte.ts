import type { WeightItem } from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';

export let userWeights = $state<(WeightItem | DocumentData)[]>([]);
