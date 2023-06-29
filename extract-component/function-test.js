
const parser = require('@babel/parser');
const traverse = require('@babel/traverse')
const t = require('@babel/types')
const generate = require('@babel/generator').default
/**
 * customize code fragment
 */
const code = `function Button(a, b, [c, d, ...rest]) {
  return 1
}`;

/**
 * generate ast from code
 */
const ast = parser.parse(code, {
    sourceType: 'script', // module unambigious
    plugins: ['jsx', 'typescript'],
});

traverse.default(ast, {
    FunctionDeclaration(path) {
        // console.log(path.node.params)
        // const Params = path.node.params
        // Params.forEach((node)=>{
            // if (t.isIdentifier(node)) {
                // console.log(node.name)
            // }
        // })
        path.traverse({
            Identifier(path) {
                console.log()
            }
        })
    }
})
