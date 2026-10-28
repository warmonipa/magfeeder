import snapshot from '../generated/mag-sim-data.json';
import evolution from '../generated/mag-evolution.json';
import { ITEM_NAMES } from '../../../assets/js/items_i18n.js';
interface FreshMag { magId: string; def: number; pow: number; dex: number; mind: number; synchro: number; iq: number; }
interface Cell { target: string | string[]; requires?: Record<string, {raw?: string}>; raceRule?: {only?: string[]; deny?: string[]}; unobtainable?: boolean; }
interface MagNode {name: string; pb?: string; triggers?: Record<string,{effect:string;rate:string}|undefined>;}
interface EvolutionClass {stage1:MagNode;stage2:MagNode[];stage3:{special?:MagNode[]|null;A?:MagNode[];B?:MagNode[]};stage4:{male:MagNode;female:MagNode}[];}
export const DATA: {freshMag:FreshMag;mags:Record<string,{stage:number;feedTableId:string;pb?:string}>;magCells:Record<string,Cell>;itemOrder:string[];costs:Record<string,number>} = snapshot;
export const EVOLUTION: {meta:{pbNames:Record<string,string>;effects:Record<string,string>;events:string[]};classes:Record<string,EvolutionClass>} = evolution;
export const STATS = ['def', 'pow', 'dex', 'mind'] as const;
export const SECTIONS = ['Viridia', 'Skyly', 'Purplenum', 'Redria', 'Yellowboze', 'Greenill', 'Bluefull', 'Pinkal', 'Oran', 'Whitill'];
export const CLASSES = [
    ['HUmar', 'HU', 'M', 'Human'], ['HUnewearl', 'HU', 'F', 'Newman'], ['HUcast', 'HU', 'M', 'Android'], ['HUcaseal', 'HU', 'F', 'Android'],
    ['RAmar', 'RA', 'M', 'Human'], ['RAmarl', 'RA', 'F', 'Human'], ['RAcast', 'RA', 'M', 'Android'], ['RAcaseal', 'RA', 'F', 'Android'],
    ['FOmar', 'FO', 'M', 'Human'], ['FOmarl', 'FO', 'F', 'Human'], ['FOnewm', 'FO', 'M', 'Newman'], ['FOnewearl', 'FO', 'F', 'Newman'],
].map(([name, line, gender, race]) => ({ name, line, gender, race }));
export function itemLabel(name: string): string {
    const zh = (ITEM_NAMES as Record<string, string>)[name];
    if (!zh)
        throw new Error('Missing authoritative item name: ' + name);
    return zh === name ? name : zh + '（' + name + '）';
}
export const SPECIES = Object.keys(DATA.mags).sort((a, b) => DATA.mags[a].stage - DATA.mags[b].stage || a.localeCompare(b));
export const PBS: string[] = Object.keys(EVOLUTION.meta.pbNames);
export const MAG_INFO: Record<string, MagNode> = {};
const add = (node: MagNode | undefined) => { if (node?.name)
    MAG_INFO[node.name] = node; };
for (const c of Object.values(EVOLUTION.classes)) {
    add(c.stage1);
    (c.stage2 || []).forEach(add);
    for (const group of ['special', 'A', 'B'] as const)
        (c.stage3?.[group] || []).forEach(add);
    for (const r of c.stage4 || []) {
        add(r.male);
        add(r.female);
    }
}
