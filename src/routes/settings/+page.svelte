<script lang="ts">
	import { settings } from '$lib/state/settings.svelte';
	import Container from '$lib/components/Container.svelte';
</script>

<svelte:head>
	<title>CTrack - Settings</title>
</svelte:head>
<div class="flex flex-wrap">
	<Container>
		<div role="none" class="stats stats-vertical grow">
			<div class="stat">
				<div class="stat-title">Age</div>
				<div class="stat-value">{settings.age} years</div>
			</div>
			<div class="stat">
				<div class="stat-title">Height</div>
				<div class="stat-value">{settings.height} cm</div>
			</div>
			<div class="stat">
				<div class="stat-title">Gender</div>
				<div class="stat-value">{settings.gender}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Deficit</div>
				<div class="stat-value">{settings.deficit} kcal</div>
			</div>
			<div class="stat">
				<div class="stat-title">Starting Weight</div>
				<div class="stat-value">{settings.startingWeight} kg</div>
			</div>
			<div class="stat">
				<div class="stat-title">Activity Factor</div>
				<div class="stat-value">{settings.activityFactor}</div>
			</div>
			<div class="stat">
				<div class="stat-title">User Goal</div>
				<div class="stat-value">{settings.targetIsLoss ? 'Weight Loss' : 'Weight Gain'}</div>
			</div>
		</div>
		{#snippet clickable()}
			<button class="btn btn-soft btn-success grow">Update</button>
		{/snippet}
	</Container>
</div>
