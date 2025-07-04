<script lang="ts">
	import { getUserWeights } from '$lib/state/weight.svelte';
	import { toHumanDate } from '$lib/scripts/helpers';

	let weights = getUserWeights().sort((a, b) => b.date.seconds - a.date.seconds);
</script>

{#each weights as weight}
	<div class="card card-border bg-base-100 mb-4 w-96">
		<div class="card-body">
			<div class="stats">
				<div class="stat">
					<div class="stat-value text-primary">{weight.weight} KG</div>
					<div class="stat-desc">{toHumanDate(weight.date.seconds)}</div>
				</div>
			</div>
		</div>
	</div>
{/each}
