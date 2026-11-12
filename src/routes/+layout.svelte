<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.js';
	import Icon from '#lib/components/Icon.svelte';
	import Toasts from '#lib/components/Toasts.svelte';
	import Shortcuts from '#lib/components/Shortcuts.svelte';
	import { MODE_TABS } from '#lib/components/nav.js';

	const { children } = $props();

	let menuOpen = $state(false);
	let showShortcuts = $state(false);

	onMount(() => {
		app.init();
		return () => app.destroy();
	});

	const current = $derived(page.url.pathname.replace(/\/+$/, '') || '/');

	function isActive(href: string): boolean {
		const clean = href.replace(/\/+$/, '') || '/';
		return clean === current;
	}

	function onKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
		if (typing) return;
		if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
			event.preventDefault();
			showShortcuts = !showShortcuts;
		}
		if (event.key === 'Escape') {
			showShortcuts = false;
			menuOpen = false;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<a class="skip-link" href="#main">Skip to the visualisation</a>

<header class="topbar">
	<!-- No aria-label here: an aria-label that does not contain the visible text ("AlgoLens"
	     plus the tagline) is a WCAG 2.5.3 label-in-name failure, which axe reports as serious.
	     The link text itself is the accessible name, and the tagline is marked presentational. -->
	<a class="brand" href="/">
		<span class="mark"><Icon name="logo" size={22} /></span>
		<span class="brand-text">
			<strong>AlgoLens</strong>
			<span class="tag">See how algorithms think.</span>
		</span>
	</a>

	<nav class="tabs" aria-label="Modes">
		{#each MODE_TABS as tab (tab.href)}
			<a class="tab" class:active={isActive(tab.href)} href={tab.href} aria-current={isActive(tab.href) ? 'page' : undefined}>
				<Icon name={tab.icon} size={15} />
				<span>{tab.label}</span>
			</a>
		{/each}
	</nav>

	<div class="topbar-end">
		<button
			class="btn btn-icon"
			onclick={() => (showShortcuts = true)}
			aria-label="Keyboard shortcuts (press question mark)"
			title="Keyboard shortcuts (?)"
		>
			<Icon name="keyboard" size={16} />
		</button>
		<a class="btn btn-icon" href="/settings/" aria-label="Settings" title="Settings">
			<Icon name="settings" size={16} />
		</a>
		<button
			class="btn btn-icon"
			onclick={() => app.cycleTheme()}
			aria-label={app.isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
			title={app.isDark ? 'Light theme' : 'Dark theme'}
		>
			<Icon name={app.isDark ? 'sun' : 'moon'} size={16} />
		</button>
		<button
			class="btn btn-icon menu-btn"
			onclick={() => (menuOpen = !menuOpen)}
			aria-label="Open the mode menu"
			aria-expanded={menuOpen}
		>
			<Icon name="menu" size={16} />
		</button>
	</div>
</header>

{#if menuOpen}
	<nav class="mobile-nav" aria-label="Modes">
		{#each MODE_TABS as tab (tab.href)}
			<a class="tab" class:active={isActive(tab.href)} href={tab.href} onclick={() => (menuOpen = false)}>
				<Icon name={tab.icon} size={16} />
				<span>{tab.label}</span>
			</a>
		{/each}
		<a class="tab" href="/settings/" onclick={() => (menuOpen = false)}>
			<Icon name="settings" size={16} />
			<span>Settings</span>
		</a>
		<a class="tab" href="/privacy/" onclick={() => (menuOpen = false)}>
			<Icon name="shield" size={16} />
			<span>Privacy and Backup</span>
		</a>
	</nav>
{/if}

<main id="main">
	{@render children()}
</main>

<Toasts />

{#if showShortcuts}
	<Shortcuts onclose={() => (showShortcuts = false)} />
{/if}

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 12px;
		height: var(--topbar-h);
		padding: 0 12px;
		background: var(--panel);
		border-bottom: 1px solid var(--border);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ink);
		text-decoration: none;
		flex: none;
	}

	.mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: var(--r-sm);
		background: var(--accent);
		color: var(--accent-ink);
		flex: none;
	}

	.brand-text {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}

	.brand-text strong {
		font-size: 15px;
		letter-spacing: -0.015em;
	}

	.tag {
		font-size: 11px;
		color: var(--ink-3);
		white-space: nowrap;
	}

	.tabs {
		display: flex;
		gap: 2px;
		margin-left: 8px;
		overflow-x: auto;
		scrollbar-width: none;
		flex: 1 1 auto;
		min-width: 0;
	}

	.tabs::-webkit-scrollbar {
		display: none;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: var(--r-sm);
		color: var(--ink-2);
		font-size: 13px;
		font-weight: 500;
		text-decoration: none;
		white-space: nowrap;
	}

	.tab:hover {
		background: var(--panel-2);
		color: var(--ink);
	}

	.tab.active {
		background: var(--accent);
		color: var(--accent-ink);
	}

	.topbar-end {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}

	.menu-btn {
		display: none;
	}

	.mobile-nav {
		display: none;
	}

	main {
		display: block;
		min-height: calc(100dvh - var(--topbar-h));
	}

	@media (max-width: 1000px) {
		.tabs {
			display: none;
		}
		.menu-btn {
			display: inline-flex;
		}
		.mobile-nav {
			position: sticky;
			top: var(--topbar-h);
			z-index: 29;
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 4px;
			padding: 8px 12px;
			background: var(--panel);
			border-bottom: 1px solid var(--border);
		}
		.mobile-nav .tab {
			min-height: 44px;
		}
		.tag {
			display: none;
		}
	}

	@media (max-width: 420px) {
		.brand-text strong {
			font-size: 14px;
		}
	}
</style>
