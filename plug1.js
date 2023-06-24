module.exports = ({ types: t }) => ({
    /** 插件名称 */
    name: 'babel-plugin-1',
    /** 访问者 */
    visitor: {
        // coding in here...
        BinaryExpression(path) {
            if (path.node.operator !== "===") {
                return;
            }

            path.node.left = t.identifier("sebmck");
            path.node.right = t.identifier("dork");
        }
    },
});