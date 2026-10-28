import { LogEntry, State } from '../domain/model';
import { itemLabel } from '../domain/data';
import { magLevel } from '../domain/mag-sim-engine.js';
export function logText(e: LogEntry): string {
    if (e.kind === 'evolve')
        return '→ 进化：' + itemLabel(e.from) + ' → ' + itemLabel(e.to) + '（Lv ' + e.level + '）';
    if (e.kind === 'bank')
        return '存银行：小数进度向下取偶';
    if (e.kind === 'racial')
        return '规则切换：经典 PSO 种族限制' + (e.on ? '开启' : '关闭');
    if (e.kind === 'feedCell')
        return (e.ok ? '✓' : '✗') + ' 喂食 Cell：' + itemLabel(e.item) + (e.ok ? '' : '（未生效：' + (e.reason || '未满足条件') + '）');
    return '喂食：' + itemLabel(e.item);
}
export function sessionText(s: State) { return [...(s.log.length ? s.log.map(logText) : ['尚未喂食']), '', '---- 最终 Mag ----', '种类：' + itemLabel(s.magId), '等级：Lv ' + magLevel(s) + ' / 200', 'DEF ' + s.def + '｜POW ' + s.pow + '｜DEX ' + s.dex + '｜MIND ' + s.mind, '同步率：' + s.synchro + ' / 120', 'IQ：' + s.iq + ' / 200'].join('\n'); }
