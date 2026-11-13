import ts from 'typescript';

// Read literal examples without importing or executing documentation code.
export function examplesFrom(source, filename) {
	const module = /<script\s+module[^>]*>([\s\S]*?)<\/script>/.exec(source)?.[1];
	if (!module) return [];
	const tree = ts.createSourceFile(filename + '.ts', module, ts.ScriptTarget.Latest, true);
	for (const statement of tree.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (declaration.name.getText(tree) !== 'examples') continue;
			if (!declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer))
				throw new Error(`${filename}: examples must be a literal array`);
			return declaration.initializer.elements.map((element) => {
				if (!ts.isObjectLiteralExpression(element))
					throw new Error(`${filename}: example must be an object`);
				const value = {};
				for (const property of element.properties) {
					if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer))
						throw new Error(`${filename}: example properties must be literal strings`);
					value[property.name.getText(tree).replace(/^['"]|['"]$/g, '')] =
						property.initializer.text;
				}
				if (typeof value.code !== 'string' || !value.language)
					throw new Error(`${filename}: example needs code and language`);
				return value;
			});
		}
	}
	return [];
}
