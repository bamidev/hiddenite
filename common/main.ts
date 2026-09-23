/**
 * Package entry point: re-exports the playback event types and defines the
 * application's canonical name constants used across the desktop and server packages.
 */

export type * from './playback-event.js';

/** Canonical lowercase application name, e.g. used for paths and identifiers. */
export const APP_NAME = 'hiddenite';
/** Display form of the application name, e.g. used in UI text and window titles. */
export const APP_NAME_CAPITALIZED = 'Hiddenite';
