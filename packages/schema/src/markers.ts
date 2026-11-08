/*
 * Marker types (`markers.json`): Rana, Sieć, Inicjatywa, Znacznik Sztabu and later army markers.
 */
import { z } from 'zod';
import { AssetRef, Id, Text } from './common.ts';

/* * Marker */

/** Where a marker is put during a match. */
export const MarkerPlacement = z.enum(['unit', 'hex', 'hp_track', 'tech_field', 'beside_board', 'board_corner']);
export type MarkerPlacement = z.infer<typeof MarkerPlacement>;

/** One marker type. Counts and pool types live on the army; the HP marker image lives on the army too. */
export const MarkerType = z
	.strictObject({
		id: Id,
		name: Text,
		unlimited: z.boolean(),
		// ? two printed sides (e.g. traps with a shared blank reverse)
		two_sided: z.boolean(),
		placement: MarkerPlacement,
		images: z
			.strictObject({
				front: AssetRef.optional(),
				back: AssetRef.optional(),
				// ? blank disc on which the app draws the value (Inicjatywa)
				blank: AssetRef.optional(),
			})
			.optional(),
		size: z.enum(['standard', 'small']),
		// ? false = digital-only helper with no physical counterpart
		official_component: z.boolean(),
	})
	.meta({ id: 'MarkerType' });
export type MarkerType = z.infer<typeof MarkerType>;

/* * File */

/** Source and published file `markers.json`. */
export const MarkersFile = z
	.strictObject({
		markers: z.array(MarkerType).min(1),
	})
	.meta({ id: 'MarkersFile' });
export type MarkersFile = z.infer<typeof MarkersFile>;
