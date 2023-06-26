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

let JSXElementSpecified = {
    node: undefined,
    path: undefined
}

const range = {
    start: 0,
    end: 180
}

function IndexToJSXElementGenerator(index, JSXElementSpecified) {
    /// JSXElementSpecified: {node, path}
    traverse.default(ast, IndexToJSXElementVisitor(index, JSXElementSpecified))
    return JSXElementSpecified
}
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
function IndexToJSXElementEdgeHandler(node, opts) {
    if (node.start <= opts.index && opts.index <= node.end &&
        !(node.start <= opts.node.start && opts.node.end <= node.end)) {
        return true
    }
    return false
}
function RangeToJSXElementGenerator(range, JSXElementSpecified) {
    traverse.default(ast, RangeToJSXElementVisitor(range, JSXElementSpecified))
    if (JSXElementSpecified.node === undefined) {
        throw new Error("所选区域内无完整 XML 元素!")
    }   
    return JSXElementSpecified

}
function RangeToJSXElementVisitor(range, JSXElementSpecified) {
    return {
        JSXElement(path) {
            if (RangeToJSXElementEdgeHandler(path.node, { range, node: JSXElementSpecified.node })) {
                JSXElementSpecified.node = path.node
                JSXElementSpecified.path = path
            }
        }

    }
}
function RangeToJSXElementEdgeHandler(node, opts) {
    if (range.start <= node.start && node.end <= range.end &&
        (opts.node === undefined ||
            !(opts.node.start <= node.start &&
                node.end <= opts.node.end))) {
        return true
        // console.log(path.node)
    }
    return false
}

function PathToParentPathUnilProgram(path) {
    /// TODO: 更好的检测方式，用 isProgram 并不稳定：考虑返回值的 parentPath
    const parentpath = path.findParent((_path) => t.isProgram(_path.parentPath.node))
    const parentnode = parentpath.node
    return {
        node: parentnode,
        path: parentpath
    }
}

function JSXElementToOuterFunctionDeclarationGenerator() {
    const path = RangeToJSXElementGenerator(range, JSXElementSpecified).path
    return PathToParentPathUnilProgram(path)
}

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

function ReferencesToFunctionParamsTransformer(references) {
    let properties = []
    for (let item of references) {
        const key = t.identifier(item);
        const value = t.identifier(item);
        properties = [ ...properties, t.objectProperty(key, value, false, true)];
    }
    const objectPattern = t.objectPattern(properties);
    const params = [objectPattern];
    return params;
}
function JSXElementToAlternativeTransformer(JSXElementNode, references) {
    // 生成新的 JSXOpeningElement 节点
    const newJSXAttributes = JSXElementNode.openingElement.attributes
        .filter((attr) => {
            if (attr.value && t.isJSXExpressionContainer(attr.value)) {
                const propValue = attr.value.expression.name;
                return references.has(propValue);
            } else {
                return false;
            }
        })
        .map((attr) => {
            const propName = attr.name.name;
            const propValue = attr.value.expression.name;
            // 将 JSX 属性的值转换成传递变量的形式
            return t.jsxAttribute(t.jsxIdentifier(propValue), t.jsxExpressionContainer(t.identifier(propValue)));
        });
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

function modifier() {
    RangeToJSXElementGenerator(range, JSXElementSpecified)

    const references = JSXElementToReferencesTransformer(JSXElementSpecified.path)
    const newParams = ReferencesToFunctionParamsTransformer(references)
    const newFunctionDeclaration = JSXElementToNewFunctionDeclarationTransformer(JSXElementSpecified.node, "NewFunction", newParams)
    const BasedFunctionDeclarationPath = JSXElementToOuterFunctionDeclarationGenerator().path

    // 插入新的FunctionDeclaration节点作为与指定BasedFunctionDeclaration节点同级的下一个节点
    BasedFunctionDeclarationPath.insertAfter(newFunctionDeclaration);

    const JSXElementAlternative = JSXElementToAlternativeTransformer(JSXElementSpecified.node, references)
    // 替换旧的JSXElement节点
    JSXElementSpecified.path.replaceWith(JSXElementAlternative);
}

modifier()

const generateCode = generate(ast, {
    comments: false,
    retainLines: false,
    compact: false,
    concise: false,
    // sourceMaps: true,
}).code;
console.log(generateCode)

