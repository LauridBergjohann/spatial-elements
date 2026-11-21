<script lang="ts">
	let { name, alt, caption }: { name: string; alt: string; caption: string } = $props();
</script>

<figure>
	<img src={`/documentation/diagrams/${name}.svg`} {alt} width="960" height="440" loading="lazy" />
	<figcaption>
		{caption}
		<a href={`/documentation/diagrams/${name}.svg`} target="_blank" rel="noreferrer">
			Open full-size diagram ↗
		</a>
	</figcaption>
</figure>

<style>
	figure {
		margin: 1.5rem 0;
	}
	img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: var(--ps-radius);
		border: 1px solid var(--ps-border);
	}
	figcaption {
		margin-top: 0.75rem;
		color: var(--ps-body);
		max-width: 72ch;
		font-size: 0.9rem;
		line-height: 1.6;
	}
</style>
