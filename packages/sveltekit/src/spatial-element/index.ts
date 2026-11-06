export { default as BrandStageShell } from './BrandStageShell.svelte';
export type { SpatialSummaryContext, SpatialSummarySnippet } from './spatialSummary.js';
export { defaultSpatialMessages, resolveSpatialMessages, type SpatialMessages, type SpatialMessagesInput } from '@spatial-elements/core/spatial-element/messages';
export { default as SpatialElementPage } from './SpatialElementPage.svelte';
export { default as SpatialListPage } from './SpatialListPage.svelte';
export { default as Section } from './Section.svelte';
export { findSpatialElement, getSpatialListItems } from '@spatial-elements/core/spatial-element/spatialElement';
export type {
	SpatialElementAction,
	SpatialTheme,
	SpatialThemeRadii,
	SpatialSectionBackgrounds,
	SectionBackground,
	SectionBackgroundColor,
	SpatialElementBreadcrumb,
	SpatialElementData,
	SpatialDockedPanelTheme,
	SpatialElementFeature,
	SpatialElementMediaItem,
	SpatialMinimapTheme,
	SpatialListItem,
	SpatialElementSectionDefinition,
	SpatialElementSectionNavigationItem,
	SpatialElementSectionStyle,
	SpatialSectionTheme
} from '@spatial-elements/core/spatial-element/types';

export { default as ContentPage } from './ContentPage.svelte';
export { default as ContentGrid } from './ContentGrid.svelte';
export { default as ContentBlock } from './ContentBlock.svelte';
export type { ContentGridSize, ContentSpan, SpatialCardSize } from '@spatial-elements/core/spatial-element/responsiveLayout';
export { default as CarouselSection } from './CarouselSection.svelte';
export { default as ListSection } from './ListSection.svelte';
export type { ContentPageData } from '@spatial-elements/core/spatial-element/types';

export type { CarouselPresentation } from '@spatial-elements/core/catalog/catalogPose';
export { createSpatialTheme, resolveSpatialThemeRadii, resolveSpatialSectionBackgrounds, type SpatialThemeOptions } from '@spatial-elements/core/spatial-element/spatialTheme';
export type { StageRenderSettings, BackgroundSettings, StageModelSettings, StageCameraSettings } from '@spatial-elements/core/stage/stageTypes';

export { geometryFromLodPair, type SpatialElementGeometry } from '@spatial-elements/core/spatial-element/spatialElementGeometry';
