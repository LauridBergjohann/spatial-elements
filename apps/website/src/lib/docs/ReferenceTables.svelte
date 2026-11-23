<script lang="ts">
	import { Section } from '@page-sections/svelte';
	import { reference } from './reference';
	import TypeText from './TypeText.svelte';
	let { kind }: { kind: 'type' | 'component' } = $props();
	const entries = $derived(reference.filter((entry) => entry.kind === kind));
</script>

<Section
	section={{
		id: 'index',
		title: 'Index',
		headline: 'Find a definition',
		background: { color: 'standard' }
	}}
>
	<nav aria-label="Reference index">
		<ul>
			{#each entries as entry}<li><a href={`#${entry.id}`}>{entry.name}</a></li>{/each}
		</ul>
	</nav>
</Section>
{#each entries as entry}
	<Section
		section={{
			id: entry.id,
			title: entry.name,
			headline: entry.name,
			headingSize: 'm',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			{#if entry.description}<p>{entry.description}</p>{/if}
			{#if kind === 'type'}<details>
					<summary>Type declaration</summary>
					<pre><code><TypeText value={entry.declaration} /></code></pre>
				</details>{/if}
			{#each entry.variants as variant}
				{#if variant.fields.length}
					{#if entry.variants.length > 1}<h3>{variant.label}</h3>{/if}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (Wide tables need keyboard scrolling.) -->
					<div
						class="table-scroll"
						tabindex="0"
						role="region"
						aria-label={`${entry.name} ${variant.label}`}
					>
						<table>
							<thead><tr><th>Field</th><th>Type</th><th>Presence</th><th>Meaning</th></tr></thead>
							<tbody>
								{#each variant.fields as field}<tr id={field.id || undefined}>
										<td>
											{#if field.id}<a href={`#${field.id}`}>
													<code>{field.name}</code>
												</a>{:else}<code>{field.name}</code>{/if}
										</td>
										<td><code><TypeText value={field.type} /></code></td>
										<td>{field.optional ? 'Optional' : 'Required'}</td>
										<td>
											{field.description ||
												'Use the declared value shape; follow named types for their fields.'}
										</td>
									</tr>{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/each}
		</div>
	</Section>
{/each}

<style>
	ul {
		columns: 3 15rem;
		padding-left: 1.25rem;
	}
	li {
		break-inside: avoid;
		padding-block: 0.3rem;
		overflow-wrap: anywhere;
	}
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 0.85rem;
		line-height: 1.6;
	}
	tr {
		scroll-margin-top: 7rem;
	}
	tr:target {
		background: var(--ps-section-muted);
	}
	td:nth-child(2) {
		min-width: 14rem;
		max-width: 28rem;
	}
	td:last-child {
		min-width: 18rem;
	}
</style>
