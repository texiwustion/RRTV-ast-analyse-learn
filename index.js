// → 导入模块
const parser = require('@babel/parser');
const traverse = require('@babel/traverse')
// → 定义一段代码字符串
const code = `
        function getName() {
            return <div>
                your name
            </div>
        } 
        function getAge() {
            const age = 14
            return <div>
                my age is {age}
            </div>
        }
    `;
// → 解析代码字符串
const ast = parser.parse(code, {
    sourceType: 'script', // module unambigious
    plugins: ['jsx', 'typescript'],
});

// visitor

const visitor = {
    JSXElement(path) {
        console.log('jsx!')
        console.log(path.node)
    }
}

// traverse

traverse.default(ast, visitor)

// → 输出ast
// console.log(JSON.stringify(ast, null, 4));