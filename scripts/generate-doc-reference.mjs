import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { format, resolveConfig } from 'prettier';

// The field tables follow the actual declarations, including inherited and nested fields.
const root = resolve(import.meta.dirname, '..');
const componentNames = ['BrandStageShell', 'ContentPage', 'SpatialElementPage', 'SpatialCardGridSection', 'SpatialCarouselSection', 'Section'];
const virtual = new Map(componentNames.map(name => {
 const file = resolve(root, `packages/sveltekit/src/spatial-element/${name}.svelte`);
 const script = readFileSync(file, 'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
 const tree = ts.createSourceFile(file + '.ts', script, ts.ScriptTarget.Latest, true);
 let props = 'Props';
 if (!script.includes('interface Props')) {
  for (const statement of tree.statements) if (ts.isVariableStatement(statement)) {
   for (const declaration of statement.declarationList.declarations) {
    if (declaration.type && declaration.initializer?.getText(tree).includes('$props()')) props = declaration.type.getText(tree);
   }
  }
 }
 return [(file + '.reference.ts').replaceAll('\\', '/'), script + `\nexport type DocumentationProps = ${props};`];
}));
const options = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true, resolveJsonModule: true, paths: { '@spatial-elements/core': [resolve(root, 'packages/core/src/index.ts')], '@spatial-elements/core/*': [resolve(root, 'packages/core/src/*')] } };
const host = ts.createCompilerHost(options);
const originalRead = host.readFile, originalExists = host.fileExists;
host.readFile = path => virtual.get(path.replaceAll('\\', '/')) ?? originalRead(path);
host.fileExists = path => virtual.has(path.replaceAll('\\', '/')) || originalExists(path);
const program = ts.createProgram([resolve(root, 'packages/core/src/index.ts'), ...virtual.keys()], options, host);
const checker = program.getTypeChecker();
const definitions = new Map();
for (const file of program.getSourceFiles()) {
 if (!file.fileName.replaceAll('\\', '/').includes('/packages/')) continue;
 for (const node of file.statements) if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) definitions.set(node.name.text, node);
}
const names = [
 'SpatialElementData', 'SpatialListItem', 'ContentPageData', 'SpatialElementGeometry',
 'SpatialElementFeature', 'SpatialElementAction', 'SpatialElementBreadcrumb', 'SpatialElementMediaItem',
 'SpatialElementSectionDefinition', 'SpatialElementSectionStyle', 'SpatialCardGridOptions', 'CarouselPresentation',
 'SpatialTheme', 'SpatialThemeOptions', 'SpatialThemeRadii', 'SpatialSectionBackgrounds', 'SpatialSectionTheme', 'SpatialDockedPanelTheme', 'SpatialMinimapTheme',
 'BackgroundSettings', 'StageModelSettings', 'StageModelRotation', 'StageCameraSettings', 'StagePanelShape', 'StagePanelTheme', 'StagePanelMinimapOptions', 'StageMinimapDockedView', 'StageInteractionTheme', 'StageRenderSettings', 'StagePhysicalMaterialSettings', 'StageMaterialSettings', 'StagePanelSurface',
 'SpatialElementAssetResource', 'SpatialElementLodPair', 'VerifiedSpatialElementAssetManifest', 'SpatialSummaryContext', 'SpatialMessagesInput',
 'StageMaterialBlending', 'SpatialElementAssetRequirements', 'SpatialElementMatrix4', 'SpatialElementVector3', 'SpatialElementProfileReference', 'SpatialElementPoster', 'SpatialElementAssetRepresentation', 'ResolvedSpatialElementData', 'CatalogEndpointRole', 'CatalogEndpointAddress', 'SpatialSummarySnippet'
];
const anchor = name => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
const doc = symbol => ts.displayPartsToString(symbol?.getDocumentationComment(checker) ?? []).replace(/\{@link ([^}]+)\}/g, '$1');
const defaults = {
 'SpatialCardGridOptions.cardSize': 'Defaults to m. Small, medium or large controls card geometry and responsive spans.',
 'SpatialCardGridOptions.cardShadow': 'Defaults to false. Adds a resting shadow; hover and focus still highlight cards without it.',
 'SpatialCardGridOptions.cardTone': 'Defaults to standard; muted uses the alternate section surface.',
 'SpatialCardGridOptions.mediaAspect': 'Defaults to 1/1 for spatial cards. The text has its own height.',
 'SpatialCardGridOptions.mediaFit': 'Defaults to contain.',
 'SpatialCardGridOptions.textAlign': 'Defaults to start.',
 'SpatialCarouselSection.initialItemKey': 'Initial selection: itemKey when supplied, otherwise the element id. Not a controlled selected-value prop.',
 'SpatialCarouselSection.onselectionchange': 'Reports the selected occurrence key and original element ID after a selection changes.',
 'SpatialCarouselSection.presentation': 'Optional turntable spacing and depth; does not change authored model scale.',
 'SpatialElementAction.href': 'Optional native link destination. Supply one for a navigable default action.',
 'SpatialElementAction.label': 'Visible action text.',
 'ContentPageData.bodyLayout': 'Wide or narrow content body, inherited from Page Sections.',
};
function fields(type, owner, prefix = '', depth = 0, seen = new Set()) {
 if (!(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection))) return [];
	if (checker.isArrayType(type) || checker.isTupleType(type)) return [];
 return checker.getPropertiesOfType(type).flatMap(symbol => {
  const fallback = owner === 'SpatialThemeOptions' ? definitions.get('SpatialTheme').members.find(member => member.name?.getText() === symbol.name) : undefined;
  const node = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? fallback;
  if (!node || !ts.isPropertySignature(node) || symbol.getJsDocTags(checker).some(tag => tag.name === 'internal')) return [];
  if (owner === 'Section' && !['section', 'children', 'class', 'presentation'].includes(symbol.name)) return [];
  const field = prefix + symbol.name;
  const valueType = checker.getTypeOfSymbolAtLocation(symbol, node);
  const text = fallback && !['id', 'name', 'background'].includes(symbol.name) ? `Partial<SpatialTheme['${symbol.name}']>` : node.type?.getText().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ') ?? checker.typeToString(valueType);
  const id = anchor(owner + '-' + field);
  const row = { name: field, id: seen.has(id) ? '' : id, type: text, optional: (owner === 'SpatialThemeOptions' && prefix.length > 0) || !!(symbol.flags & ts.SymbolFlags.Optional), description: defaults[owner + '.' + field] ?? defaults[(node.parent.name?.text ?? '') + '.' + symbol.name] ?? doc(symbol) };
  seen.add(id);
  // Inline object types need field tables too: summary.sectionLink, colors, captions, etc.
  const nestedNode = node.type && (ts.isArrayTypeNode(node.type) ? node.type.elementType : node.type);
  const nested = depth < 4 && nestedNode && ts.isTypeLiteralNode(nestedNode)
   ? fields(checker.getTypeAtLocation(nestedNode), owner, field + '.', depth + 1, seen) : [];
  return [row, ...nested];
 });
}
function entry(name, node, kind = 'type') {
 if (!node) throw Error('Missing declaration: ' + name);
 const symbol = checker.getSymbolAtLocation(node.name);
 const type = checker.getDeclaredTypeOfSymbol(symbol);
 const alternatives = type.isUnion() && type.types.some(t => (t.flags & ts.TypeFlags.Object) && !checker.isArrayType(t)) ? type.types : [type];
 const seen = new Set();
 return { name, id: anchor(name), kind, description: doc(symbol), declaration: node.getText().replace(/export\s+/, ''), variants: alternatives.map((value, i) => ({ label: alternatives.length > 1 ? 'Alternative ' + (i + 1) : 'Fields', fields: fields(value, name, '', 0, seen) })) };
}
const entries = names.map(name => entry(name, definitions.get(name)));
for (const [i, path] of [...virtual.keys()].entries()) {
 const node = program.getSourceFile(path).statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'DocumentationProps');
 const item = entry(componentNames[i], node, 'component');
 item.declaration = componentNames[i] + ' component properties';
 entries.push(item);
}
const external = ['SectionDefinition','SectionBackground','SectionBackgroundColor','ContentSpan','CardSize','CardMediaAspect','CardMediaFit','SurfaceTone','MenuItem','PageTheme','ImageData','ContentAction','Breadcrumb','HeadingLevel','HeadingSize'];
const targets = Object.fromEntries(entries.map(item => [item.name, `/docs/reference/${item.kind === 'component' ? 'components' : 'types'}/#${item.id}`]));
for (const name of external) targets[name] = 'https://page-sections.bergjohann.com/docs/reference/types/#' + anchor(name);
targets.PageContentData = 'https://page-sections.bergjohann.com/docs/reference/types/#content-page-data';
const output = resolve(root, 'apps/website/src/lib/docs/reference.ts');
const source = `// Generated by scripts/generate-doc-reference.mjs from package declarations.\nexport interface ReferenceField { name: string; id: string; type: string; optional: boolean; description: string }\nexport interface ReferenceEntry { name: string; id: string; kind: string; description: string; declaration: string; variants: { label: string; fields: ReferenceField[] }[] }\nexport const reference: ReferenceEntry[] = ${JSON.stringify(entries)};\n`;
const formatted = await format(source, { ...await resolveConfig(output), filepath: output });
const indexOutput = resolve(root, 'apps/website/src/lib/docs/referenceIndex.ts');
const index = await format(`// Generated by scripts/generate-doc-reference.mjs. Keep the global search index small.\nexport const referenceTargets: Record<string, string> = ${JSON.stringify(targets)};\nexport const referenceDocuments = ${JSON.stringify(entries.map(entry => ({title: entry.name, href: targets[entry.name], description: entry.description || 'Fields and declaration of ' + entry.name, group: 'Reference'})))};\n`, { ...await resolveConfig(indexOutput), filepath: indexOutput });
for (const [path, content] of [[output, formatted], [indexOutput, index]]) {
 if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8').replaceAll('\r\n','\n') !== content.replaceAll('\r\n','\n')) throw Error('Stale reference. Run npm run docs:types.');
 } else writeFileSync(path, content);
}
console.log(`Verified ${entries.length} type/component definitions and their nested fields.`);
