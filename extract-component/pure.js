/// DO: range->JSXElement, if many siblings Element, don't store the last but store all

const parser = require('@babel/parser');
const traverse = require('@babel/traverse')
const t = require('@babel/types')
const generate = require('@babel/generator').default
/**
 * customize code fragment
 */
const code = `const a = 10
function Button() {
  return <div>
    <button label="hello" id={a}>{a}</button>
  	<p title={a} id={b} className="hello">hello world</p>
    </div>
}`;

/**
 * generate ast from code
 */
const ast = parser.parse(code, {
    sourceType: 'script', // module unambigious
    plugins: ['jsx', 'typescript'],
});

/**
 * store Element infor
 * interface ElementSpecified {
 *     node;
 *     path;
 * }
 */
let JSXElementSpecified = {
    node: undefined,
    path: undefined
}

/**
 * store range data
 */
const range = {
    start: 46,
    end: 1600
}

let SiblingsSpecified = new Set()

/**
 * base on index and blank JSXElementSpecified, generate new JSXElementSpecified
 * @param {number} index where the cursor is
 * @param {ElementSpecified} JSXElementSpecified 
 * @returns new JSXElementSpecified
 */
function IndexToJSXElementGenerator(index, JSXElementSpecified) {
    /// JSXElementSpecified: {node, path}
    traverse.default(ast, IndexToJSXElementVisitor(index, JSXElementSpecified))
    return JSXElementSpecified
}
/**
 * generate specific visitor
 * @param {number} index where the cursor is
 * @param {ElementSpecified} JSXElementSpecified 
 * @returns visitor used to traverse for JSXElement
 */
function IndexToJSXElementVisitor(index, JSXElementSpecified) {
    return {
        JSXElement(path) {
            if (IndexToJSXElementEdgeHandler(
                path.node, {
                index,
                node: JSXElementSpecified.node,
            })) {
                JSXElementSpecified.node = path.node
                JSXElementSpecified.path = path
            }
        }
    }
}
/**
 * judge whether to handle this trip when visiting
 * @param {node} node 
 * @param {Object} opts othre data: index, node
 * @returns whether to handle
 */
function IndexToJSXElementEdgeHandler(node, opts) {
    if (node.start <= opts.index && opts.index <= node.end &&
        !(node.start <= opts.node.start && opts.node.end <= node.end)) {
        return true
    }
    return false
}

/**
 * base on range and blank JSXElementSpecified, generate new JSXElementSpecified
 * @param {Range} range the range of selection
 * @param {ElementSpecified} JSXElementSpecified 
 * @returns new JSXElementSpecified
 */
function RangeToJSXElementGenerator(range, JSXElementSpecified) {
    traverse.default(ast, RangeToJSXElementVisitor(range, JSXElementSpecified))
    if (JSXElementSpecified.node === undefined) {
        throw new Error("所选区域内无完整 XML 元素!")
    }
    return JSXElementSpecified

}
/**
 * generate specific visitor
 * @param {range} the range of selection
 * @param {JSXElementSpecified} JSXElementSpecified
 * @param {SiblingsSpecified} it may have siblings
 * @returns visitor used to traverse for JSXElement
 */
function RangeToJSXElementVisitor(range, JSXElementSpecified) {
    return {
        JSXElement(path) {
            if (RangeToJSXElementEdgeHandler(path.node, { range, node: JSXElementSpecified.node })) {
                if (JSXElementSpecified.node !== undefined)
                    if (path.node.end <= JSXElementSpecified.node.start || path.node.start >= JSXElementSpecified.node.end) {
                        SiblingsSpecified.add(JSXElementSpecified)
                    } // no siblings, it blank
                JSXElementSpecified.node = path.node
                JSXElementSpecified.path = path
            }
        }

    }
}
/**
 * judge whether to handle this trip when visiting
 * @param {node} node 
 * @param {opts} other data: range, node
 * @returns whether to handle
 */
function RangeToJSXElementEdgeHandler(node, opts) {
    if (!(opts.range.start <= node.start && node.end <= opts.range.end))
        return false
    if (opts.node === undefined)
        return true
    if (opts.node.start <= node.start && node.end <= opts.node.end)
        return false

    return true
}

/**
 * base on current path, generate specification of parent path adjacent to Program
 * @param {path} path current path
 * @returns specification of parent path adjacent to Program
 */
function PathToParentPathUnilProgram(path) {
    /// TODO: 更好的检测方式，用 isProgram 并不稳定：考虑返回值的 parentPath
    const parentpath = path.findParent((_path) => t.isProgram(_path.parentPath.node))
    const parentnode = parentpath.node
    return {
        node: parentnode,
        path: parentpath
    }
}

/**
 * base on the JSXElement in current range, generate specification of parent path adjacent to Program
 * @returns specification of parent path adjacent to Program
 */
function JSXElementToOuterFunctionDeclarationGenerator() {
    const path = RangeToJSXElementGenerator(range, JSXElementSpecified).path
    return PathToParentPathUnilProgram(path)
}

/**
 * give base and Name, new params, transform jsx to function wrapping it
 * @param {*} JSXElementNode based JSXElement
 * @param {*} Name Name of New Function
 * @param {*} NewParams Params of New Function
 * @returns new FunctionDeclaration based on JSXElement
 */
function JSXElementToNewFunctionDeclarationTransformer(JSXElementNode, Name, NewParams) {
    // 创建新的函数体
    const newFunctionBody = t.blockStatement([t.returnStatement(JSXElementNode)]);

    // 创建新的FunctionDeclaration节点
    const newFunctionDeclaration = t.functionDeclaration(
        t.identifier(Name),
        NewParams,
        newFunctionBody
    );

    return newFunctionDeclaration
}

/**
 * give base, transform JSXElement to its references
 * @param {*} JSXElementPath base JSXElement
 * @returns all of its references, like {'a', 'b'}
 */
function JSXElementToReferencesTransformer(JSXElementPath) {
    const references = new Set();

    JSXElementPath.traverse({
        JSXExpressionContainer(path) {
            const parentPath = path.parentPath;
            if (
                parentPath.isJSXAttribute() &&
                parentPath.node.name.name !== 'key' &&
                parentPath.node.name.name !== 'ref'
            ) {
                const { name } = path.node.expression;
                references.add(name);
            }
        },
    });
    return references;
}

/**
 * give base, tranform refs to params of a function
 * @param {*} references base refs
 * @returns new params of a function
 */
function ReferencesToFunctionParamsTransformer(references) {
    let properties = []
    for (let item of references) {
        const key = t.identifier(item);
        const value = t.identifier(item);
        properties = [...properties, t.objectProperty(key, value, false, true)];
    }
    const objectPattern = t.objectPattern(properties);
    const params = [objectPattern];
    return params;
}

/**
 * give base, attention to refs, transform JSXElement to its Alternative
 * @param {*} JSXElementNode base
 * @param {*} references base
 * @returns its Alterative which serves origin as child
 */
function JSXElementToAlternativeTransformer(JSXElementNode, references) {
    // 生成新的 JSXOpeningElement 节点
    let newJSXAttributes = []
    references.forEach(
        (item) => {
            newJSXAttributes = [
                ...newJSXAttributes,
                t.jsxAttribute(
                    t.jsxIdentifier(item),
                    t.jsxExpressionContainer(t.identifier(item))
                )
            ]
        }
    )
    const newJSXOpeningElement = t.jsxOpeningElement(
        t.jsxIdentifier('NewFunction'),
        newJSXAttributes
    );
    newJSXOpeningElement.selfClosing = true; // 设置闭合标签属性为 true

    // 生成新的 JSXElement 节点
    const newJSXElement = t.jsxElement(
        newJSXOpeningElement,
        null,
        []
    );

    return newJSXElement
}

/**
 * modify the ast based on all Elements, which generated from generator or transformed from original Element
 */
function modifier() {
    RangeToJSXElementGenerator(range, JSXElementSpecified)
    const children = JSXElementSpecified.path.parentPath.get('children')
    let siblings = []
    // if (typeof children !== "object")
    children.forEach(childPath => {
        if (childPath.isJSXElement() && childPath !== JSXElementSpecified.path && range.start <= childPath.node.start && childPath.node.end <= range.end) {
            siblings.push(childPath);
        }
    });
    siblings.push(JSXElementSpecified.path)
    let fragment = undefined
    if (siblings.length > 1) {
        fragment = wrapJSXElements(siblings)
        siblings.forEach(childPath => {
            if (childPath !== JSXElementSpecified.path)
                childPath.remove()
        })
    }
    // console.log(siblings)

    const BasedFunctionDeclarationPath = JSXElementToOuterFunctionDeclarationGenerator().path
    if (fragment) {
        const FragmentElement = JSXElementSpecified.path.replaceWith(fragment)
        console.log(FragmentElement)
        JSXElementSpecified.path = FragmentElement[0]
        JSXElementSpecified.node = FragmentElement[0].node
    }
    // console.log(JSXElementSpecified.node)
    // JSXElementSpecified = {node: JSXElementSpecified.path.parentPath.node, path: JSXElementSpecified.path.parentPath}
    // console.log(JSXElementSpecified.node)
    const references = JSXElementToReferencesTransformer(JSXElementSpecified.path)
    const newParams = ReferencesToFunctionParamsTransformer(references)
    const newFunctionDeclaration = JSXElementToNewFunctionDeclarationTransformer(JSXElementSpecified.node, "NewFunction", newParams)

    // 插入新的FunctionDeclaration节点作为与指定BasedFunctionDeclaration节点同级的下一个节点
    BasedFunctionDeclarationPath.insertAfter(newFunctionDeclaration);

    const JSXElementAlternative = JSXElementToAlternativeTransformer(JSXElementSpecified.node, references)
    // 替换旧的JSXElement节点
    JSXElementSpecified.path.replaceWith(JSXElementAlternative);
}

modifier()
function wrapJSXElements(paths) {
    const jsxElements = paths.map(path => path.node);
    const fragment = t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), jsxElements);
    return fragment
    //   paths[0].replaceWith(fragment);
    // console.log(generate(fragment, {
    // comments: false,
    // retainLines: false,
    // compact: false,
    // concise: false,
    // sourceMaps: true,
    // }).code)
}
/**
 * base on ast, generate {code, map}
 */
const generateCode = generate(ast, {
    comments: false,
    retainLines: false,
    compact: false,
    concise: false,
    // sourceMaps: true,
}).code;

console.log(generateCode)

