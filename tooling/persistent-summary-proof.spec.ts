import { describe, expect, it } from 'vitest';
import { ProofHandoff } from '../apps/tests/src/lib/persistence-proof/handoff';

describe('persistent summary ownership proof', () => {
	it('retains ownership across source cleanup and releases the destination exactly once', () => {
		let disposed = 0;
		const owner = new ProofHandoff('source', () => {}, () => disposed++);
		const source = owner.claimRoute('source');
		const transition = owner.begin('target');
		expect(source.release()).toBe(false);
		expect(disposed).toBe(0);
		transition.finishMotion();
		const target = owner.claimRoute('target');
		transition.commit();
		expect(owner.snapshot.slot).toBe('target');
		expect(owner.claimRoute('source').release()).toBe(false);
		expect(transition.commit()).toBe(false);
		expect(target.isCurrent()).toBe(true);
		expect(target.release()).toBe(true);
		owner.destroy();
		expect(disposed).toBe(1);
	});
	it('freezes width and content through motion and route handoff', () => {
		const owner = new ProofHandoff('source', () => {}, () => {});
		const transition = owner.begin('wide');
		owner.queueContentChange();
		expect(owner.snapshot).toMatchObject({ queryWidth: 320, contentRevision: 0, phase: 'motion' });
		transition.finishMotion();
		expect(owner.snapshot).toMatchObject({ queryWidth: 320, contentRevision: 0, phase: 'handoff' });
		transition.commit();
		expect(owner.snapshot).toEqual({ slot: 'wide', phase: 'settled', queryWidth: 960, contentRevision: 1 });
	});
	it('rejects stale commits/releases after a newer navigation and permits cancellation', () => {
		let disposed = 0;
		const owner = new ProofHandoff('source', () => {}, () => disposed++);
		const source = owner.claimRoute('source');
		const first = owner.begin('target');
		const second = owner.begin('wide');
		expect(first.finishMotion()).toBe(false);
		expect(first.commit()).toBe(false);
		expect(first.cancel()).toBe(false);
		expect(source.release()).toBe(false);
		const superseded = owner.claimRoute('target');
		expect(superseded.isCurrent()).toBe(false);
		expect(superseded.release()).toBe(false);
		expect(second.cancel()).toBe(true);
		expect(second.commit()).toBe(false);
		expect(owner.snapshot).toMatchObject({ slot: 'source', queryWidth: 320, phase: 'settled' });
		owner.destroy(); owner.destroy();
		expect(disposed).toBe(1);
	});
});
