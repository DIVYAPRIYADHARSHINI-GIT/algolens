export interface ModeTab {
	href: string;
	label: string;
	icon: string;
}

export const MODE_TABS: ModeTab[] = [
	{ href: '/sorting/', label: 'Sorting', icon: 'bars' },
	{ href: '/searching/', label: 'Searching', icon: 'search' },
	{ href: '/pathfinding/', label: 'Pathfinding', icon: 'grid' },
	{ href: '/graphs/', label: 'Graphs', icon: 'graph' },
	{ href: '/compare/', label: 'Compare', icon: 'compare' },
	{ href: '/benchmark/', label: 'Benchmark', icon: 'chart' },
	{ href: '/practice/', label: 'Practice', icon: 'practice' },
	{ href: '/learn/', label: 'Learn', icon: 'learn' }
];
