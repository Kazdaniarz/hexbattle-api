/*
 * Standard board layout: axial flat-top hexes, play area of radius 2 (19 hexes) and the outer ring.
 */
import type { Board } from '@hexbattle/schema';

/* * Geometry */

/** Axial step per edge direction, clockwise from the top (edge 0 = N). */
export const DIRECTIONS: Board['directions'] = [
	{ edge: 0, dq: 0, dr: -1 },
	{ edge: 1, dq: 1, dr: -1 },
	{ edge: 2, dq: 1, dr: 0 },
	{ edge: 3, dq: 0, dr: 1 },
	{ edge: 4, dq: -1, dr: 1 },
	{ edge: 5, dq: -1, dr: 0 },
];

const PLAY_RADIUS = 2;
const RING_RADIUS = PLAY_RADIUS + 1;

function hexId(q: number, r: number): string {
	return `${String(q)},${String(r)}`;
}

function distance(q: number, r: number): number {
	return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

function step(index: number): { dq: number; dr: number } {
	const direction = DIRECTIONS[index % DIRECTIONS.length];
	if (!direction) throw new Error(`no direction ${String(index)}`);
	return direction;
}

/* * Board */

/** The standard board: play hexes sorted by (q, r), then the outer ring clockwise from the N corner. */
export function standardBoard(): Board {
	const play: Board['hexes'] = [];
	for (let q = -PLAY_RADIUS; q <= PLAY_RADIUS; q++) {
		for (let r = -PLAY_RADIUS; r <= PLAY_RADIUS; r++) {
			if (distance(q, r) <= PLAY_RADIUS) {
				play.push({ id: hexId(q, r), q, r, zone: 'play' });
			}
		}
	}

	// ? walk the ring clockwise: start at the N corner, then RING_RADIUS steps along each side
	const ring: Board['hexes'] = [];
	let q = 0;
	let r = -RING_RADIUS;
	for (let side = 0; side < 6; side++) {
		const { dq, dr } = step(side + 2);
		for (let i = 0; i < RING_RADIUS; i++) {
			ring.push({ id: hexId(q, r), q, r, zone: i === 0 ? 'outer_corner' : 'outer_side' });
			q += dq;
			r += dr;
		}
	}

	const sides = ring.filter((hex) => hex.zone === 'outer_side').map((hex) => hex.id);
	// ? the two side hexes around each corner: the last one before it and the first one after it
	const virtualLinks = Array.from({ length: 6 }, (_, corner): [string, string] => [
		sides[(corner * 2 + sides.length - 1) % sides.length] ?? '',
		sides[corner * 2] ?? '',
	]);

	return {
		id: 'standard',
		name: { pl: 'Plansza standardowa', en: 'Standard board' },
		orientation: 'flat_top',
		coordinates: 'axial',
		directions: DIRECTIONS,
		hexes: [...play, ...ring],
		zone_roles: { outer_side: ['water'], outer_corner: ['water_link_marker', 'technology'] },
		virtual_links: virtualLinks,
		water_ring: sides,
		hp_track: { min: 0, max: 20 },
	};
}
