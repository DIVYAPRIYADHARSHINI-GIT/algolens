<script lang="ts">
	// Custom 24px SVG icon set drawn for AlgoLens. No icon library, no emoji.
	// Every icon is decorative; the control around it carries the accessible name.
	interface Props {
		name: string;
		size?: number;
		stroke?: number;
	}
	const { name, size = 18, stroke = 1.7 }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#if name === 'play'}
		<path d="M8 5.5 18.5 12 8 18.5z" fill="currentColor" stroke-width="1" />
	{:else if name === 'pause'}
		<path d="M9 5v14M15 5v14" stroke-width="2.4" />
	{:else if name === 'step-forward'}
		<path d="M7 5.5 15 12l-8 6.5z" fill="currentColor" stroke-width="1" />
		<path d="M18 5v14" />
	{:else if name === 'step-back'}
		<path d="M17 5.5 9 12l8 6.5z" fill="currentColor" stroke-width="1" />
		<path d="M6 5v14" />
	{:else if name === 'to-end'}
		<path d="M6 5.5 15 12l-9 6.5z" fill="currentColor" stroke-width="1" />
		<path d="M19 4v16" stroke-width="2.2" />
	{:else if name === 'restart'}
		<path d="M4 12a8 8 0 1 0 2.5-5.8" />
		<path d="M4 4v4.5h4.5" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
	{:else if name === 'moon'}
		<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
	{:else if name === 'bars'}
		<path d="M4 20V11M9.3 20V5M14.7 20v-6.5M20 20V8.5" stroke-width="2.4" />
	{:else if name === 'cells'}
		<rect x="3" y="7" width="5.5" height="10" rx="1.2" />
		<rect x="9.25" y="7" width="5.5" height="10" rx="1.2" />
		<rect x="15.5" y="7" width="5.5" height="10" rx="1.2" />
	{:else if name === 'grid'}
		<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
		<path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" stroke-width="1.2" />
	{:else if name === 'graph'}
		<circle cx="6" cy="17" r="2.6" />
		<circle cx="18" cy="17" r="2.6" />
		<circle cx="12" cy="5.5" r="2.6" />
		<path d="m8.3 15.4 2.2-7.2M15.7 15.4 13.5 8.2M8.6 17h6.8" />
	{:else if name === 'search'}
		<circle cx="10.5" cy="10.5" r="6" />
		<path d="m15 15 5 5" />
	{:else if name === 'compare'}
		<path d="M12 3.5v17" stroke-width="1.2" />
		<path d="M4 17V9M8 17v-5M16 17V7M20 17v-6" stroke-width="2.2" />
	{:else if name === 'chart'}
		<path d="M4 20h16" />
		<path d="M4 16.5c3.5 0 4.8-9 7.5-9 2.6 0 4 5 8.5 5" />
	{:else if name === 'practice'}
		<circle cx="12" cy="12" r="8.5" />
		<path d="M9.4 9.4a2.7 2.7 0 1 1 3.4 3.8v1.3" />
		<path d="M12.1 17.2h.01" stroke-width="2.2" />
	{:else if name === 'learn'}
		<path d="M4 5.5h6.2c1 0 1.8.8 1.8 1.8V20a2 2 0 0 0-2-1.8H4z" />
		<path d="M20 5.5h-6.2c-1 0-1.8.8-1.8 1.8V20a2 2 0 0 1 2-1.8H20z" />
	{:else if name === 'settings'}
		<circle cx="12" cy="12" r="3" />
		<path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
	{:else if name === 'shield'}
		<path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />
		<path d="m9 12 2 2 4-4.5" />
	{:else if name === 'link'}
		<path d="M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.5 7" />
		<path d="M14 10a4 4 0 0 0-5.7 0L5.7 12.6a4 4 0 1 0 5.7 5.7l1.1-1.1" />
	{:else if name === 'download'}
		<path d="M12 3.5v11" />
		<path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
		<path d="M4.5 20h15" />
	{:else if name === 'upload'}
		<path d="M12 20V9" />
		<path d="m7.5 13 4.5-4.5L16.5 13" />
		<path d="M4.5 4h15" />
	{:else if name === 'image'}
		<rect x="3.5" y="5" width="17" height="14" rx="1.6" />
		<circle cx="8.8" cy="10" r="1.6" />
		<path d="m4.5 17 4.8-4.5 3.4 3 2.6-2.3 4.2 3.8" />
	{:else if name === 'copy'}
		<rect x="8.5" y="8.5" width="11" height="11" rx="1.6" />
		<path d="M15.5 5.5h-11v11" />
	{:else if name === 'trash'}
		<path d="M5 7h14" />
		<path d="M9 7V4.8h6V7" />
		<path d="M6.5 7 7.4 20h9.2L17.5 7" />
		<path d="M10.3 10.6v6M13.7 10.6v6" stroke-width="1.3" />
	{:else if name === 'save'}
		<path d="M5 4.5h11l3 3V18a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1-1.5z" />
		<path d="M8 4.5v5h7" />
		<path d="M8 19v-5h8v5" />
	{:else if name === 'pencil'}
		<path d="M4.5 19.5h4L19 9a2.1 2.1 0 0 0-3-3L5.5 16.5z" />
		<path d="m14.5 7.5 2.5 2.5" />
	{:else if name === 'wall'}
		<rect x="3.5" y="5.5" width="17" height="13" rx="1.2" />
		<path d="M3.5 10h17M3.5 14.5h17M9 5.5V10M15 10v4.5M9 14.5v4" stroke-width="1.2" />
	{:else if name === 'eraser'}
		<path d="m4.5 16 8-8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8l-5.5 5.5H7z" />
		<path d="M19.5 19.5h-9" />
	{:else if name === 'weight'}
		<path d="M7.5 8.5h9l2 11h-13z" />
		<path d="M9.8 8.5a2.2 2.2 0 1 1 4.4 0" />
	{:else if name === 'close'}
		<path d="m6 6 12 12M18 6 6 18" />
	{:else if name === 'check'}
		<path d="m5 12.5 4.5 4.5L19 7" />
	{:else if name === 'warn'}
		<path d="M12 4.5 21 19.5H3z" />
		<path d="M12 10v4.2" />
		<path d="M12 17.2h.01" stroke-width="2.2" />
	{:else if name === 'info'}
		<circle cx="12" cy="12" r="8.5" />
		<path d="M12 11v5.5" />
		<path d="M12 7.8h.01" stroke-width="2.2" />
	{:else if name === 'sound'}
		<path d="M5 9.5h3L12 6v12l-4-3.5H5z" />
		<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" />
	{:else if name === 'mute'}
		<path d="M5 9.5h3L12 6v12l-4-3.5H5z" />
		<path d="m16 9.5 4.5 5M20.5 9.5 16 14.5" />
	{:else if name === 'keyboard'}
		<rect x="2.5" y="6.5" width="19" height="11" rx="1.6" />
		<path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.3h.01M18 10h.01M8.5 13.3h7" stroke-width="2" />
	{:else if name === 'menu'}
		<path d="M4 7h16M4 12h16M4 17h16" />
	{:else if name === 'chevron'}
		<path d="m8 10 4 4 4-4" />
	{:else if name === 'shuffle'}
		<path d="M3.5 7.5h3.2c3.6 0 6.9 9 10.5 9h3.3" />
		<path d="M3.5 16.5h3.2c1.6 0 3.1-1.8 4.4-3.8" />
		<path d="m17.5 13.5 3 3-3 3M17.5 4.5l3 3-3 3" />
	{:else if name === 'logo'}
		<!-- Lens over bars: the AlgoLens mark. -->
		<path d="M3 20.5V13M7 20.5V8.5M11 20.5v-5M15 20.5V6M19 20.5v-9" stroke-width="2" />
		<circle cx="14" cy="9" r="6" stroke-width="1.8" />
		<path d="m18.4 13.4 3.1 3.1" stroke-width="1.8" />
	{/if}
</svg>
