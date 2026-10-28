import { State, Start } from "./model";
export function createState(data: unknown, options: {
    start: Start;
}): State;
export function magLevel(state: State): number;
export function feedOnce(data: unknown, state: State, item: string): unknown;
export function bankMag(data: unknown, state: State): void;
export function setRacialRestriction(state: State, on: boolean): void;
export function feedCycles(log: State["log"]): number;
export function consumesFeed(entry: State["log"][number]): boolean;
export function exportSession(state: State): unknown;
export function replaySession(data: unknown, session: unknown): State;
