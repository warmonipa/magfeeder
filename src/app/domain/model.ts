export type Stat = 'def' | 'pow' | 'dex' | 'mind';
export interface Feeder {
    class: string;
    gender: string;
    race: string;
    sectionId: string;
}
export interface Start {
    mode: string;
    magId?: string;
    def?: number;
    pow?: number;
    dex?: number;
    mind?: number;
    synchro?: number;
    iq?: number;
    pbs?: string[];
}
export interface LogEntry {
    kind: string;
    item: string;
    from: string;
    to: string;
    level: number;
    ok: boolean;
    reason?: string;
    on?: boolean;
}
export interface State {
    magId: string;
    def: number;
    pow: number;
    dex: number;
    mind: number;
    synchro: number;
    iq: number;
    progress: Record<Stat, number>;
    feeder: Feeder;
    racialRestriction: boolean;
    pbs: string[];
    log: LogEntry[];
    _start: Start;
    _racial0: boolean;
}
export interface Target {
    magId: string;
    def: number;
    pow: number;
    dex: number;
    mind: number;
}
export interface Plan {
    approximate?: boolean;
    segments: {
        feeder: Feeder;
        feeds: {
            item: string;
            count: number;
        }[];
        order: {
            bank?: boolean;
            item: string;
        }[];
        banks: number;
        magFrom: string;
        magTo: string;
        viaCell?: string;
        evoLevel: number;
    }[];
    totals: {
        items: number;
        meseta: number;
        cycles: number;
        banks: number;
    };
}
export interface Outcome {
    plan: Plan | null;
    nearest: (Target & {
        dist: number;
    }) | null;
    reason: string;
}
