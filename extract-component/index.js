const JSXElement_visitor = {
    JSXElement(path) {
        path.node.remove()
    }
}
module.exports = ({ types: t }) => ({
    /** 插件名称 */
    name: 'babel-plugin-1',
    /** 访问者 */
    visitor: {
        ...JSXElement_visitor,

    }
    ,
});