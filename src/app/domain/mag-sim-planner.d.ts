import { Target, Outcome } from "./model";
export function planMag(data: unknown, target: Target, options?: {
    budget?: number;
    deep?: boolean;
}): Outcome;
