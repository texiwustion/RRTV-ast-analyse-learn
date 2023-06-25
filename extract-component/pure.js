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
 * getJSXNodeByIndex
 * @param {number} _index the index in code
 * @param {object} JSXElementCollection an object contains targetNode and path to store specific element
 * @returns visitor for babel parser
 */
function getJSXNodeByIndex(_index, JSXElementCollection) {
    return {
        JSXElement(path) {
            if (path.node.start <= _index && _index <= path.node.end &&
                !(path.node.start <= JSXElementCollection.targetNode.start && JSXElementCollection.targetNode.end <= path.node.end)) {
                JSXElementCollection.targetNode = path.node
                JSXElementCollection.path = path
                // console.log(path.node)
            }
        }
    }
}

/**
 * generate ast from code
 */
const ast = parser.parse(code, {
    sourceType: 'script', // module unambigious
    plugins: ['jsx', 'typescript'],
});

/**
 * generateJSXElementCollection
 * @returns JSXElementCollection generated from JSXNode specified by index
 */
function generateJSXElementCollection() {
    let targetNode = {
        start: -1,
        end: 999999999,
    }
    let JSXElementCollection = {
        targetNode,
        path: undefined
    }
    traverse.default(ast, getJSXNodeByIndex(111, JSXElementCollection))
    return JSXElementCollection
}


function getParentNodeUnilProgram() {
    const node = generateJSXElementCollection().targetNode
    const path = generateJSXElementCollection().path
    console.log(1)
    const parentpath = path.findParent((_path) => t.isProgram(_path.parentPath.node))

    wrapJSXElementToFunctionDeclaration(node, path, parentpath.node, parentpath)
}
getParentNodeUnilProgram()
const generateCode = generate(ast, {
    comments: false,
    retainLines: false,
    compact: false,
    concise: false,
}).code;
console.log(generateCode)
function wrapJSXElementToFunctionDeclaration(JSXElementNode, JSXElementPath, FunctionDeclarationNode, FunctionDeclarationPath) {

    const {newParams} = generateNewJSXElementAndParams(JSXElementPath, JSXElementNode);
    // 创建新的函数体和函数参数
    const newFunctionBody = t.blockStatement([t.returnStatement(JSXElementNode)]);

    // 创建新的FunctionDeclaration节点
    const newFunctionDeclaration = t.functionDeclaration(
        t.identifier("NewFunction"),
        newParams,
        newFunctionBody
    );
    // console.log(FunctionDeclarationNode.id)
    // 插入新的FunctionDeclaration节点作为与指定FunctionDeclaration节点同级的下一个节点
    FunctionDeclarationPath.insertAfter(newFunctionDeclaration);

    // 删除旧的JSXElement节点
    // JSXElementPath.remove();
    replaceJSXElement(JSXElementNode, JSXElementPath)
}

function getJSXElementReferences(JSXElementPath) {
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
function replaceJSXElement(JSXElementNode, JSXElementPath) {
    const {newJSXElement} = generateNewJSXElementAndParams(JSXElementPath, JSXElementNode);

    // 替换 JSXElement 节点
    JSXElementPath.replaceWith(newJSXElement);
}
function generateNewJSXElementAndParams(JSXElementPath, JSXElementNode) {
    const references = getJSXElementReferences(JSXElementPath);

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
    
    // 生成 函数参数
    const newParams = buildFunctionParamsAst(newJSXAttributes)
return {newJSXElement, newParams}
}

function generateFunctionParamsFromJSXAttributes(attributes) {
  const result = attributes.map(attr => attr.name.name).join(', ');
  return `{${result}}`;
}

function buildFunctionParamsAst(attributes) {
  const properties = attributes.map(attr => {
    const key = t.identifier(attr.name.name);
    const value = t.identifier(attr.name.name);
    return t.objectProperty(key, value, false, true);
  });
  const objectPattern = t.objectPattern(properties);
  const params = [objectPattern];
  return params;
}