export const parser = "babel";

export default function transformer(file, api) {
    const j = api.jscodeshift;
    const root = j(file.source);

    /// 找到函数声明
    const fd = root.find(j.FunctionDeclaration)
    const vd = root.find(j.VariableDeclaration)
    const declaration = fd.length ? fd : vd

    /// 分类所有 jsx 元素 
    const je = root.findJSXElements()
    const c_je = {}
    je.forEach(path => {
        const name = path.node.openingElement.name.name
        if (!c_je[name]) {
            c_je[name] = []
        }
        console.log(name)
        c_je[name].push(path)
    })

    /// 分类所有 声明
    const c_d = {}
    declaration.forEach(path => {
        const name = path.node.id.name
        if (!c_d[name]) {
            c_d[name] = []
        }
        console.log(name)
        c_d[name].push(path)
    })

    /// 获得 "App" "Parent" "Child"
    const d_app = c_d["App"]
    const d_parent = c_d["Parent"]
    const d_child = c_d["Child"]

    const j_app = c_je["App"]
    const j_parent = c_je["Parent"]
    const j_child = c_je["Child"]


    /// 更改 Parent declaration [replaceWith]
    const pattern = j(d_parent[0]).find(j.ObjectPattern).__paths[0]
    const new_property = j.property("init", j.identifier("children"), j.identifier("children"))
    new_property.shorthand = true
    const properties = pattern.node.properties
    properties.push(new_property)

    const return_jsx = j(d_parent[0]).find(j.JSXElement)
    const new_args = pattern.node.properties.filter(node => node.value.name !== "children")
        .map(node => node.key)
    const new_return = j.callExpression(j.identifier("children"), new_args)
    return_jsx.replaceWith(new_return)

    /// 更改 App declaration -> return
    const parent_element = j(d_app).findJSXElements("Parent")

    // 生成 {text => ...
    const expression = j.arrowFunctionExpression(
        [j.identifier("text")],
        j.jsxElement(
            j.jsxOpeningElement(
                j.jsxIdentifier("Child"),
                [j.jsxAttribute(j.jsxIdentifier("text"), j.jsxExpressionContainer(j.identifier("text")))],
                true
            ),
            null,
            []
        )
    );
    console.log(expression)

    const op_element = parent_element.__paths
        .map(path => path.node.openingElement)
    const new_closeElement = j.jsxClosingElement(j.jsxIdentifier("Parent"))
    op_element[0].selfClosing = false
    const new_jsxElement = j.jsxElement(
        op_element[0], 
        new_closeElement, 
        [j.jsxText("\n"), j.jsxExpressionContainer(expression), j.jsxText("\n")]
    )
    parent_element.at(0).replaceWith(new_jsxElement)

    return root.toSource();
}