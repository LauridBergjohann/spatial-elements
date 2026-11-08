import { SectionRegistry } from '@page-sections/core';
import type { SpatialElementSectionNavigationItem } from './types.js';
export { SECTION_REGISTRY as SPATIAL_ELEMENT_SECTION_REGISTRY_KEY } from '@page-sections/core';
export type SpatialElementSectionRegistration = ReturnType<SectionRegistry['register']>;
/** Compatibility adapter for the existing callback that receives a navigation snapshot. */
export class SpatialElementSectionRegistry extends SectionRegistry {
 constructor(onChange: (sections: SpatialElementSectionNavigationItem[]) => void = () => {}) {
  super(() => onChange(this.sections));
 }
}
export const SECTION_PAGE_KIND = Symbol('section-page-kind');
