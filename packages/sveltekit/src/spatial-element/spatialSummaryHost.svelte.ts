import { hydrate, mount, unmount, untrack } from 'svelte';
import { PresentationLease } from '@spatial-elements/core/catalog/PresentationLease';
import SpatialSummaryRoot from './SpatialSummaryRoot.svelte';
import type { SpatialCardContext, SpatialPresentationModel, SpatialSummaryContext, SpatialSummarySnippet } from './spatialSummary.js';

export const SPATIAL_SUMMARY_HOST = Symbol('spatial-summary-host');
type PresentationContext = SpatialSummaryContext | SpatialCardContext;
interface Placement { release?: () => unknown; }
export interface SummaryRecord {
 key: string;
 readonly kind: SpatialPresentationModel['kind'];
 root: HTMLElement;
 slot: HTMLElement;
 model: SpatialPresentationModel;
 component: ReturnType<typeof mount>;
 lease: PresentationLease<HTMLElement>;
 owner: ReturnType<PresentationLease<HTMLElement>['claim']>;
 frozen?: { css: string; box: DOMRect; width: number; height: number; inert: boolean; pending?: PresentationContext };
 held: boolean;
}
export interface RetainedSpatialPresentation {
 record: SummaryRecord;
 /** Freeze the source box/query without reparenting or releasing endpoint claims. */
 freeze(): DOMRect;
 /** Move the entire delegated-event root to a persistent host after the motion phase. */
 hold(targetHost: HTMLElement): DOMRect;
 /** Only equal summary renderers transfer state. Card-to-summary changes in the content phase. */
 adopt(slot: HTMLElement, key?: string, context?: SpatialSummaryContext): boolean;
 /** Restore a cancelled source and transfer cleanup ownership back to its surviving route slot. */
 restore(): boolean;
 unfreeze(): void;
 release(): boolean;
}

/** Real Svelte instance ownership is independent of a route's placement node. */
export class SpatialSummaryHostController {
 private records = new Map<string, SummaryRecord>();
 private roots = new Set<SummaryRecord>();
 private placements = new WeakMap<HTMLElement, Placement>();
 private disposed = false;
 constructor(readonly content: () => SpatialSummarySnippet, readonly contexts: Map<unknown, unknown>) {}
 attach(slot: HTMLElement, key: string, context: SpatialSummaryContext) {
  return this.attachModel(slot, key, { kind: 'summary', current: context, active: true });
 }
 attachCard(slot: HTMLElement, key: string, context: SpatialCardContext) {
  return this.attachModel(slot, key, { kind: 'card', current: context, active: true });
 }
 private attachModel(slot: HTMLElement, key: string, initial: SpatialPresentationModel) {
  let active = true;
  const placement: Placement = {};
  this.placements.set(slot, placement);
  queueMicrotask(() => {
   if (!active || this.disposed) return;
   const previous = this.records.get(key);
   if (previous && !previous.held) throw new Error(`Duplicate presentation occurrence: ${key}`);
   let root = slot.querySelector<HTMLElement>('[data-spatial-presentation-root]');
   const serverRoot = Boolean(root);
   if (!root) {
    root = document.createElement('div');
    root.dataset.spatialPresentationRoot = '';
    root.className = initial.kind === 'card' ? 'spatial-card-root' : 'spatial-summary-island';
    slot.append(root);
   }
   root.dataset.spatialPresentationKey = key;
   const model = $state(initial);
   if (model.kind === 'summary') {
    root.style.setProperty('--spatial-summary-content-inset', `${model.current.contentInset}px`);
    root.dataset.presentationMode = model.current.mode;
   }
   const options = { target: root, props: { content: this.content(), model }, context: this.contexts };
   const component = serverRoot ? hydrate(SpatialSummaryRoot, { ...options, recover: false }) : mount(SpatialSummaryRoot, options);
   const lease = new PresentationLease(root, () => {
    void unmount(component);
    root.remove();
    if (this.records.get(record.key) === record) this.records.delete(record.key);
    this.roots.delete(record);
   });
   const owner = lease.claim();
   const record: SummaryRecord = { key, kind: model.kind, root, slot, model, component, lease, owner, held: false };
   placement.release = owner.release;
   this.records.set(key, record);
   this.roots.add(record);
  });
  return () => { active = false; placement.release?.(); this.placements.delete(slot); };
 }
 update(key: string, context: SpatialSummaryContext) { untrack(() => this.updateModel(key, 'summary', context)); }
 updateCard(key: string, context: SpatialCardContext) { untrack(() => this.updateModel(key, 'card', context)); }
 private updateModel(key: string, kind: SummaryRecord['kind'], context: PresentationContext) {
  const record = this.records.get(key);
  if (!record || record.kind !== kind) return;
  if (record.frozen) { record.frozen.pending = context; return; }
  this.applyContext(record, context);
 }
 private applyContext(record: SummaryRecord, context: PresentationContext) {
  if (record.model.kind === 'summary') {
   record.model.current = context as SpatialSummaryContext;
   record.root.dataset.presentationMode = (context as SpatialSummaryContext).mode;
   record.root.style.setProperty('--spatial-summary-content-inset', `${(context as SpatialSummaryContext).contentInset}px`);
  } else record.model.current = context as SpatialCardContext;
 }
 retainByElement(element: Element): RetainedSpatialPresentation | undefined {
  const matches = [...this.roots].filter(entry => entry.root === element || entry.root.contains(element) || element.contains(entry.root));
  const record = matches.length === 1 ? matches[0] : undefined;
  return record && this.retainRecord(record);
 }
 retain(key: string): RetainedSpatialPresentation | undefined {
  const record = this.records.get(key);
  return record && this.retainRecord(record);
 }
 private retainRecord(record: SummaryRecord): RetainedSpatialPresentation | undefined {
  if (this.disposed) return;
  const owner = record.owner = record.lease.claim();
  const originalSlot = record.slot, originalKey = record.key;
  const unfreeze = () => {
   const frozen = record.frozen;
   if (!frozen) return;
   record.root.style.cssText = frozen.css;
   record.root.inert = frozen.inert;
   delete record.root.dataset.spatialPresentationFrozen;
   delete record.root.dataset.spatialPresentationGlass;
   delete record.root.dataset.spatialPresentationModelReady;
   record.frozen = undefined;
   if (frozen.pending) this.applyContext(record, frozen.pending);
   if (!record.held) record.model.active = true;
  };
  const freeze = () => {
   if (record.frozen) return record.frozen.box;
   const root = record.root;
   const box = root.getBoundingClientRect();
   const computed = getComputedStyle(root);
   const borderBox = (axis: 'width' | 'height') => {
    const value = parseFloat(computed[axis]);
    if (!Number.isFinite(value)) return axis === 'width' ? root.offsetWidth : root.offsetHeight;
    if (computed.boxSizing === 'border-box') return value;
    const edges = axis === 'width' ? ['Left', 'Right'] : ['Top', 'Bottom'];
    return value + edges.reduce((sum, edge) => sum
     + parseFloat(computed.getPropertyValue(`padding-${edge.toLowerCase()}`) || '0')
     + parseFloat(computed.getPropertyValue(`border-${edge.toLowerCase()}-width`) || '0'), 0);
   };
   // The projected DOMRect can be skewed/scaled. CSS must retain its untransformed local box.
   const width = borderBox('width'), height = borderBox('height');
   record.frozen = { css: root.style.cssText, box, width, height, inert: root.inert };
   // Preserve only inherited presentation values, not route positioning or arbitrary author CSS.
   const properties = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color'];
   for (let index = 0; index < computed.length; index++) {
    const name = computed[index];
    if (/^--(spatial|card|catalog|carousel|summary)-/.test(name)) properties.push(name);
   }
   for (const name of properties) root.style.setProperty(name, computed.getPropertyValue(name));
   Object.assign(root.style, { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, height: `${height}px`, minHeight: `${height}px`, maxHeight: `${height}px`, boxSizing: 'border-box' });
   root.dataset.spatialPresentationFrozen = '';
   if (root.closest('[data-carousel-glass-ready]')) root.dataset.spatialPresentationGlass = '';
   // Catalog disposal clears the original card's ready marker. Its captured GPU
   // geometry still owns the image while this complete source island is held.
   if (root.querySelector('[data-catalog-card][data-catalog-model-ready]')) root.dataset.spatialPresentationModelReady = '';
   return box;
  };
  return {
   record, freeze,
   hold: targetHost => {
    const box = freeze();
    record.held = true;
    record.model.active = false;
    record.root.inert = true;
    Object.assign(record.root.style, { position: 'absolute', left: '0px', top: '0px', margin: '0px', pointerEvents: 'none' });
    targetHost.append(record.root);
    return box;
   },
   adopt: (slot, key, context) => {
    if (this.disposed || !owner.isCurrent() || record.kind !== 'summary') return false;
    const destination = [...this.roots].find(entry => entry.slot === slot && entry !== record);
    const placement = this.placements.get(slot);
    if (!destination || destination.kind !== 'summary' || !placement) return false;
    const nextContext = context ?? destination.model.current as SpatialSummaryContext;
    const nextKey = key ?? destination.key;
    destination.owner.release();
    if (this.records.get(record.key) === record) this.records.delete(record.key);
    record.key = nextKey;
    record.slot = slot;
    record.root.dataset.spatialPresentationKey = nextKey;
    record.owner = record.lease.claim();
    placement.release = record.owner.release;
    this.records.set(nextKey, record);
    slot.append(record.root);
    record.held = false;
    // Do not register the outgoing address again between adoption and destination-model commit.
    record.model.active = false;
    if (record.frozen) record.frozen.pending = nextContext;
    else { this.applyContext(record, nextContext); record.model.active = true; }
    return true;
   },
   restore: () => {
    const placement = this.placements.get(originalSlot);
    const current = this.records.get(originalKey);
    if (this.disposed || !owner.isCurrent() || !originalSlot.isConnected || !placement || current && current !== record) return false;
    if (record.root.parentElement !== originalSlot) originalSlot.append(record.root);
    if (this.records.get(record.key) === record) this.records.delete(record.key);
    record.key = originalKey;
    record.slot = originalSlot;
    record.root.dataset.spatialPresentationKey = originalKey;
    record.owner = record.lease.claim();
    placement.release = record.owner.release;
    this.records.set(originalKey, record);
    record.held = false;
    unfreeze();
    record.model.active = true;
    return true;
   },
   unfreeze,
   release: owner.release
  };
 }
 destroy() {
  if (this.disposed) return;
  this.disposed = true;
  for (const record of this.roots) record.owner.release();
  this.records.clear();
  this.roots.clear();
 }
}
